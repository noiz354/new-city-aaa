// UiActions: main.ts implements these over Sim/View/storage; React calls them.
import type { ToolId } from '../shared/types.js';
import type { SlotId } from '../persistence/store.js';

export interface PriceList {
  roadPerTile: number;
  zonePerTile: number;
  bulldozeRoad: number;
  bulldozePerTile: number;
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
  /** T-204 FR-C06: why is growth blocked on this lot? (null = not blocked) */
  growthBlockReason(x: number, y: number): 'unzoned' | 'occupied' | 'no-demand' | 'no-road-access' | null;
  /** Sim-owned, player-facing text for the no-road-attachment block (FR-C06/VS-2a). */
  roadAccessReason(): string;
}
