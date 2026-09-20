// Command planning + validation + application. Pure w.r.t. wall clock; economy
// is only touched by Sim.execute after successful validation.
import { rectTiles } from '../shared/grid.js';
import type {
  BulldozePlan,
  CommandResult,
  RoadPlan,
  TilePos,
  TileRect,
  ZonePlan,
} from '../shared/types.js';
import { COSTS } from './tuning/costs.js';
import { COSTS_POWER } from './tuning/power.js';
import { COSTS_WATER } from './tuning/water.js';
import type { Economy } from './economy.js';
import type { World } from './world.js';

/** Plant-tile probe (plants live in sim.PowerGrid, not the world). Defaults to "no plants". */
export type IsPlantTile = (x: number, y: number) => boolean;
const noPlants: IsPlantTile = () => false;
/** Tower-tile probe (towers live in sim.WaterGrid, not the world). Defaults to "no towers". */
export type IsTowerTile = (x: number, y: number) => boolean;
const noTowers: IsTowerTile = () => false;

/** Validate a road path. Existing road tiles are free; any blocked tile rejects all. */
export function validateRoad(
  world: World,
  economy: Economy,
  path: TilePos[],
  isPlantTile: IsPlantTile = noPlants,
  isTowerTile: IsTowerTile = noTowers,
): CommandResult & { plan?: RoadPlan } {
  if (path.length === 0) return { ok: false, reason: 'Empty path' };
  const seen = new Set<number>();
  const newTiles: TilePos[] = [];
  for (const t of path) {
    const key = t.y * world.size + t.x;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!world.inBounds(t.x, t.y)) return { ok: false, reason: 'Out of bounds' };
    if ((world.road[world.idx(t.x, t.y)] as number) === 1) continue; // re-lay is free
    if (isPlantTile(t.x, t.y)) return { ok: false, reason: 'Power plant here' };
    if (isTowerTile(t.x, t.y)) return { ok: false, reason: 'Water tower here' };
    const blocked = world.buildBlockReason(t.x, t.y);
    if (blocked) return { ok: false, reason: blocked };
    newTiles.push(t);
  }
  const cost = newTiles.length * COSTS.roadPerTile;
  if (!economy.canAfford(cost)) {
    return { ok: false, reason: 'Insufficient funds', shortBy: cost - economy.balance };
  }
  return { ok: true, cost, tiles: newTiles.length, plan: { path, newTiles, cost } };
}

export function applyRoad(world: World, plan: RoadPlan): number {
  let applied = 0;
  for (const t of plan.newTiles) {
    if (world.setRoad(t.x, t.y)) applied++;
  }
  return applied;
}

/** Validate a zone paint. Road/blocked tiles are skipped (kept); rest are charged. */
export function validateZone(
  world: World,
  economy: Economy,
  rect: TileRect,
  isPlantTile: IsPlantTile = noPlants,
  isTowerTile: IsTowerTile = noTowers,
): CommandResult & { plan?: ZonePlan } {
  const tiles: TilePos[] = [];
  let skipped = 0;
  for (let y = rect.y0; y <= rect.y1; y++) {
    for (let x = rect.x0; x <= rect.x1; x++) {
      if (!world.inBounds(x, y)) {
        skipped++;
        continue;
      }
      const i = world.idx(x, y);
      // Zone validity (building-and-zoning §1): not water/blocked, not road, not occupied by a building.
      if (
        (world.road[i] as number) === 1 ||
        (world.building[i] as number) !== -1 ||
        isPlantTile(x, y) ||
        isTowerTile(x, y) ||
        world.buildBlockReason(x, y) !== null
      ) {
        skipped++;
        continue;
      }
      tiles.push({ x, y });
    }
  }
  if (tiles.length === 0) return { ok: false, reason: 'No paintable tiles in area' };
  const cost = tiles.length * COSTS.zonePerTile;
  if (!economy.canAfford(cost)) {
    return { ok: false, reason: 'Insufficient funds', shortBy: cost - economy.balance };
  }
  return { ok: true, cost, tiles: tiles.length, plan: { tiles, skipped, cost } };
}

export function applyZone(world: World, plan: ZonePlan, zone: 1 | 2 | 3): number {
  let applied = 0;
  for (const t of plan.tiles) {
    if (world.setZone(t.x, t.y, zone)) applied++;
  }
  return applied;
}

export function validateBulldoze(world: World, economy: Economy, rect: TileRect): CommandResult & { plan?: BulldozePlan } {
  const tiles = rectTiles(rect).filter((t) => world.inBounds(t.x, t.y));
  let roadTiles = 0;
  let zoneTiles = 0;
  for (const t of tiles) {
    const i = world.idx(t.x, t.y);
    if ((world.road[i] as number) === 1) roadTiles++;
    else if ((world.zone[i] as number) !== 0) zoneTiles++;
  }
  const cost = roadTiles * COSTS.bulldozeRoad + zoneTiles * COSTS.bulldozePerTile;
  if (!economy.canAfford(cost)) {
    return { ok: false, reason: 'Insufficient funds', shortBy: cost - economy.balance };
  }
  return { ok: true, cost, tiles: roadTiles + zoneTiles, plan: { tiles, roadTiles, zoneTiles, cost } };
}

