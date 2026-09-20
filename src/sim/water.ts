// WaterGrid (T-406, FR-C03 utilities): pressure nets over conductive tiles.
//
// Spec: docs/02-architecture/utilities-and-environment.md §1 + docs/05 §A3:
//   Conductors (v1, ADR-06 fun-first) = power lines + roads + buildings — water rides the
//   SAME conductors as power (explicit pipes are a stretch goal with a frozen waterPipe
//   layer id reserved). A NET is one 4-connected component of conductors. Each tower
//   supplies towerCapacityKl; occupied buildings draw demandKl(zone, level).
//   Per-tile pressure = 1 − distTiles·K − loadFactor·M where distTiles is the BFS depth
//   from the nearest tower and loadFactor = netDemand / netSupply. A tile is watered iff
//   pressure is strictly above wateredThreshold (0.30). Far buildings on a loaded net go
//   unwatered until a second tower lands nearby (UJ-04 water analogue).
//
// Derived state (function of world layers + towers + buildings): recomputed on the daily
// pass (day boundary, after power, before growth decides) and after load; never
// persisted — tower sites persist via the codec, flags/pressures rebuild from them.
// waterActive is likewise DERIVED (towers > 0), never persisted: pre-v4 saves and fresh
// maps with no towers are self-watered (spec §9 legacy-guard), so old cities keep growing.
//
// Determinism: fixed tile-index scan order, multi-source BFS in index order. No RNG,
// no wall clock.
import { fnv1aBytes } from '../shared/crc32.js';
import type { TilePos } from '../shared/types.js';
import { BUILDING_OCCUPIED, type Buildings } from './buildings.js';
import { WATER_TUNING } from './tuning/water.js';
import type { PowerGrid } from './power.js';
import type { World } from './world.js';

/** kL drawn by one OCCUPIED building (level clamped 0..3, mirrors consumptionFor). */
export function demandFor(zone: number, level: number): number {
  const table = WATER_TUNING.demandKl[zone as 1 | 2 | 3];
  if (!table) return 0;
  return table[Math.max(0, Math.min(3, level))] as number;
}

export interface WaterChange {
  x: number;
  y: number;
  /** True when the tile just became watered (false = just went unwatered). */
  watered: boolean;
}

export interface WaterNetStatus {
  nets: number;
  supplied: number;
  supplyKl: number;
  demandKl: number;
  unpowered: number;
}

