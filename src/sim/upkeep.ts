// Upkeep (T-205, FR-E01/E03): monthly per-building + road upkeep debited from the treasury.
// Canonical sources: docs/03-simulation-core upkeep table, docs/05 B1 (monthly tick, integer
// money), B3 (roads $0.5/tile), B6 (Frontier subsidy −30% while pop < 500). Scope guards:
//   - tax income is T-206/T-301 — this module only expenses;
//   - plants/water/services upkeep arrive with their own slices (VS-3..VS-5);
//   - bankruptcy (< −$5,000) blocks paid commands in T-301 — upkeep simply debits, the
//     balance may go negative (B1 models negative treasury explicitly).
// Which tiles pay: OCCUPIED and ABANDONED buildings (the structure stands; design-doc §2
// abandonment is "dark, overgrown" — still maintained ground truth); UNDER-CONSTRUCTION pays
// nothing (not yet a functioning building) and vacant zones are free (B3 "no upkeep vacant").
// Derived, never persisted: the bill is recomputed from world/buildings every month pass.
// Tick-order compliant: economy stage runs after growth on the day boundary
// (simulation-architecture §2: `… → growth → fields-commit → economy(monthly) → events-out`).
import { BUILDING_CONSTRUCTION, type Buildings } from './buildings.js';
import type { Economy } from './economy.js';
import {
  ROAD_UPKEEP_DEN,
  ROAD_UPKEEP_NUM,
  SUBSIDY_DEN,
  SUBSIDY_NUM,
  SUBSIDY_POP_LIMIT,
  UPKEEP_PER_MONTH,
} from './tuning/upkeep.js';
import type { World } from './world.js';

export interface UpkeepBill {
  /** Upkeep from standing buildings (sum of UPKEEP_PER_MONTH[zone][level]). */
  buildings: number;
  /** floor(roadTiles × NUM/DEN). */
  roads: number;
  /** buildings + roads before subsidy. */
  gross: number;
  /** true while population < SUBSIDY_POP_LIMIT. */
  subsidyApplied: boolean;
  /** What actually leaves the treasury this pass: floor(gross × NUM/DEN) if subsidized. */
  net: number;
}

export class Upkeep {
  private readonly world: World;
  private readonly buildings: Buildings;
  private readonly economy: Economy;

  constructor(world: World, buildings: Buildings, economy: Economy) {
    this.world = world;
    this.buildings = buildings;
    this.economy = economy;
  }

  /** Preview/test seam: current monthly bill without touching the treasury. */
  monthlyBill(): UpkeepBill {
    let buildings = 0;
    this.buildings.forEachLive((b) => {
      if (b.state === BUILDING_CONSTRUCTION) return; // not yet a functioning building
      buildings += UPKEEP_PER_MONTH[b.zone]?.[b.level] ?? 0; // unknown agents pay 0 (extensible)
    });
    const roads = Math.floor((this.world.counts.roads * ROAD_UPKEEP_NUM) / ROAD_UPKEEP_DEN);
    const gross = buildings + roads;
    const subsidyApplied = this.buildings.population() < SUBSIDY_POP_LIMIT;
    const net = subsidyApplied ? Math.floor((gross * SUBSIDY_NUM) / SUBSIDY_DEN) : gross;
    return { buildings, roads, gross, subsidyApplied, net };
  }

  /** Month-boundary pass (called by Sim at tick % TICKS_PER_MONTH === 0). Returns the bill. */
  onMonth(): UpkeepBill {
    const bill = this.monthlyBill();
    if (bill.net !== 0) this.economy.add(-bill.net); // debit even below zero; bankruptcy is T-301
    return bill;
  }
}
