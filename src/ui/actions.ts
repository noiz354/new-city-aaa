// UiActions: main.ts implements these over Sim/View/storage; React calls them.
import type { ToolId } from '../shared/types.js';
import type { SlotId } from '../persistence/store.js';

export interface PriceList {
  roadPerTile: number;
  zonePerTile: number;
  bulldozeRoad: number;
  bulldozePerTile: number;
  /** T-405: flat coal-plant price + per-tile power-line price (toolbar tips). */
  powerPlant: number;
  powerLinePerTile: number;
  /** T-406: flat water-tower price (toolbar tip). */
  waterTower: number;
}

export interface UiActions {
  setTool(tool: ToolId): void;
  setSpeed(speed: 0 | 1 | 2 | 3): void;
  togglePause(): void;
  save(slot: SlotId): Promise<void>;
  load(slot: SlotId): Promise<void>;
  toggleCamera(): void;
  clearSelection(): void;
  /** T-207: land-value overlay gradient toggle (V key / TopBar). */
  toggleValueOverlay(): void;
  /** T-405: power-grid overlay toggle (P key / TopBar). */
  togglePowerOverlay(): void;
  /** T-406: water-pressure overlay toggle (W key / TopBar). */
  toggleWaterOverlay(): void;
  /** T-403: traffic LOS overlay toggle (T key / TopBar). */
  toggleTrafficOverlay(): void;
  /** T-303: open/close the budget panel. */
  toggleBudget(): void;
  /** T-302: set a zone's tax rate (0..20 %); clamped by the sim. */
  setTax(zone: 'r' | 'c' | 'i', rate: number): void;
  /** T-204 FR-C06: why is growth blocked on this lot? (null = not blocked) */
  growthBlockReason(x: number, y: number): 'unzoned' | 'occupied' | 'no-demand' | 'no-road-access' | 'no-power' | 'no-water' | null;
  /** Sim-owned, player-facing text for the no-road-attachment block (FR-C06/VS-2a). */
  roadAccessReason(): string;
  /** T-405: sim-owned, player-facing text for the no-power block. */
  powerReason(): string;
  /** T-406: sim-owned, player-facing text for the no-water block. */
  waterReason(): string;
}