const DIRS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export class WaterGrid {
  private readonly world: World;
  private readonly buildings: Buildings;
  private readonly power: PowerGrid;
  private readonly towers = new Map<number, TilePos>(); // tile index → pos (player-built, persisted)
  private flags: Uint8Array;
  private press: Float32Array;
  private changes: WaterChange[] = [];
  private status: WaterNetStatus = { nets: 0, supplied: 0, supplyKl: 0, demandKl: 0, unpowered: 0 };

  constructor(world: World, buildings: Buildings, power: PowerGrid) {
    this.world = world;
    this.buildings = buildings;
    this.power = power;
    this.flags = new Uint8Array(world.size * world.size);
    this.press = new Float32Array(world.size * world.size);
  }

  /** Grid constraint live: at least one tower exists. Else self-watered. */
  get active(): boolean {
    return this.towers.size > 0;
  }

  get towerCount(): number {
    return this.towers.size;
  }

  netStatus(): WaterNetStatus {
    return { ...this.status };
  }

  allTowers(): TilePos[] {
    return [...this.towers.values()].sort((a, b) => a.y - b.y || a.x - b.x);
  }

  isTower(x: number, y: number): boolean {
    if (!this.world.inBounds(x, y)) return false;
    return this.towers.has(this.world.idx(x, y));
  }

  /** Register a player-built tower (tile occupancy is enforced by validateTower). */
  addTower(x: number, y: number): boolean {
    if (!this.world.inBounds(x, y) || this.isTower(x, y)) return false;
    this.towers.set(this.world.idx(x, y), { x, y });
    return true;
  }

  removeTower(x: number, y: number): boolean {
    if (!this.world.inBounds(x, y)) return false;
    return this.towers.delete(this.world.idx(x, y));
  }

  clearTowers(): void {
    this.towers.clear();
  }

  /**
   * Conductor truth (spec §1 ADR-06, no pipes in T-406): water rides power's conductors
   * (line, road, building, plant tile) plus tower tiles.
   */
  isConductor(x: number, y: number): boolean {
    if (!this.world.inBounds(x, y)) return false;
    return this.power.isConductor(x, y) || this.towers.has(this.world.idx(x, y));
  }

  /**
   * Lot-level water truth (growth + icons share this). Inactive grid → every lot counts as
   * watered (legacy-guard: pre-v4 saves and tower-less maps grow exactly like v3 did).
   */
  isWatered(x: number, y: number): boolean {
    if (!this.active) return true;
    if (!this.world.inBounds(x, y)) return false;
    if (this.isTower(x, y)) return true;
    return (this.flags[this.world.idx(x, y)] as number) === 0;
  }

  /** Last-computed tile pressure (overlay tint, not lot truth). 0 when off-grid/inactive. */
  pressureAt(x: number, y: number): number {
    if (!this.world.inBounds(x, y)) return 0;
    return this.press[this.world.idx(x, y)] as number;
  }

  /** Player-facing reason for an unwatered lot (sim-owned text; UI renders as-is). */
  unwateredReason(): string {
    return 'No water (build a tower in range or add a second tower)';
  }

  /** Structural aliases for the view (view/water.ts programs to these names). */
  wateredAt(x: number, y: number): boolean {
    return this.isWatered(x, y);
  }

  isTowerAt(x: number, y: number): boolean {
    return this.isTower(x, y);
  }

  /**
   * Daily pass entry point. Full flood-fill recompute (256² BFS, sub-ms): nets are global
   * (a tower anywhere joins the component), so incremental noteRect would buy nothing here.
   * Runs AFTER power.recompute and BEFORE growth.onDay so spawn/move-in and icons share
   * one truth. Queues flips in tile-index order. Safe to call any time (commands, tests, load).
   */
  recompute(): void {
    const w = this.world;
    const n = w.size * w.size;
    const next = new Uint8Array(n); // 1 = relevant tile without water
    const press = new Float32Array(n);
    let nets = 0;
    let supplied = 0;
    let supplyKl = 0;
    let demandKl = 0;

    if (this.active) {
      const comp = new Int32Array(n).fill(-1);
      const depth = new Int32Array(n).fill(-1);
      // Multi-source BFS from every tower over conductors (index-ordered sources + queue).
      const queue: number[] = [];
      for (const key of [...this.towers.keys()].sort((a, b) => a - b)) {
        comp[key] = -2; // tower source marker until claimed below
        depth[key] = 0;
        queue.push(key);
      }
      for (let qi = 0; qi < queue.length; qi++) {
        const i = queue[qi] as number;
        const x = i % w.size;
        const y = Math.floor(i / w.size);
        for (const [dx, dy] of DIRS) {
          const nx = x + dx;
          const ny = y + dy;
          if (!w.inBounds(nx, ny)) continue;
          const ni = w.idx(nx, ny);
          if (depth[ni] !== -1 || !this.isConductor(nx, ny)) continue;
          depth[ni] = (depth[i] as number) + 1;
          comp[ni] = -2;
          queue.push(ni);
        }
      }
      // Assign component ids in tile-index order (deterministic ids for tests/telemetry).
      let nextComp = 0;
      for (let i = 0; i < n; i++) {
        if (comp[i] !== -2) continue;
        const cid = nextComp++;
        const stack: number[] = [i];
        comp[i] = cid;
        while (stack.length > 0) {
          const c = stack.pop() as number;
          const cx = c % w.size;
          const cy = Math.floor(c / w.size);
          for (const [dx, dy] of DIRS) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (!w.inBounds(nx, ny)) continue;
            const ni = w.idx(nx, ny);
            if (comp[ni] === -2) {
              comp[ni] = cid;
              stack.push(ni);
            }
          }
        }
      }
      nets = nextComp;
      // Per-component supply (towers inside) and demand (occupied buildings inside).
      const compTowers = new Uint32Array(Math.max(1, nextComp));
      const compDemand: number[] = new Array(Math.max(1, nextComp)).fill(0);
      const compSupplied: boolean[] = new Array(Math.max(1, nextComp)).fill(false);
      const compMembers: number[][] = Array.from({ length: Math.max(1, nextComp) }, () => []);
      for (let i = 0; i < n; i++) {
        const cid = comp[i] as number;
        if (cid < 0) continue;
        (compMembers[cid] as number[]).push(i);
        if (this.towers.has(i)) compTowers[cid] = (compTowers[cid] as number) + 1;
      }
      this.buildings.forEachLive((b) => {
        if (b.state !== BUILDING_OCCUPIED) return;
        const i = w.idx(b.x, b.y);
        const cid = comp[i] as number;
        if (cid < 0) return; // off-grid building: unwatered, counts no demand
        const kl = demandFor(b.zone, b.level);
        compDemand[cid] = (compDemand[cid] as number) + kl;
      });
      const K = WATER_TUNING.pressureK;
      const M = WATER_TUNING.pressureM;
      const T = WATER_TUNING.wateredThreshold;
      for (let cid = 0; cid < nextComp; cid++) {
        const supply = (compTowers[cid] as number) * WATER_TUNING.towerCapacityKl;
        const demand = compDemand[cid] as number;
        supplyKl += supply;
        demandKl += demand;
        if ((compTowers[cid] as number) === 0) {
          // Dead net: every relevant member unwatered.
          compSupplied[cid] = false;
          for (const i of compMembers[cid] as number[]) {
            if (this.isRelevant(i)) next[i] = 1;
          }
          continue;
        }
        supplied++;
        compSupplied[cid] = true;
        const load = supply > 0 ? demand / supply : 1;
        for (const i of compMembers[cid] as number[]) {
          const p = 1 - (depth[i] as number) * K - load * M;
          press[i] = p;
          if (this.isRelevant(i) && !(p > T)) next[i] = 1;
        }
      }
      // Service-drop (T-405 §deadlock fix, mirrored): vacant zoned lots are NOT conductors,
      // so an active grid would otherwise gate ALL growth. An off-net relevant tile is
      // watered iff a 4-neighbour conductor sits on a supplied net with pressure one extra
      // K-hop above threshold.
      for (let i = 0; i < n; i++) {
        if (comp[i] !== -1 || !this.isRelevant(i)) continue;
        const x = i % w.size;
        const y = Math.floor(i / w.size);
        let fed = false;
        for (const [dx, dy] of DIRS) {
          const nx = x + dx;
          const ny = y + dy;
          if (!w.inBounds(nx, ny)) continue;
          const ni = w.idx(nx, ny);
          const nc = comp[ni] as number;
          if (nc >= 0 && (compSupplied[nc] as boolean) && (press[ni] as number) - K > T) {
            fed = true;
            press[i] = (press[ni] as number) - K;
            break;
          }
        }
        if (!fed) next[i] = 1;
      }
    }

    let unpowered = 0;
    for (let i = 0; i < n; i++) {
      if (next[i] === 1) unpowered++;
      if (next[i] !== (this.flags[i] as number)) {
        this.flags[i] = next[i] as number;
        this.changes.push({ x: i % w.size, y: Math.floor(i / w.size), watered: next[i] === 0 });
      }
    }
    this.press = press;
    this.status = { nets, supplied, supplyKl, demandKl, unpowered };
  }

  /** After load: rebuild flags from restored layers + towers, silently (view resyncs wholesale). */
  recomputeForLoad(): void {
    this.flags.fill(0);
    this.press.fill(0);
    this.changes.length = 0;
    // Recompute populates flags; then drop the (meaningless post-load) flip queue.
    this.recompute();
    this.changes.length = 0;
  }

  /** Currently unwatered relevant tiles (post-load full sync for the view icon layer). */
  collectUnwatered(): TilePos[] {
    const out: TilePos[] = [];
    const w = this.world;
    for (let y = 0; y < w.size; y++) {
      for (let x = 0; x < w.size; x++) {
        if ((this.flags[w.idx(x, y)] as number) === 1) out.push({ x, y });
      }
    }
    return out;
  }

  /** Take queued flips (drain-and-clear, same contract as Sim.drainEvents). */
  drainChanges(): WaterChange[] {
    const out = this.changes;
    this.changes = [];
    return out;
  }

  /** Fold tower sites into the sim hash (flags are derived; layers+buildings hash separately). */
  hashInto(h: number): number {
    const keys = [...this.towers.keys()].sort((a, b) => a - b);
    const buf = new Uint8Array(keys.length * 4);
    const dv = new DataView(buf.buffer);
    keys.forEach((k, j) => dv.setUint32(j * 4, k, true));
    return fnv1aBytes(buf, h);
  }

  private isRelevant(i: number): boolean {
    const w = this.world;
    return (w.zone[i] as number) !== 0 || (w.building[i] as number) !== -1;
  }
}
