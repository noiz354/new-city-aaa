// RoadAccess (T-204, FR-C06): canonical building attachment from
// docs/02-architecture/transportation-and-pathfinding.md §1:
//   "Buildings attach to nearest edge ≤2 tiles; no attachment → connected=false → no growth + icon"
// Implemented pre-graph as an exact radius check: a lot is connected iff any road tile lies
// within MANHATTAN distance ≤ 2 (|dx|+|dy| ≤ 2; diagonal neighbours connect). T-401 upgrades
// the source of truth to graph-edge attachment without changing this contract.
//
// Blocked flags are DERIVED state (function of world layers + buildings): recomputed on the
// daily growth pass (day-boundary, tick-order compliant) and on load; never persisted.
// Daily updates are incremental: every world-layer mutation reports its rect via noteRect,
// and updateFlags re-probes only the affected neighbourhood (Chebyshev ± RADIUS covers every
// tile whose attachment could change, with margin). Full scans happen on load only.
// Flips queue as events for the view icon layer; the queue is the only mutation channel.
import type { TilePos } from '../shared/types.js';
import type { Buildings } from './buildings.js';
import type { World } from './world.js';

/** Manhattan distance within which a road tile grants attachment (transportation §1). */
export const ROAD_ACCESS_RADIUS = 2;

export interface RoadAccessChange {
  x: number;
  y: number;
  blocked: boolean;
}

interface RectLike {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export class RoadAccess {
  private readonly world: World;
  private flags: Uint8Array; // 1 = zoned/building tile WITHOUT attachment
  private changes: RoadAccessChange[] = [];
  private readonly dirty = new Set<number>(); // tile indexes needing re-probe on next pass

  constructor(world: World) {
    this.world = world;
    this.flags = new Uint8Array(world.size * world.size);
  }

  /** Pure per-lot probe (inspector + growth checks): any road within Manhattan ≤ 2. */
  isConnected(x: number, y: number): boolean {
    const w = this.world;
    for (let dy = -ROAD_ACCESS_RADIUS; dy <= ROAD_ACCESS_RADIUS; dy++) {
      const maxDx = ROAD_ACCESS_RADIUS - Math.abs(dy);
      for (let dx = -maxDx; dx <= maxDx; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (!w.inBounds(x + dx, y + dy)) continue;
        if ((w.road[w.idx(x + dx, y + dy)] as number) === 1) return true;
      }
    }
    return false;
  }

  /**
   * Register a world mutation that may change attachment truth. Default dilation covers every
   * tile within attachment range of the rect (road edits); pass dilate 0 for mutations whose
   * blast radius is the rect itself (zone paint/unpaint). Cheap: ran through a Set, processed
   * once per daily pass in tile-index order (deterministic).
   */
  noteRect(rect: RectLike, dilate: number = ROAD_ACCESS_RADIUS): void {
    const w = this.world;
    const x0 = Math.max(0, Math.min(rect.x0, rect.x1) - dilate);
    const y0 = Math.max(0, Math.min(rect.y0, rect.y1) - dilate);
    const x1 = Math.min(w.size - 1, Math.max(rect.x0, rect.x1) + dilate);
    const y1 = Math.min(w.size - 1, Math.max(rect.y0, rect.y1) + dilate);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.dirty.add(w.idx(x, y));
  }

  /**
   * Daily pass entry point: re-probe only tiles near recent mutations (see noteRect),
   * queueing flips in tile-index order (deterministic). Runs before growth decisions so the
   * growth engine and the icon layer always share one truth.
   */
  updateFlags(buildings: Buildings): void {
    if (this.dirty.size === 0) return;
    const TODO = [...this.dirty].sort((a, b) => a - b);
    this.dirty.clear();
    for (const i of TODO) this.refresh(i);
    void buildings; // flags derive from layers; consumers read buildings separately
  }

  /** Recompute one tile's flag; emit a flip event iff it changed (or clear as inv. check). */
  private refresh(i: number): void {
    const w = this.world;
    const relevant = (w.zone[i] as number) !== 0 || (w.building[i] as number) !== -1;
    const blocked = relevant && !this.isConnected(i % w.size, Math.floor(i / w.size));
    const prev = this.flags[i] as number;
    if (blocked !== (prev === 1)) {
      this.flags[i] = blocked ? 1 : 0;
      this.changes.push({ x: i % w.size, y: Math.floor(i / w.size), blocked });
    }
  }

  /** Player-facing reason for a blocked lot (sim-owned text; UI renders as-is). */
  blockedReason(): string {
    return 'No road access (road within 2 tiles required)';
  }

  /**
   * After load: rebuild flags from the freshly restored layers, silently (the view is
   * re-synced wholesale via collectBlocked, so no flip events belong in the queue).
   */
  recomputeForLoad(buildings: Buildings): void {
    this.flags.fill(0);
    this.dirty.clear();
    const w = this.world;
    for (let i = 0; i < w.size * w.size; i++) this.refresh(i);
    this.changes.length = 0;
    void buildings;
  }

  /** Currently blocked tiles (post-load full sync for the view icon layer). */
  collectBlocked(): TilePos[] {
    const out: TilePos[] = [];
    for (let y = 0; y < this.world.size; y++) {
      for (let x = 0; x < this.world.size; x++) {
        if ((this.flags[this.world.idx(x, y)] as number) === 1) out.push({ x, y });
      }
    }
    return out;
  }

  /** Take queued flips (drain-and-clear, same contract as Sim.drainEvents). */
  drainChanges(): RoadAccessChange[] {
    const out = this.changes;
    this.changes = [];
    return out;
  }
}
