// Shared value types: no imports allowed (pure). Tile unit = 8 m (G-GRID).
export const TILE_M = 8;

/** Zone ids stored in world.zone. 0 = unzoned. */
export type ZoneId = 0 | 1 | 2 | 3;
export const ZONE_NONE = 0 as const;
export const ZONE_RESIDENTIAL = 1 as const;
export const ZONE_COMMERCIAL = 2 as const;
export const ZONE_INDUSTRIAL = 3 as const;

/** Terrain classes stored in world.terrain. */
export type TerrainKind = 0 | 1 | 2 | 3 | 4;
export const TERRAIN_WATER = 0 as const;
export const TERRAIN_GRASS = 1 as const;
export const TERRAIN_SAND = 2 as const;
export const TERRAIN_ROCK = 3 as const;
export const TERRAIN_FOREST = 4 as const;

export interface TilePos {
  x: number;
  y: number;
}

/** Inclusive, normalized (x0<=x1, y0<=y1) tile rectangle. */
export interface TileRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type ToolId = 'select' | 'road' | 'zone-r' | 'zone-c' | 'zone-i' | 'bulldoze';

/** Player-issued mutations. Every sim state change flows through a Command. */
export type Command =
  | { kind: 'place-road'; path: TilePos[] }
  | { kind: 'paint-zone'; rect: TileRect; zone: 1 | 2 | 3 }
  | { kind: 'bulldoze'; rect: TileRect };

export type CommandResult = { ok: true; cost: number; tiles: number } | { ok: false; reason: string; shortBy?: number };

/** Sim -> view/UI notifications. Emitted during execute()/tick(); drained each frame. */
export type SimEvent =
  | { type: 'chunk-dirty'; cx: number; cy: number }
  | { type: 'treasury-changed'; balance: number }
  | { type: 'command-applied'; kind: Command['kind']; cost: number; tiles: number }
  | { type: 'command-rejected'; kind: Command['kind']; reason: string };

export interface SimDate {
  year: number;
  month: number; // 1..12
  day: number; // 1..30
  dayIndex: number; // days since epoch
}

export interface SimSnapshot {
  tick: number;
  date: SimDate;
  balance: number;
  population: number;
  size: number;
  seed: number;
  paused: boolean;
  speed: number;
  counts: { roads: number; zonesR: number; zonesC: number; zonesI: number };
}