export function applyBulldoze(world: World, plan: BulldozePlan): number {
  let cleared = 0;
  for (const t of plan.tiles) {
    if (world.clearTile(t.x, t.y) !== 'none') cleared++;
  }
  return cleared;
}

/**
 * Validate a power-line path (T-405). Reuses the RoadPlan shape ({path, newTiles, cost}) —
 * a line drag behaves exactly like a road drag, minus terrain carving. Already-lined tiles
 * are free; lines coexist with roads/zones but not with buildings or plants.
 */
export function validatePowerLine(
  world: World,
  economy: Economy,
  path: TilePos[],
  isPlantTile: IsPlantTile = noPlants,
  isTowerTile: IsTowerTile = noTowers,
): CommandResult & { plan?: RoadPlan } {
  if (path.length === 0) return { ok: false, reason: 'Empty path' };
  const seen = new Set<number>();
  const newTiles: TilePos[] = [];
  for (const t of path) {
    const key = t.y * world.size + t.x;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!world.inBounds(t.x, t.y)) return { ok: false, reason: 'Out of bounds' };
    if ((world.powerLine[world.idx(t.x, t.y)] as number) === 1) continue; // re-lay is free
    if (isPlantTile(t.x, t.y)) return { ok: false, reason: 'Power plant here' };
    if (isTowerTile(t.x, t.y)) return { ok: false, reason: 'Water tower here' };
    if ((world.building[world.idx(t.x, t.y)] as number) !== -1) {
      return { ok: false, reason: 'Occupied by building' };
    }
    const blocked = world.buildBlockReason(t.x, t.y);
    if (blocked) return { ok: false, reason: blocked };
    newTiles.push(t);
  }
  const cost = newTiles.length * COSTS_POWER.linePerTile;
  if (!economy.canAfford(cost)) {
    return { ok: false, reason: 'Insufficient funds', shortBy: cost - economy.balance };
  }
  return { ok: true, cost, tiles: newTiles.length, plan: { path, newTiles, cost } };
}

export function applyPowerLine(world: World, plan: RoadPlan): number {
  let applied = 0;
  for (const t of plan.newTiles) {
    if (world.setPowerLine(t.x, t.y)) applied++;
  }
  return applied;
}

/**
 * Validate a power-plant site (T-405). Single buildable tile: no road/building/line/plant,
 * no water/steep. Zone paint is cleared on apply (like roads do); buildings are demolished
 * by Sim.execute first, so a plant may replace an occupied lot at full flat cost.
 */
export function validatePlant(
  world: World,
  economy: Economy,
  x: number,
  y: number,
  isPlantTile: IsPlantTile = noPlants,
  isTowerTile: IsTowerTile = noTowers,
): CommandResult {
  if (!world.inBounds(x, y)) return { ok: false, reason: 'Out of bounds' };
  const i = world.idx(x, y);
  if (isPlantTile(x, y)) return { ok: false, reason: 'Power plant here' };
  if (isTowerTile(x, y)) return { ok: false, reason: 'Water tower here' };
  if ((world.road[i] as number) === 1) return { ok: false, reason: 'Road here' };
  if ((world.building[i] as number) !== -1) return { ok: false, reason: 'Occupied by building' };
  if ((world.powerLine[i] as number) === 1) return { ok: false, reason: 'Power line here' };
  const blocked = world.buildBlockReason(x, y);
  if (blocked) return { ok: false, reason: blocked };
  const cost = COSTS_POWER.plant;
  if (!economy.canAfford(cost)) {
    return { ok: false, reason: 'Insufficient funds', shortBy: cost - economy.balance };
  }
  return { ok: true, cost, tiles: 1 };
}

/**
 * Validate a water-tower site (T-406). Single buildable tile: no road/building/line/plant/
 * tower, no water/steep. Zone paint is cleared on apply (like roads do); buildings are
 * demolished by Sim.execute first, so a tower may replace an occupied lot at full flat cost.
 */
export function validateTower(
  world: World,
  economy: Economy,
  x: number,
  y: number,
  isPlantTile: IsPlantTile = noPlants,
  isTowerTile: IsTowerTile = noTowers,
): CommandResult {
  if (!world.inBounds(x, y)) return { ok: false, reason: 'Out of bounds' };
  const i = world.idx(x, y);
  if (isTowerTile(x, y)) return { ok: false, reason: 'Water tower here' };
  if (isPlantTile(x, y)) return { ok: false, reason: 'Power plant here' };
  if ((world.road[i] as number) === 1) return { ok: false, reason: 'Road here' };
  if ((world.building[i] as number) !== -1) return { ok: false, reason: 'Occupied by building' };
  if ((world.powerLine[i] as number) === 1) return { ok: false, reason: 'Power line here' };
  const blocked = world.buildBlockReason(x, y);
  if (blocked) return { ok: false, reason: blocked };
  const cost = COSTS_WATER.tower;
  if (!economy.canAfford(cost)) {
    return { ok: false, reason: 'Insufficient funds', shortBy: cost - economy.balance };
  }
  return { ok: true, cost, tiles: 1 };
}
