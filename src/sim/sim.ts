// Sim: owns World + Clock + Economy + Rng; executes Commands; emits events.
// Determinism: identical seed + command sequence + tick counts => identical hash.
import type {
  Command,
  CommandResult,
  SaveEntities,
  SaveLayers,
  SaveMeta,
  SavePolicy,
  SavePower,
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
import {
  applyBulldoze,
  applyPowerLine,
  applyRoad,
  applyZone,
  validateBulldoze,
  validatePlant,
  validatePowerLine,
  validateRoad,
  validateZone,
} from './commands.js';
import { Economy } from './economy.js';
import { Growth } from './growth.js';
import { PowerGrid } from './power.js';
import { RoadAccess } from './road-access.js';
import { RoadGraph } from './roadGraph.js';
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
  readonly power: PowerGrid; // T-405: electrical nets over lines/roads/buildings (derived truth)
  readonly cohort: Cohort; // T-305: residents/jobs/gravity match/unemployment/happiness
  readonly roadGraph: RoadGraph; // T-401: node/edge road graph (derived; traffic A* + power seam)
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
    this.power = new PowerGrid(this.world, this.buildings); // derived; empty grid ⇒ inactive ⇒ self-powered
    this.roadGraph = new RoadGraph(this.world); // derived; built eagerly from the (empty) road layer
    this.roadGraph.rebuildAll();
    this.cohort = new Cohort(this.world, this.buildings);
    this.demand = new Demand(this.world, this.buildings, { cohort: this.cohort, getTax: () => this.economy.tax });
    this.fields = new Fields(this.world, this.buildings);
    this.fields.recompute(); // fields valid from t=0 (growth scores read them day 1)
    this.growth = new Growth(this.world, this.buildings, this.roadAccess, this.power, this.demand, this.fields);
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
      // Power recompute FIRST in the daily pass: growth spawn/move-in + icons share one truth.
      this.power.recompute();
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
    const isPlant = (x: number, y: number): boolean => this.power.isPlant(x, y);
    let res: CommandResult;
    if (cmd.kind === 'place-road') {
      const v = validateRoad(this.world, this.economy, cmd.path, isPlant);
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
        if (x1 >= x0) { this.roadGraph.noteRect({ x0, y0, x1, y1 }); this.roadGraph.flush(); } // T-401 structural rebuild
        this.emitChunksFor(cmd.path);
      }
    } else if (cmd.kind === 'paint-zone') {
      const v = validateZone(this.world, this.economy, cmd.rect, isPlant);
      if (!v.ok || !v.plan) res = v;
      else {
        const applied = applyZone(this.world, v.plan, cmd.zone);
        this.economy.spend(v.cost);
        res = { ok: true, cost: v.cost, tiles: applied };
        this.roadAccess.noteRect(cmd.rect, 0); // zone paint changes which tiles need flags
        this.emitChunksForRect(cmd.rect);
      }
    } else if (cmd.kind === 'place-power-line') {
      const v = validatePowerLine(this.world, this.economy, cmd.path, isPlant);
      if (!v.ok || !v.plan) res = v;
      else {
        const applied = applyPowerLine(this.world, v.plan);
        this.economy.spend(v.cost);
        res = { ok: true, cost: v.cost, tiles: applied };
        this.power.recompute(); // immediate truth: icons/snapshot share it before the next tick
        this.events.push({ type: 'power-line-changed' }); // view resyncs the line projection
        this.emitChunksFor(cmd.path);
      }
    } else if (cmd.kind === 'place-plant') {
      const v = validatePlant(this.world, this.economy, cmd.x, cmd.y, isPlant);
      if (!v.ok) res = v;
      else {
        this.buildings.demolishAt(cmd.x, cmd.y); // plant clears buildings (no refund, like roads)
        this.world.clearZone(cmd.x, cmd.y); // plant clears zone paint (no refund, like roads)
        this.power.addPlant(cmd.x, cmd.y);
        this.economy.spend(v.cost);
        res = { ok: true, cost: v.cost, tiles: 1 };
        this.power.recompute(); // grid activates immediately (no one-tick dark start)
        this.events.push({ type: 'plant-changed', x: cmd.x, y: cmd.y, present: true });
        this.emitChunksFor([{ x: cmd.x, y: cmd.y }]);
      }
    } else {
      const v = validateBulldoze(this.world, this.economy, cmd.rect);
      if (!v.ok || !v.plan) res = v;
      else {
        for (const t of v.plan.tiles) this.buildings.demolishAt(t.x, t.y); // bulldoze demolishes first
        let removedPlant = false;
        for (const t of v.plan.tiles) {
          if (this.power.removePlant(t.x, t.y)) {
            removedPlant = true;
            this.events.push({ type: 'plant-changed', x: t.x, y: t.y, present: false });
          }
        }
        const hadLines = v.plan.tiles.some(
          (t) => (this.world.powerLine[this.world.idx(t.x, t.y)] as number) === 1,
        );
        const applied = applyBulldoze(this.world, v.plan);
        this.economy.spend(v.cost);
        if (removedPlant || hadLines) this.power.recompute(); // demolition follows grid truth immediately
        res = { ok: true, cost: v.cost, tiles: applied };
        this.roadAccess.noteRect(cmd.rect); // road loss may de-attach neighbours ±2
        this.roadGraph.noteRect(cmd.rect); this.roadGraph.flush(); // T-401: road loss rebuilds affected components
        if (hadLines) this.events.push({ type: 'power-line-changed' });
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
    for (const c of this.power.drainChanges()) {
      this.events.push({ type: 'power-changed', x: c.x, y: c.y, powered: c.powered });
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
      power: (() => {
        const s = this.power.netStatus();
        return {
          active: this.power.active,
          plants: this.power.plantCount,
          nets: s.nets,
          supplyMw: s.supplyMw,
          demandMw: s.demandMw,
          unpowered: s.unpowered,
        };
      })(),
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

  getSavePower(): SavePower {
    return { plants: this.power.allPlants() };
  }

  loadState(
    meta: SaveMeta,
    layers: SaveLayers,
    entities?: SaveEntities,
    policy?: SavePolicy,
    power?: SavePower,
  ): void {
    if (meta.worldSize !== this.world.size) {
      throw new Error(`save size ${meta.worldSize} != world size ${this.world.size} (resize unsupported)`);
    }
    this.world.loadLayers(layers, meta.worldSeed);
    if (entities !== undefined) this.buildings.deserialize(entities);
    else this.buildings.reset(); // pre-T-202 saves carry no entity section → restore empty (repair note)
    this.roadAccess.recomputeForLoad(this.buildings); // derived flags follow the restored layers silently
    this.roadGraph.rebuildAll(); // T-401: graph is derived; rebuilt canonically from restored road layer
    // T-405 (v3 save-format): restore persisted plant sites, then rebuild derived power flags.
    // Absence (pre-v3 save) leaves zero plants; with no lines either the grid stays inactive and
    // the city runs self-powered (spec §9 legacy-guard — old saves keep growing).
    this.power.clearPlants();
    for (const p of power?.plants ?? []) this.power.addPlant(p.x, p.y);
    this.power.recomputeForLoad();
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
    h = this.power.hashInto(h); // T-405: plant sites are sim state (flags derive from them)
    return h >>> 0;
  }
}
