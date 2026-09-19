// UiStore: framework-agnostic UI state (React subscribes via useSyncExternalStore).
import type { SimSnapshot, TilePos, ToolId, WorldView } from '../shared/types.js';

export interface Toast {
  id: number;
  text: string;
}

export interface UiState {
  tool: ToolId;
  hoverTile: TilePos | null;
  selectedTile: TilePos | null;
  snapshot: SimSnapshot;
  previewCost: number | null;
  previewNote: string | null;
  toast: Toast | null;
  projection: 'ortho' | 'persp';
  storageDriver: string;
  /** T-207: land-value gradient overlay visible? (toggles via TopBar / V key) */
  valueOverlay: boolean;
}

export class UiStore {
  private state: UiState;
  private readonly listeners = new Set<() => void>();
  private toastId = 0;
  /** Injected by main.ts at boot (and re-injected after load). */
  world: WorldView | null = null;

  constructor(snapshot: SimSnapshot) {
    this.state = {
      tool: 'select',
      hoverTile: null,
      selectedTile: null,
      snapshot,
      previewCost: null,
      previewNote: null,
      toast: null,
      projection: 'ortho',
      storageDriver: '?',
      valueOverlay: false,
    };
  }

  getState(): UiState {
    return this.state;
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  set(patch: Partial<UiState>): void {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  toast(text: string): void {
    this.toastId++;
    this.set({ toast: { id: this.toastId, text } });
  }
}
