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
import type { Economy } from './economy.js';
import type { World } from './world.js';

/** Validate a road path. Existing road tiles are free; any blocked tile rejects all. */
export function validateRoad(world: World, economy: Economy, path: TilePos[]): CommandResult & { plan?: RoadPlan } {
  if (path.length === 0) return { ok: false, reason: 'Empty path' };
  const seen = new Set<number>();
  const newTiles: TilePos[] = [];
  for (const t of path) {
    const key = t.y * world.size + t.x;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!world.inBounds(t.x, t.y)) return { ok: false, reason: 'Out of bounds' };
    if ((world.road[world.idx(t.x, t.y)] as number) === 1) continue; // re-lay is free
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
