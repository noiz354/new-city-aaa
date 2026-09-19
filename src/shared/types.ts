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

/** Canonical save payload (shared so sim/ and persistence/ never import each other). */
export interface SaveMeta {
  tick: number;
  accumulator: number;
  speed: number;
  rngSeed: number;
  rngState: number;
  balance: number;
  worldSize: number;
  worldSeed: number;
}

export interface SaveLayers {
  terrain: Uint8Array;
  /** Float32 height bytes (little-endian). */
  height: Uint8Array;
  zone: Uint8Array;
  road: Uint8Array;
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

// ---- dependency-inversion contracts (module-boundaries §2) ----
// view/ and ui/ program to these shared interfaces; main.ts injects the sim.
// No runtime import of sim/ from view/, ui/, or persistence/ is allowed.

export const CHUNK = 16;
export const DIRTY_NONE = 0;
export const DIRTY_ROADS = 1;
export const DIRTY_ZONES = 2;
export const DIRTY_ALL = DIRTY_ROADS | DIRTY_ZONES;

export interface RoadPlan {
  path: TilePos[];
  newTiles: TilePos[];
  cost: number;
}

export interface ZonePlan {
  tiles: TilePos[];
  skipped: number;
  cost: number;
}

export interface BulldozePlan {
  tiles: TilePos[];
  roadTiles: number;
  zoneTiles: number;
  cost: number;
}

/** Structural read view of the world (implemented by sim.World). */
export interface WorldView {
  readonly size: number;
  readonly mapMeters: number;
  readonly terrain: Uint8Array;
  readonly height: Float32Array;
  readonly zone: Uint8Array;
  readonly road: Uint8Array;
  readonly roadMask: Uint8Array;
  readonly chunkDirty: Uint8Array;
  idx(x: number, y: number): number;
  inBounds(x: number, y: number): boolean;
  tileCenterWorld(x: number, y: number): { x: number; z: number };
  groundHeightAt(wx: number, wz: number): number;
  /** Null when buildable, else the player-facing reason. */
  buildBlockReason(x: number, y: number): string | null;
  slopeAt(x: number, y: number): number;
}

/** Command execution + validation entry points (implemented by main.ts over Sim). */
export interface CommandHost {
  readonly world: WorldView;
  execute(cmd: Command): CommandResult;
  validateRoad(path: TilePos[]): CommandResult & { plan?: RoadPlan };
  validateZone(rect: TileRect): CommandResult & { plan?: ZonePlan };
  validateBulldoze(rect: TileRect): CommandResult & { plan?: BulldozePlan };
}

/** Save encoders read through this (implemented by sim.Sim). */
export interface SaveSource {
  snapshot(): SimSnapshot;
  getSaveMeta(): SaveMeta;
  getSaveLayers(): SaveLayers;
}
