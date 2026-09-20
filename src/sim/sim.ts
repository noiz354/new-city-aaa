// Sim: owns World + Clock + Economy + Rng; executes Commands; emits events.
// Determinism: identical seed + command sequence + tick counts => identical hash.
import type {
  Command,
  CommandResult,
  SaveEntities,
  SaveLayers,
  SaveMeta,
  SavePolicy,
  SimEvent,
  SimSnapshot,
} from '../shared/types.js';
import { fnv1aBytes } from '../shared/crc32.js';
import { Buildings } from './buildings.js';
import { Clock, TICKS_PER_DAY, TICKS_PER_MONTH } from './clock.js';
import { Cohort } from './cohort.js';
import { Demand } from './demand.js';
import { Fields } from './fields.js';
import { normalizeRect } from '../shared/grid.js';
import { applyBulldoze, applyRoad, applyZone, validateBulldoze, validateRoad, validateZone } from './commands.js';
import { Economy } from './economy.js';
import { Growth } from './growth.js';
import { RoadAccess } from './road-access.js';
import { Rng } from './rng.js';
import { CHUNK } from '../shared/types.js';
import { Upkeep } from './upkeep.js';
import { World, type TerrainPreset } from './world.js';

export interface SimOptions {
  seed?: number;
  size?: number;
  preset?: TerrainPreset;
  now?: () => number;
}

export class Sim {
  readonly world: World;
  readonly clock: Clock;
  readonly economy: Economy;
  readonly rng: Rng;
  readonly buildings: Buildings; // T-201: authoritative building lifecycle store
  readonly growth: Growth; // T-202: daily scoring → spawn + move-in
  readonly roadAccess: RoadAccess; // T-204: canonical attachment flags (derived truth)
  readonly cohort: Cohort; // T-305: residents/jobs/gravity match/unemployment/happiness
  readonly upkeep: Upkeep; // T-205: monthly per-building/road upkeep (economy stage)
  readonly demand: Demand; // T-206: FR-S02 RCI demand, recomputed daily (derived)
  readonly fields: Fields; // T-207: land value + landFit (fields stage, derived)
  private events: SimEvent[] = [];

  constructor(opts: SimOptions = {}) {
    this.world = new World({ seed: opts.seed, size: opts.size, preset: opts.preset });
    this.clock = new Clock(opts.now ?? (() => 0));
    this.economy = new Economy();
    this.rng = new Rng(this.world.seed ^ 0x51ed2709);
    this.buildings = new Buildings(this.world);
    this.roadAccess = new RoadAccess(this.world);
    this.cohort = new Cohort(this.world, this.buildings);
    this.demand = new Demand(this.world, this.buildings, { cohort: this.cohort, getTax: () => this.economy.tax });
    this.fields = new Fields(this.world, this.buildings);
    this.fields.recompute(); // fields valid from t=0 (growth scores read them day 1)
    this.growth = new Growth(this.world, this.buildings, this.roadAccess, this.demand, this.fields);
    this.upkeep = new Upkeep(this.world, this.buildings, this.economy);
  }

  update(realDtMs: number): void {
    this.clock.update(realDtMs, (tick) => this.onTick(tick));
  }

  protected onTick(tick: number): void {
    // Frozen tick order (simulation-architecture §2): growth stage. Lifecycle timers first,
    // then the daily growth pass at the day boundary (heavy systems on day boundaries only).
    this.buildings.onTick(tick);
    if (tick % TICKS_PER_DAY === 0) {
      this.growth.onDay(tick);
      // Cohort (jobs/agents stage) recomputes BEFORE demand (frozen order §2); demand then reads it.
      this.cohort.recompute(this.economy.tax.r);
      // Demand recomputes AT THE END of the growth stage (post completion + move-in);
      // see the T-206 stub ledger in demand.ts for why (doc smoothing cut → §9 ask-first).
      this.demand.recompute();
      // Fields stage (frozen order: growth → fields-commit → economy): land value follows
      // today's buildings/terrain; growth scores consume it with the same one-day lag.
      this.fields.recompute();
    }
    // Economy stage AFTER growth (frozen order: … → growth → fields-commit → economy(monthly)).
    if (tick % TICKS_PER_MONTH === 0 && tick > 0) {
      const income = this.economy.collectTax(this.buildings); // T-301 docs/02 §4
      if (income > 0) this.economy.add(income);
      const bill = this.upkeep.onMonth();
      this.economy.recordMonth(income, bill.gross, bill.gross - bill.net); // history ring (T-301; feed T-303)
      if (income > 0 || bill.net !== 0) {
        this.events.push({ type: 'treasury-changed', balance: this.economy.balance });
      }
    }
  }

