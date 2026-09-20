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

export type ToolId = 'select' | 'road' | 'zone-r' | 'zone-c' | 'zone-i' | 'power-line' | 'plant' | 'water-tower' | 'bulldoze';

/** Player-issued mutations. Every sim state change flows through a Command. */
export type Command =
  | { kind: 'place-road'; path: TilePos[] }
  | { kind: 'paint-zone'; rect: TileRect; zone: 1 | 2 | 3 }
  | { kind: 'place-power-line'; path: TilePos[] }
  | { kind: 'place-plant'; x: number; y: number }
  | { kind: 'place-tower'; x: number; y: number }
  | { kind: 'bulldoze'; rect: TileRect };

export type CommandResult = { ok: true; cost: number; tiles: number } | { ok: false; reason: string; shortBy?: number };

/** Sim -> view/UI notifications. Emitted during execute()/tick(); drained each frame. */
export type SimEvent =
  | { type: 'chunk-dirty'; cx: number; cy: number }
  | { type: 'treasury-changed'; balance: number }
  | { type: 'command-applied'; kind: Command['kind']; cost: number; tiles: number }
  | { type: 'command-rejected'; kind: Command['kind']; reason: string }
  /** Building lifecycle change (T-201/T-202). state: 0=vacant(demolished) 1=construction 2=occupied 3=abandoned. */
  | { type: 'building-changed'; id: number; x: number; y: number; state: number }
  /** Road attachment flip on a zoned/building tile (T-204, FR-C06). blocked=true → show "No road connection". */
  | { type: 'road-access-changed'; x: number; y: number; blocked: boolean }
  /** Power flip on a zoned/building tile (T-405). powered=false → show "No power" (amber ⚡). */
  | { type: 'power-changed'; x: number; y: number; powered: boolean }
  /** Power plant placed (present) or removed (!present) on a tile (T-405 plant markers). */
  | { type: 'plant-changed'; x: number; y: number; present: boolean }
  /** Power-line layer changed somewhere (bulk; view resyncs the line projection wholesale). */
  | { type: 'power-line-changed' }
  /** Pressure flip on a zoned/building tile (T-406). watered=false shows a blue droplet icon. */
  | { type: 'water-changed'; x: number; y: number; watered: boolean }
  /** Water tower placed (present) or removed (!present) on a tile (T-406 tower markers). */
  | { type: 'tower-changed'; x: number; y: number; present: boolean };

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
  /** T-405: power-line conductor tiles (zeros for saves predating layers sver 2). */
  powerLine: Uint8Array;
}

/** Power section payload (codec section 6, sver 1): player-built plant sites. */
export interface SavePower {
  plants: TilePos[];
}

/** Water section payload (codec section 7, sver 1): player-built tower sites. */
export interface SaveWater {
  towers: TilePos[];
}

/** One building-store slot in a save (T-202). state 0 = free slot; slot order = stable building ids. */
export interface BuildingSlotData {
  state: number; // 0=vacant(free) 1=construction 2=occupied 3=abandoned
  x: number;
  y: number;
  zone: number;
  level: number;
  occupants: number;
  stateSinceTick: number;
}

/** Entity section payload (codec section 4, sver 1). */
export interface SaveEntities {
  slots: BuildingSlotData[];
}

/**
 * Policy section payload (codec section 5, sver 1). Per-zone tax rates (0..20 %) introduced
 * at save-version 2 (T-302, spec §9 ask-first). Service funding lands later (VS-5) as an
 * additional optional field — parsePolicy tolerates a longer payload and missing bytes.
 */
export interface SavePolicy {
  tax: { r: number; c: number; i: number };
}

/** One settled month as the HUD sees it (all integers; sim/economy.ts MonthEntry mirrors it). */
export interface MonthLedger {
  income: number;
  expense: number;
  subsidy: number;
}

export interface SimSnapshot {
  tick: number;
  date: SimDate;
  balance: number;
  population: number;
  /** T-206 FR-S02: RCI demand ∈ [−100,100], integer-rounded for the HUD bars. */
  demand: { r: number; c: number; i: number };
  /** T-302: per-zone tax rate (0..20 %); surfaced so the tax sliders render current values. */
  tax: { r: number; c: number; i: number };
  /** T-208 FR-U02 cohort-vs-jobs readout: 0 by canonical ledger — model lands with T-305. */
  jobs: number;
  /** T-208 FR-U02: fraction currently unemployed ∈ [0,1]; same T-305 ledger ⇒ 0. */
  unemployment: number;
  /** T-301 docs/02 §4: balance < −$5,000 — paid commands blocked, budget modal forced. */
  bankrupt: boolean;
  /**
   * T-301: last settled month. expense = gross upkeep; subsidy = the Frontier safety-net part
   * of it the city did NOT pay (docs/02 §4, pop < 500). Treasury delta ≡ income − expense + subsidy.
   */
  lastMonth: MonthLedger;
  /** T-303 docs/02 §4: trailing months, oldest → newest (≤12), recomputable derived data. */
  history: MonthLedger[];
  size: number;
  seed: number;
  paused: boolean;
  speed: number;
  counts: { roads: number; zonesR: number; zonesC: number; zonesI: number };
  /** T-405: live grid readout (derived; HUD/inspector only). */
  power: { active: boolean; plants: number; nets: number; supplyMw: number; demandMw: number; unpowered: number };
  /** T-406: live water readout (derived; HUD/inspector only). */
  water: { active: boolean; towers: number; nets: number; supplyKl: number; demandKl: number; unwatered: number };
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
  /** T-405: power-line conductor tiles (view line projection reads this). */
  readonly powerLine: Uint8Array;
  /** T-405: tile → buildingId (-1=none); the power overlay tints building tiles. */
  readonly building: Int32Array;
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
  validatePowerLine(path: TilePos[]): CommandResult & { plan?: RoadPlan };
  validatePlant(x: number, y: number): CommandResult;
  validateTower(x: number, y: number): CommandResult;
  validateBulldoze(rect: TileRect): CommandResult & { plan?: BulldozePlan };
}

/** Save encoders read through this (implemented by sim.Sim). */
export interface SaveSource {
  snapshot(): SimSnapshot;
  getSaveMeta(): SaveMeta;
  getSaveLayers(): SaveLayers;
  getSaveEntities(): SaveEntities;
  getSavePolicy(): SavePolicy;
  getSavePower(): SavePower;
  getSaveWater(): SaveWater;
}
