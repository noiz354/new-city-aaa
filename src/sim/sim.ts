// Sim: owns World + Clock + Economy + Rng; executes Commands; emits events.
// Determinism: identical seed + command sequence + tick counts => identical hash.
import type {
  Command,
  CommandResult,
  SaveLayers,
  SaveMeta,
  SimEvent,
  SimSnapshot,
} from '../shared/types.js';
import { fnv1aBytes } from '../shared/crc32.js';
import { Buildings } from './buildings.js';
import { Clock } from './clock.js';
import { normalizeRect } from '../shared/grid.js';
import { applyBulldoze, applyRoad, applyZone, validateBulldoze, validateRoad, validateZone } from './commands.js';
import { Economy } from './economy.js';
import { Rng } from './rng.js';
import { CHUNK } from '../shared/types.js';
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
  private events: SimEvent[] = [];

  constructor(opts: SimOptions = {}) {
    this.world = new World({ seed: opts.seed, size: opts.size, preset: opts.preset });
    this.clock = new Clock(opts.now ?? (() => 0));
    this.economy = new Economy();
    this.rng = new Rng(this.world.seed ^ 0x51ed2709);
    this.buildings = new Buildings(this.world);
  }

  update(realDtMs: number): void {
    this.clock.update(realDtMs, (tick) => this.onTick(tick));
  }

  protected onTick(tick: number): void {
    // Frozen tick order (simulation-architecture §2): growth stage drives lifecycle timers.
    this.buildings.onTick(tick);
  }

  execute(cmd: Command): CommandResult {
    let res: CommandResult;
    if (cmd.kind === 'place-road') {
      const v = validateRoad(this.world, this.economy, cmd.path);
      if (!v.ok || !v.plan) res = v;
      else {
        for (const t of v.plan.newTiles) this.buildings.demolishAt(t.x, t.y); // road clears buildings
        const applied = applyRoad(this.world, v.plan);
        this.economy.spend(v.cost);
        res = { ok: true, cost: v.cost, tiles: applied };
        this.emitChunksFor(cmd.path);
      }
    } else if (cmd.kind === 'paint-zone') {
      const v = validateZone(this.world, this.economy, cmd.rect);
      if (!v.ok || !v.plan) res = v;
      else {
        const applied = applyZone(this.world, v.plan, cmd.zone);
        this.economy.spend(v.cost);
        res = { ok: true, cost: v.cost, tiles: applied };
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

  loadState(meta: SaveMeta, layers: SaveLayers): void {
    if (meta.worldSize !== this.world.size) {
      throw new Error(`save size ${meta.worldSize} != world size ${this.world.size} (resize unsupported)`);
    }
    this.world.loadLayers(layers, meta.worldSeed);
    this.buildings.reset(); // entity persistence lands in T-202 (codec section 4); never keep stale records
    const speed = meta.speed === 0 || meta.speed === 1 || meta.speed === 2 || meta.speed === 3 ? meta.speed : 1;
    this.clock.setState({ tick: meta.tick, accumulator: meta.accumulator, speed });
    this.economy.balance = meta.balance;
    this.rng.setState({ seed: meta.rngSeed, state: meta.rngState });
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
