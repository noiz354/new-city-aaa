// Buildings: authoritative lifecycle state for structures (T-201).
//
// Canonical state machine (docs/03-game-design/building-and-zoning-systems.md §2,
// scope VS-2a — rubble/burning/damaged deferred to T-603 disaster work):
//
//   ┌────────┐  startConstruction (growth, T-202)   ┌──────────────┐
//   │ VACANT │ ───────────────────────────────────▶ │ CONSTRUCTION │
//   └────────┘                                      └──────────────┘
//        ▲                                                  │ onTick: 3 game-days (72 ticks, tuning)
//        │ demolishAt (bulldoze, from ANY state)            ▼
//        │                                            ┌──────────┐  transition   ┌────────────┐
//        └─────────────────────────────────────────── │ OCCUPIED │ ◀───────────▶ │ ABANDONED  │
//                                                     └──────────┘  ⇄ (neglect/  └────────────┘
//                                                                     recovery drivers: VS-2/3)
// Invariants enforced here:
//   - a building exists only on a zoned, non-road, in-bounds tile (design §1 "not water/road/occupied");
//   - `world.building[tile]` is the tile→buildingId index, written EXCLUSIVELY by this class;
//   - occupants > 0 only while OCCUPIED (population() derives from occupied buildings);
//   - ids are stable record slots (free-list reuse); iteration order is deterministic by id.
// Store is AoS entities (identity matters, 10k-scale); world layers stay SoA. No RNG, no wall clock:
// transitions are driven by explicit calls + sim ticks, so identical input sequences are deterministic.
//
// Persistence (FR-P01, landed T-202): codec section 4 (sver 1) stores per-slot data so stable
// ids survive save/load; older saves lack the section → loadState restores empty (repair note);
// older decoders skip the unknown section gracefully. The determinism hash covers the same state.
import { assert } from '../shared/assert.js';
import { fnv1aBytes } from '../shared/crc32.js';
import type { SaveEntities, ZoneId } from '../shared/types.js';
import { BUILDING_TUNING } from './tuning/buildings.js';
import type { World } from './world.js';

/** Ticks a lot spends under construction before becoming occupied (tuning; re-exported for tests/UI). */
export const CONSTRUCTION_TICKS = BUILDING_TUNING.constructionTicks;

/** Lot state on a tile. VACANT is the ABSENCE of a building record — no entity is stored for it. */
export const LOT_VACANT = 0 as const;
export const BUILDING_CONSTRUCTION = 1 as const;
export const BUILDING_OCCUPIED = 2 as const;
export const BUILDING_ABANDONED = 3 as const;
export type BuildingState = typeof BUILDING_CONSTRUCTION | typeof BUILDING_OCCUPIED | typeof BUILDING_ABANDONED;
export type LotState = typeof LOT_VACANT | BuildingState;

export interface Building {
  readonly id: number; // stable slot index into the store
  readonly x: number;
  readonly y: number;
  /** Zone the building grew on (1=R, 2=C, 3=I); snapshot at spawn, lot zone may change only after demolish. */
  readonly zone: ZoneId;
  /** LOT_VACANT marks a tombstoned slot awaiting reuse; live buildings never observe it via get(). */
  state: LotState;
  /** Density level 1..3 (FR-S04); upgrades are a VS-2/3 concern, births are always L1. */
  level: number;
  /** Residents (R) / workers (C/I) currently housed; > 0 only while OCCUPIED. */
  occupants: number;
  /** Sim tick at which the current state began (drives the construction timer + inspector). */
  stateSinceTick: number;
}

/** Lifecycle mutation notice; Sim republishes these as 'building-changed' SimEvents. */
export interface BuildingChange {
  id: number;
  x: number;
  y: number;
  state: LotState;
}

export class Buildings {
  private readonly world: World;
  private readonly records: Building[] = [];
  private readonly free: number[] = []; // reusable slot ids of demolished buildings
  private pending = 0; // lots under construction (fast no-op guard for onTick)
  private changes: BuildingChange[] = [];

  constructor(world: World) {
    this.world = world;
  }

  /** Number of standing buildings (construction included). */
  get count(): number {
    return this.records.length - this.free.length;
  }

