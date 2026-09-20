// Growth engine v0 (T-202): daily scoring pass → spawn + move-in. FR-S03.
//
// Runs once per game-day (day boundary, growth stage of the frozen tick order —
// simulation-architecture §1: heavy systems run on day boundaries only). Rules, all
// observable and documented (no magic):
//   eligibility = zoned lot, vacant, not a road, direct road adjacency (v0: 4-neighbour;
//   T-204 upgrades this to real path access + "No road connection" icon), demand > 0.
//   score     = demand×100 + road-adjacency bonus (tuning). Ties break by tile index (asc).
//   pacing    = at most GROWTH_TUNING.maxSpawnsPerDay spawns per day.
//   move-in   = newly occupied buildings receive BUILDING_CAPACITY occupants on the next
//   daily pass; population is their sum (never UI-owned).
// Powered/watered: power is modelled since T-405 (VS-4) — a live grid gates spawn + move-in
// via PowerGrid.isPowered; an inactive grid (no plants/lines) treats every lot as serviced
// (spec §9 legacy-guard). Watered arrives with T-406.
// Deterministic: tile-index scan order, no RNG, no wall clock.
import { BUILDING_OCCUPIED, BUILDING_CONSTRUCTION, type Buildings } from './buildings.js';
import type { Demand } from './demand.js';
import type { Fields } from './fields.js';
import type { PowerGrid } from './power.js';
import type { WaterGrid } from './water.js';
import type { RoadAccess } from './road-access.js';
import { BUILDING_CAPACITY, dailySpawnBudget, GROWTH_TUNING } from './tuning/growth.js';
import type { World } from './world.js';

export interface GrowthResult {
  spawned: number;
  movedIn: number;
}

export class Growth {
  private readonly world: World;
  private readonly buildings: Buildings;
  private readonly roadAccess: RoadAccess;
  private readonly power: PowerGrid; // T-405: live-grid gate for spawn + move-in
  private readonly water: WaterGrid; // T-406: live-pressure gate for spawn + move-in
  private readonly demand: Demand;
  private readonly fields: Fields; // T-207: landFit (R/C seek value; I seeks cheap land)

  constructor(
    world: World,
    buildings: Buildings,
    roadAccess: RoadAccess,
    power: PowerGrid,
    water: WaterGrid,
    demand: Demand,
    fields: Fields,
  ) {
    this.world = world;
    this.buildings = buildings;
    this.roadAccess = roadAccess;
    this.power = power;
    this.water = water;
    this.demand = demand;
    this.fields = fields;
  }

  /** Daily pass. Called by Sim when the tick crosses a day boundary. */
  onDay(tick: number): GrowthResult {
    // 0) Attachment truth first: icons, growth and cancel share one source (T-204).
    this.roadAccess.updateFlags(this.buildings);
    // 1) Cancel: organic construction on a lot that lost attachment is cancelled
    //    (design-doc §2 "road removed mid-build → refund + cancel"; organic builds have
    //    no payer, so there is nothing to refund — cancel only).
    this.buildings.forEachLive((b) => {
      if (b.state === BUILDING_CONSTRUCTION && !this.roadAccess.isConnected(b.x, b.y)) {
        this.buildings.demolishAt(b.x, b.y);
      }
    });
    // 2) Move-in: occupy completed buildings still at zero occupants (needs attachment + power).
    let movedIn = 0;
    this.buildings.forEachLive((b) => {
      if (
        b.state === BUILDING_OCCUPIED &&
        b.occupants === 0 &&
        this.roadAccess.isConnected(b.x, b.y) &&
        this.power.isPowered(b.x, b.y) &&
        this.water.isWatered(b.x, b.y)
      ) {
        const cap = BUILDING_CAPACITY[b.zone]?.[b.level] ?? 0;
        if (cap > 0 && this.buildings.setOccupants(b.id, cap)) movedIn++;
      }
    });
    // 3) Spawn: score every eligible lot, take the top-N (N = daily budget N from population, docs §3).
    let spawned = 0;
    const budgetN = dailySpawnBudget(this.buildings.population());
    const w = this.world;
    const candidates: { idx: number; score: number }[] = [];
    for (let y = 0; y < w.size; y++) {
      for (let x = 0; x < w.size; x++) {
        const i = w.idx(x, y);
        const z = w.zone[i] as number;
        if (z === 0 || (w.building[i] as number) !== -1) continue;
        const demand = this.demand.forZone(z);
        if (demand <= 0 || !this.roadAccess.isConnected(x, y)) continue;
        if (!this.power.isPowered(x, y)) continue; // T-405: live grid gates spawn
        if (!this.water.isWatered(x, y)) continue; // T-406: live pressure net gates spawn
        // score = demand × landFit(zone, value) + road bonus (docs/03 §3; desirability v0
        // rides land value; SPAWN_T-25 gate + rng jitter arrive with the full §3 scorer).
        candidates.push({ idx: i, score: demand * 100 * this.fields.landFit(z, x, y) + GROWTH_TUNING.roadAdjacencyBonus });
      }
    }
    candidates.sort((a, b) => b.score - a.score || a.idx - b.idx);
    for (const c of candidates) {
      if (spawned >= budgetN) break;
      if (this.buildings.startConstruction(c.idx % w.size, Math.floor(c.idx / w.size), tick) !== null) spawned++;
    }
    return { spawned, movedIn };
  }

  /** Test/inspector seam: does an eligible-but-unbuilt lot exist here, and why not? */
  growthBlockReason(x: number, y: number): 'unzoned' | 'occupied' | 'no-demand' | 'no-road-access' | 'no-power' | 'no-water' | null {
    const w = this.world;
    if (!w.inBounds(x, y)) return 'unzoned';
    const i = w.idx(x, y);
    const z = w.zone[i] as number;
    if (z === 0) return 'unzoned';
    if ((w.building[i] as number) !== -1) return 'occupied';
    if (this.demand.forZone(z) <= 0) return 'no-demand';
    if (!this.roadAccess.isConnected(x, y)) return 'no-road-access';
    if (!this.power.isPowered(x, y)) return 'no-power';
    if (!this.water.isWatered(x, y)) return 'no-water';
    return null;
  }

  /** Exposed for upcoming UI: is this lot under construction? (cheap typed probe) */
  isUnderConstruction(x: number, y: number): boolean {
    const w = this.world;
    if (!w.inBounds(x, y)) return false;
    const id = w.building[w.idx(x, y)] as number;
    if (id === -1) return false;
    return this.buildings.get(id)?.state === BUILDING_CONSTRUCTION;
  }
}
