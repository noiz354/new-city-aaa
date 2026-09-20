// PowerGrid (T-405, FR-C03 utilities): electrical nets over conductive tiles.
//
// Spec: docs/02-architecture/utilities-and-environment.md §1:
//   Conductors (v1, ADR-06 fun-first) = power lines + roads + buildings. A NET is one
//   4-connected component of conductors. Each net reports {supply, demand, members}.
//   Power is BINARY per building: a supplied net powers every member while
//   supply >= demand; on overload the net sheds load in zone order Industrial →
//   Commercial → Residential, farthest-from-plant first within a class (homes last).
//
// Derived state (function of world layers + plants + buildings): recomputed on the daily
// pass (day boundary, before growth decides) and after load; never persisted — plants and
// power-line tiles persist via the codec, the flags rebuild from them. powerActive is
// likewise DERIVED (plants > 0 || line tiles > 0), never persisted: pre-v3 saves and fresh
// maps with no grid are self-powered (spec §9 legacy-guard), so old cities keep growing.
//
// Determinism: fixed tile-index scan order, multi-source BFS in index order, shed sort by
// (zoneRank desc, depth desc, tile index asc). No RNG, no wall clock.
import { fnv1aBytes } from '../shared/crc32.js';
import type { TilePos } from '../shared/types.js';
import { BUILDING_OCCUPIED, type Buildings } from './buildings.js';
import { POWER_TUNING } from './tuning/power.js';
import type { World } from './world.js';

/** Shed class rank: higher sheds first (I → C → R). */
function shedRank(zone: number): number {
  if (zone === 3) return 3;
  if (zone === 2) return 2;
  return 1;
}

export function consumptionFor(zone: number, level: number): number {
  const table = POWER_TUNING.consumptionMw[zone];
  if (!table) return 0;
  return table[Math.max(0, Math.min(3, level))] as number;
}

export interface PowerChange {
  x: number;
  y: number;
  powered: boolean;
}

export interface PowerNetStatus {
  nets: number;
  supplied: number;
  supplyMw: number;
  demandMw: number;
  unpowered: number;
}