  get(id: number): Building | undefined {
    const b = this.records[id];
    return b !== undefined && b.state !== LOT_VACANT ? b : undefined;
  }

  /** Iterate every standing building in deterministic id order (tombstones skipped). */
  forEachLive(cb: (b: Building) => void): void {
    for (const b of this.records) {
      if (b.state !== LOT_VACANT) cb(b);
    }
  }

  /** Lifecycle state of the lot at (x, y); out-of-bounds reads as VACANT. */
  stateAt(x: number, y: number): LotState {
    if (!this.world.inBounds(x, y)) return LOT_VACANT;
    const id = this.world.building[this.world.idx(x, y)] as number;
    return id === -1 ? LOT_VACANT : ((this.records[id]?.state ?? LOT_VACANT) as LotState);
  }

  /** vacant → construction. Returns the new building, or null when the lot may not hold one. */
  startConstruction(x: number, y: number, tick: number): Building | null {
    const w = this.world;
    if (!w.inBounds(x, y)) return null;
    const i = w.idx(x, y);
    if ((w.road[i] as number) === 1) return null;
    const z = w.zone[i] as number;
    if (z < 1 || z > 3) return null; // unzoned lot
    if ((w.building[i] as number) !== -1) return null; // lot already holds a building
    const id = this.free.length > 0 ? (this.free.pop() as number) : this.records.length;
    const building: Building = {
      id,
      x,
      y,
      zone: z as ZoneId,
      state: BUILDING_CONSTRUCTION,
      level: 1,
      occupants: 0,
      stateSinceTick: tick,
    };
    this.records[id] = building;
    w.building[i] = id;
    this.pending++;
    this.changes.push({ id, x, y, state: BUILDING_CONSTRUCTION });
    return building;
  }

  /**
   * Tick hook, called by Sim in tick order (growth stage). construction → occupied exactly
   * CONSTRUCTION_TICKS ticks after spawn. Completions mutate in id order: deterministic.
   * O(records) while anything is building, O(1) otherwise; no per-tick allocation.
   */
  onTick(tick: number): void {
    if (this.pending === 0) return;
    for (const b of this.records) {
      if (b.state === BUILDING_CONSTRUCTION && tick - b.stateSinceTick >= CONSTRUCTION_TICKS) {
        b.state = BUILDING_OCCUPIED;
        b.stateSinceTick = tick;
        this.pending--;
        this.changes.push({ id: b.id, x: b.x, y: b.y, state: BUILDING_OCCUPIED });
      }
    }
  }

  /**
   * System-driven transition between the ⇄ pair only (occupied ↔ abandoned). Every other
   * move has exactly one driver: startConstruction (spawn), onTick (completion), demolishAt
   * (bulldoze) — so no caller can corrupt the machine. Neglect/recovery wrappers live with
   * their driver systems (VS-2/3); this is the single validated doorway they must use.
   */
  transition(id: number, to: BuildingState, tick: number): boolean {
    const b = this.records[id];
    if (b === undefined || b.state === LOT_VACANT) return false;
    const allowed =
      (b.state === BUILDING_OCCUPIED && to === BUILDING_ABANDONED) ||
      (b.state === BUILDING_ABANDONED && to === BUILDING_OCCUPIED);
    if (!allowed) return false;
    b.state = to;
    b.stateSinceTick = tick;
    if (to === BUILDING_ABANDONED) b.occupants = 0; // invariant: occupants only while occupied
    this.changes.push({ id: b.id, x: b.x, y: b.y, state: to });
    return true;
  }

  /** Set occupants of an OCCUPIED building (growth/jobs systems). Rejected otherwise (invariant). */
  setOccupants(id: number, n: number): boolean {
    const b = this.records[id];
    if (b === undefined || b.state !== BUILDING_OCCUPIED) return false;
    if (!Number.isInteger(n) || n < 0) return false;
    b.occupants = n;
    return true;
  }

  /** Aggregate population: occupants of OCCUPIED buildings only (spec §3.4; UI reads this via snapshot). */
  population(): number {
    let pop = 0;
    for (const b of this.records) {
      if (b.state === BUILDING_OCCUPIED) pop += b.occupants;
    }
    return pop;
  }