  execute(cmd: Command): CommandResult {
    // docs/02 §4 bankruptcy contract: below the limit only free commands may proceed
    // (all current command kinds are paid; the blocking reason feeds the banned-commands modal).
    if (this.economy.isBankrupt()) return { ok: false, reason: 'bankrupt' };
    let res: CommandResult;
    if (cmd.kind === 'place-road') {
      const v = validateRoad(this.world, this.economy, cmd.path);
      if (!v.ok || !v.plan) res = v;
      else {
        for (const t of v.plan.newTiles) this.buildings.demolishAt(t.x, t.y); // road clears buildings
        const applied = applyRoad(this.world, v.plan);
        this.economy.spend(v.cost);
        res = { ok: true, cost: v.cost, tiles: applied };
        let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
        for (const t of cmd.path) {
          if (t.x < x0) x0 = t.x; if (t.x > x1) x1 = t.x;
          if (t.y < y0) y0 = t.y; if (t.y > y1) y1 = t.y;
        }
        if (x1 >= x0) this.roadAccess.noteRect({ x0, y0, x1, y1 }); // attachment may change around new road
        this.emitChunksFor(cmd.path);
      }
    } else if (cmd.kind === 'paint-zone') {
      const v = validateZone(this.world, this.economy, cmd.rect);
      if (!v.ok || !v.plan) res = v;
      else {
        const applied = applyZone(this.world, v.plan, cmd.zone);
        this.economy.spend(v.cost);
        res = { ok: true, cost: v.cost, tiles: applied };
        this.roadAccess.noteRect(cmd.rect, 0); // zone paint changes which tiles need flags
        this.emitChunksForRect(cmd.rect);
      }
    } else {
      const v = validateBulldoze(this.world, this.economy, cmd.rect);
      if (!v.ok || !v.plan) res = v;
      else {
        for (const t of v.plan.tiles) this.buildings.demolishAt(t.x, t.y); // bulldoze demolishes first
        const applied = applyBulldoze(this.world, v.plan);
        this.economy.spend(v.cost);
        res = { ok: true, cost: v.cost, tiles: applied };
        this.roadAccess.noteRect(cmd.rect); // road loss may de-attach neighbours ±2
        this.emitChunksForRect(cmd.rect);
      }
    }
    if (res.ok) {
      this.events.push({ type: 'treasury-changed', balance: this.economy.balance });
      this.events.push({ type: 'command-applied', kind: cmd.kind, cost: res.cost, tiles: res.tiles });
    } else {
      this.events.push({ type: 'command-rejected', kind: cmd.kind, reason: res.reason });
    }
    return res;
  }

  private emitChunksFor(tiles: { x: number; y: number }[]): void {
    const seen = new Set<number>();
    const stride = this.world.size / CHUNK;
    for (const t of tiles) {
      if (!this.world.inBounds(t.x, t.y)) continue;
      const key = Math.floor(t.y / CHUNK) * stride + Math.floor(t.x / CHUNK);
      if (!seen.has(key)) {
        seen.add(key);
        this.events.push({ type: 'chunk-dirty', cx: Math.floor(t.x / CHUNK), cy: Math.floor(t.y / CHUNK) });
      }
    }
  }

  private emitChunksForRect(rect: { x0: number; y0: number; x1: number; y1: number }): void {
    const r = normalizeRect({ x: rect.x0, y: rect.y0 }, { x: rect.x1, y: rect.y1 });
    const stride = this.world.size / CHUNK;
    const seen = new Set<number>();
    for (let y = r.y0; y <= r.y1; y += CHUNK) {
      for (let x = r.x0; x <= r.x1; x += CHUNK) {
        const key = Math.floor(y / CHUNK) * stride + Math.floor(x / CHUNK);
        if (!seen.has(key)) {
          seen.add(key);
          this.events.push({ type: 'chunk-dirty', cx: Math.floor(x / CHUNK), cy: Math.floor(y / CHUNK) });
        }
      }
    }
  }

  drainEvents(): SimEvent[] {
    for (const c of this.buildings.drainChanges()) {
      this.events.push({ type: 'building-changed', id: c.id, x: c.x, y: c.y, state: c.state });
    }
    for (const c of this.roadAccess.drainChanges()) {
      this.events.push({ type: 'road-access-changed', x: c.x, y: c.y, blocked: c.blocked });
    }
    const out = this.events;
    this.events = [];
    return out;
  }