const DIRS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export class PowerGrid {
  private readonly world: World;
  private readonly buildings: Buildings;
  private readonly plants = new Map<number, TilePos>(); // tile index → pos (player-built, persisted)
  private flags: Uint8Array;
  private changes: PowerChange[] = [];
  private status: PowerNetStatus = { nets: 0, supplied: 0, supplyMw: 0, demandMw: 0, unpowered: 0 };

  constructor(world: World, buildings: Buildings) {
    this.world = world;
    this.buildings = buildings;
    this.flags = new Uint8Array(world.size * world.size);
  }

  /** Grid constraint live: at least one plant or one line tile exists. Else self-powered. */
  get active(): boolean {
    return this.plants.size > 0 || this.world.counts.lines > 0;
  }

  get plantCount(): number {
    return this.plants.size;
  }

  netStatus(): PowerNetStatus {
    return { ...this.status };
  }

  allPlants(): TilePos[] {
    return [...this.plants.values()].sort((a, b) => a.y - b.y || a.x - b.x);
  }

  isPlant(x: number, y: number): boolean {
    if (!this.world.inBounds(x, y)) return false;
    return this.plants.has(this.world.idx(x, y));
  }

  /** Register a player-built plant (tile occupancy is enforced by validatePlant). */
  addPlant(x: number, y: number): boolean {
    if (!this.world.inBounds(x, y) || this.isPlant(x, y)) return false;
    this.plants.set(this.world.idx(x, y), { x, y });
    return true;
  }

  removePlant(x: number, y: number): boolean {
    if (!this.world.inBounds(x, y)) return false;
    return this.plants.delete(this.world.idx(x, y));
  }

  clearPlants(): void {
    this.plants.clear();
  }

  /** Conductor truth (spec §1 ADR-06): power line, road, building, or plant tile. */
  isConductor(x: number, y: number): boolean {
    const w = this.world;
    if (!w.inBounds(x, y)) return false;
    const i = w.idx(x, y);
    return (
      (w.powerLine[i] as number) === 1 ||
      (w.road[i] as number) === 1 ||
      (w.building[i] as number) !== -1 ||
      this.plants.has(i)
    );
  }

  /**
   * Lot-level power truth (growth + icons share this). Inactive grid → every lot counts as
   * powered (legacy-guard: pre-v3 saves and plant-less maps grow exactly like v2 did).
   */
  isPowered(x: number, y: number): boolean {
    if (!this.active) return true;
    if (!this.world.inBounds(x, y)) return false;
    if (this.isPlant(x, y)) return true;
    return (this.flags[this.world.idx(x, y)] as number) === 0;
  }

  /** Conductor tile belongs to a net with ≥1 plant (overlay tint, not lot truth). */
  energizedAt(x: number, y: number): boolean {
    return this.isConductor(x, y) && this.isPowered(x, y);
  }

  /** Player-facing reason for an unpowered lot (sim-owned text; UI renders as-is). */
  unpoweredReason(): string {
    return 'No power (connect to a plant via lines/roads or build another plant)';
  }

  /** Structural aliases for view PowerView (view/power.ts programs to these names). */
  poweredAt(x: number, y: number): boolean {
    return this.isPowered(x, y);
  }

  isPlantAt(x: number, y: number): boolean {
    return this.isPlant(x, y);
  }

  /**
   * Daily pass entry point. Full flood-fill recompute (256² BFS, sub-ms): nets are global
   * (a plant anywhere joins the component), so incremental noteRect would buy nothing here.
   * Runs BEFORE growth.onDay so spawn/move-in and icons share one truth. Queues flips in
   * tile-index order. Safe to call any time (commands, tests, load).
   */
  recompute(): void {
    const w = this.world;
    const n = w.size * w.size;
    const next = new Uint8Array(n); // 1 = relevant tile without power
    let nets = 0;
    let supplied = 0;
    let supplyMw = 0;
    let demandMw = 0;

    if (this.active) {
      const comp = new Int32Array(n).fill(-1);
      const depth = new Int32Array(n).fill(-1);
      // Multi-source BFS from every plant over conductors (index-ordered sources + queue).
      const queue: number[] = [];
      for (const key of [...this.plants.keys()].sort((a, b) => a - b)) {
        comp[key] = -2; // plant source marker until claimed below
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
      // Per-component supply (plants inside) and demand (occupied buildings inside).
      const compPlants = new Uint32Array(Math.max(1, nextComp));
      const compDemand: number[] = new Array(Math.max(1, nextComp)).fill(0);
      const compMembers: number[][] = Array.from({ length: Math.max(1, nextComp) }, () => []);
      const compSupplied: boolean[] = new Array(Math.max(1, nextComp)).fill(false);
      for (let i = 0; i < n; i++) {
        const cid = comp[i] as number;
        if (cid < 0) continue;
        (compMembers[cid] as number[]).push(i);
        if (this.plants.has(i)) compPlants[cid] = (compPlants[cid] as number) + 1;
      }
      interface Load {
        idx: number;
        zone: number;
        depth: number;
        mw: number;
      }
      const compLoads: Load[][] = Array.from({ length: Math.max(1, nextComp) }, () => []);
      this.buildings.forEachLive((b) => {
        if (b.state !== BUILDING_OCCUPIED) return;
        const i = w.idx(b.x, b.y);
        const cid = comp[i] as number;
        if (cid < 0) return; // off-grid building: unpowered, counts no demand
        const mw = consumptionFor(b.zone, b.level);
        compDemand[cid] = (compDemand[cid] as number) + mw;
        (compLoads[cid] as Load[]).push({ idx: i, zone: b.zone, depth: depth[i] as number, mw });
      });
      for (let cid = 0; cid < nextComp; cid++) {
        const supply = (compPlants[cid] as number) * POWER_TUNING.plantCapacityMw;
        const demand = compDemand[cid] as number;
        supplyMw += supply;
        demandMw += demand;
        if ((compPlants[cid] as number) === 0) {
          // Dead net: every relevant member unpowered.
          compSupplied[cid] = false;
          for (const i of compMembers[cid] as number[]) {
            if (this.isRelevant(i)) next[i] = 1;
          }
          continue;
        }
        supplied++;
        compSupplied[cid] = true;
        if (demand <= supply) continue;
        // Overload: shed I farthest-first → C → R (spec §1, homes last).
        const loads = (compLoads[cid] as Load[]).sort(
          (a, b2) => shedRank(b2.zone) - shedRank(a.zone) || b2.depth - a.depth || a.idx - b2.idx,
        );
        let shed = demand - supply;
        for (const l of loads) {
          if (shed <= 0) break;
          next[l.idx] = 1;
          shed -= l.mw;
        }
      }
      // Relevant tiles on NO net (vacant lots: not conductors themselves) are powered iff
      // they touch a conductor on a supplied net — the service-drop that feeds the future
      // building. Without this, an active grid would gate ALL growth (the new house can only
      // conduct once it exists). Truly isolated lots stay unpowered.
      for (let i = 0; i < n; i++) {
        if (comp[i] !== -1 || !this.isRelevant(i)) continue;
        const x = i % w.size;
        const y = Math.floor(i / w.size);
        let fed = false;
        for (const [dx, dy] of DIRS) {
          const nx = x + dx;
          const ny = y + dy;
          if (!w.inBounds(nx, ny) || !this.isConductor(nx, ny)) continue;
          const nc = comp[w.idx(nx, ny)] as number;
          if (nc >= 0 && (compSupplied[nc] as boolean)) {
            fed = true;
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
        this.changes.push({ x: i % w.size, y: Math.floor(i / w.size), powered: next[i] === 0 });
      }
    }
    this.status = { nets, supplied, supplyMw, demandMw, unpowered };
  }

  /** After load: rebuild flags from restored layers + plants, silently (view resyncs wholesale). */
  recomputeForLoad(): void {
    this.flags.fill(0);
    this.changes.length = 0;
    // Recompute populates flags; then drop the (meaningless post-load) flip queue.
    this.recompute();
    this.changes.length = 0;
  }

  /** Currently unpowered relevant tiles (post-load full sync for the view icon layer). */
  collectUnpowered(): TilePos[] {
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
  drainChanges(): PowerChange[] {
    const out = this.changes;
    this.changes = [];
    return out;
  }

  /** Fold plant sites into the sim hash (flags are derived; layers+buildings hash separately). */
  hashInto(h: number): number {
    const keys = [...this.plants.keys()].sort((a, b) => a - b);
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