  /**
   * Bulldoze doorway: any state → vacant. Tombstones the record (slot goes to the reuse
   * free-list) and clears the tile index. Idempotent-safe: false when the lot has no building.
   */
  demolishAt(x: number, y: number): boolean {
    const w = this.world;
    if (!w.inBounds(x, y)) return false;
    const i = w.idx(x, y);
    const id = w.building[i] as number;
    if (id === -1) return false;
    w.building[i] = -1;
    const b = this.records[id];
    if (b === undefined) return false; // unreachable via this class; defensive against raw index writes
    if (b.state === BUILDING_CONSTRUCTION) this.pending--;
    b.state = LOT_VACANT;
    b.occupants = 0;
    this.free.push(id);
    this.changes.push({ id, x, y, state: LOT_VACANT });
    return true;
  }

  /**
   * Drop all records (load path). The world's tile index must already be clean —
   * world.loadLayers() re-fills `world.building` with -1 before Sim calls this.
   */
  reset(): void {
    this.records.length = 0;
    this.free.length = 0;
    this.pending = 0;
    this.changes.length = 0;
  }

  /** Take pending lifecycle notices (drain-and-clear, same contract as Sim.drainEvents). */
  drainChanges(): BuildingChange[] {
    const out = this.changes;
    this.changes = [];
    return out;
  }

  /** Serialize the whole store, slot order preserved so stable ids survive (codec section 4). */
  serialize(): SaveEntities {
    return {
      slots: this.records.map((b) => ({
        state: b.state,
        x: b.x,
        y: b.y,
        zone: b.zone,
        level: b.level,
        occupants: b.occupants,
        stateSinceTick: b.stateSinceTick,
      })),
    };
  }

  /**
   * Restore from a save (called after world.loadLayers). Validates every slot against the
   * freshly loaded layers: a corrupt entity section fails loudly here rather than desyncing.
   */
  deserialize(data: SaveEntities): void {
    this.reset();
    const w = this.world;
    assert(data.slots.length <= w.size * w.size, 'entity section: too many slots');
    for (let id = 0; id < data.slots.length; id++) {
      const s = data.slots[id] as Building;
      if (s.state === LOT_VACANT) {
        this.records.push({ id, x: 0, y: 0, zone: 0, state: LOT_VACANT, level: 0, occupants: 0, stateSinceTick: 0 });
        this.free.push(id);
        continue;
      }
      assert(s.state >= 1 && s.state <= 3, `entity ${id}: bad state ${s.state}`);
      assert(w.inBounds(s.x, s.y), `entity ${id}: out of bounds (${s.x},${s.y})`);
      const i = w.idx(s.x, s.y);
      assert((w.road[i] as number) !== 1, `entity ${id}: building on road tile`);
      assert((w.zone[i] as number) === s.zone, `entity ${id}: zone mismatch vs layers`);
      assert((w.building[i] as number) === -1, `entity ${id}: two buildings on one tile`);
      assert(s.zone >= 1 && s.zone <= 3 && s.level >= 1 && s.occupants >= 0, `entity ${id}: invalid fields`);
      this.records.push({ ...s, id, zone: s.zone as ZoneId });
      w.building[i] = id;
      if (s.state === BUILDING_CONSTRUCTION) this.pending++;
    }
  }

  /**
   * Fold building state into the running FNV-1a hash (deterministic: live records in id
   * order). Keeps save/continue-vs-uninterrupted equivalence honest once growth exists.
   */
  hashInto(h: number): number {
    const buf = new Uint8Array(4 + this.count * 17);
    const dv = new DataView(buf.buffer);
    dv.setUint32(0, this.count, true);
    let o = 4;
    for (const b of this.records) {
      if (b.state === LOT_VACANT) continue;
      dv.setUint32(o, b.id, true);
      dv.setUint16(o + 4, b.x, true);
      dv.setUint16(o + 6, b.y, true);
      dv.setUint8(o + 8, b.zone);
      dv.setUint8(o + 9, b.state);
      dv.setUint8(o + 10, b.level);
      dv.setUint16(o + 11, b.occupants, true);
      dv.setUint32(o + 13, b.stateSinceTick, true);
      o += 17;
    }
    return fnv1aBytes(buf, h);
  }
}