  snapshot(): SimSnapshot {
    return {
      tick: this.clock.tick,
      date: this.clock.date(),
      balance: this.economy.balance,
      population: this.buildings.population(),
      demand: {
        r: Math.round(this.demand.target().r),
        c: Math.round(this.demand.target().c),
        i: Math.round(this.demand.target().i),
      },
      tax: { r: this.economy.tax.r, c: this.economy.tax.c, i: this.economy.tax.i },
      // T-208: jobs/unemployment now real via the T-305 cohort ledger (C/I job openings / gravity match).
      jobs: this.cohort.state().jobs,
      unemployment: this.cohort.state().unemployment,
      bankrupt: this.economy.isBankrupt(),
      lastMonth: this.economy.lastMonth(),
      history: this.economy.history(),
      size: this.world.size,
      seed: this.world.seed,
      paused: this.clock.paused,
      speed: this.clock.speed,
      counts: { ...this.world.counts },
    };
  }

  getSaveMeta(): SaveMeta {
    const cs = this.clock.getState();
    const rs = this.rng.getState();
    return {
      tick: cs.tick,
      accumulator: cs.accumulator,
      speed: cs.speed,
      rngSeed: rs.seed,
      rngState: rs.state,
      balance: this.economy.balance,
      worldSize: this.world.size,
      worldSeed: this.world.seed,
    };
  }

  getSaveLayers(): SaveLayers {
    return this.world.toLayers();
  }

  getSaveEntities(): SaveEntities {
    return this.buildings.serialize();
  }

  getSavePolicy(): SavePolicy {
    return { tax: { ...this.economy.tax } };
  }

  loadState(meta: SaveMeta, layers: SaveLayers, entities?: SaveEntities, policy?: SavePolicy): void {
    if (meta.worldSize !== this.world.size) {
      throw new Error(`save size ${meta.worldSize} != world size ${this.world.size} (resize unsupported)`);
    }
    this.world.loadLayers(layers, meta.worldSeed);
    if (entities !== undefined) this.buildings.deserialize(entities);
    else this.buildings.reset(); // pre-T-202 saves carry no entity section → restore empty (repair note)
    this.roadAccess.recomputeForLoad(this.buildings); // derived flags follow the restored layers silently
    this.fields.invalidateStatic(); // restored terrain bytes → rebuild static base
    this.fields.recompute(); // land value is derived; rebuilt from restored world+buildings
    const speed = meta.speed === 0 || meta.speed === 1 || meta.speed === 2 || meta.speed === 3 ? meta.speed : 1;
    this.clock.setState({ tick: meta.tick, accumulator: meta.accumulator, speed });
    this.economy.balance = meta.balance;
    this.rng.setState({ seed: meta.rngSeed, state: meta.rngState });
    // T-302 (v2 save-format): restore persisted per-zone tax rates. setTax clamps, so a corrupted
    // rate is repaired rather than trusted; absence (pre-v2 save) leaves the 9/9/9 default.
    if (policy) {
      this.economy.setTax('r', policy.tax.r);
      this.economy.setTax('c', policy.tax.c);
      this.economy.setTax('i', policy.tax.i);
    }
    // Derived recompute (post-load): cohort → demand, both read restored buildings + restored tax so
    // the first post-load day matches an uninterrupted run (and RCI bars are correct immediately).
    this.cohort.recompute(this.economy.tax.r);
    this.demand.recompute();
    this.events.push({ type: 'treasury-changed', balance: this.economy.balance });
  }

  /** Canonical state hash: tick + rng + economy + layers (FNV-1a). */
  hash(): number {
    const meta = this.getSaveMeta();
    const head = new Uint8Array(32);
    const dv = new DataView(head.buffer);
    dv.setUint32(0, meta.tick, true);
    dv.setUint32(4, meta.rngSeed, true);
    dv.setUint32(8, meta.rngState, true);
    dv.setInt32(12, meta.balance, true);
    dv.setUint32(16, meta.worldSize, true);
    dv.setUint32(20, meta.worldSeed, true);
    let h = fnv1aBytes(head);
    for (const part of this.world.hashParts()) h = fnv1aBytes(part, h);
    h = this.buildings.hashInto(h);
    return h >>> 0;
  }
}
