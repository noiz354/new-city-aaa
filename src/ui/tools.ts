// ToolController: pointer -> ghost preview -> CommandHost.execute. Owns tool keys.
import { normalizeRect, planRoadPath, rectTiles } from '../shared/grid.js';
import type { Command, CommandHost, TilePos, ToolId } from '../shared/types.js';
import type { GhostTile } from '../view/highlight.js';
import type { View } from '../view/view.js';
import type { UiActions } from './actions.js';
import type { UiStore } from './store.js';

interface Drag {
  tool: ToolId;
  anchor: TilePos;
}

const TOOL_KEYS: Record<string, ToolId> = {
  Digit1: 'select',
  Digit2: 'road',
  Digit3: 'zone-r',
  Digit4: 'zone-c',
  Digit5: 'zone-i',
  Digit6: 'bulldoze',
};

function money(n: number): string {
  return `$${n.toLocaleString('en-US')}`;
}

export class ToolController {
  private drag: Drag | null = null;
  private rightDown: { x: number; y: number } | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly view: View,
    private readonly store: UiStore,
    private readonly host: CommandHost,
    private readonly actions: Pick<UiActions, 'setTool' | 'togglePause' | 'toggleCamera' | 'toggleValueOverlay' | 'toggleBudget'>,
  ) {
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  private pick(e: PointerEvent): TilePos | null {
    const r = this.view.screenToTile(e.clientX, e.clientY);
    return r ? r.tile : null;
  }

  private onDown(e: PointerEvent): void {
    if (e.button === 2) {
      this.rightDown = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button !== 0) return;
    const tile = this.pick(e);
    if (!tile) return;
    const tool = this.store.getState().tool;
    if (tool === 'select') {
      this.store.set({ selectedTile: tile });
      return;
    }
    this.drag = { tool, anchor: tile };
    this.updatePreview(tile);
  }

  private onMove(e: PointerEvent): void {
    if (e.target !== this.canvas) {
      if (!this.drag) {
        this.store.set({ hoverTile: null });
        this.view.hover.hide();
      }
      return;
    }
    const tile = this.pick(e);
    this.store.set({ hoverTile: tile });
    if (tile) {
      const c = this.view.tileCenter(tile);
      this.view.hover.setTile(c.x, this.view.groundY(c.x, c.z), c.z);
    } else {
      this.view.hover.hide();
    }
    if (this.drag && tile) this.updatePreview(tile);
  }

  private onUp(e: PointerEvent): void {
    if (e.button === 2 && this.rightDown) {
      const moved = Math.hypot(e.clientX - this.rightDown.x, e.clientY - this.rightDown.y);
      this.rightDown = null;
      if (moved < 5 && this.drag) this.cancelDrag();
      return;
    }
    if (e.button !== 0 || !this.drag) return;
    const tile = e.target === this.canvas ? this.pick(e) : null;
    const drag = this.drag;
    this.drag = null;
    this.view.ghost.clear();
    this.store.set({ previewCost: null, previewNote: null });
    if (!tile) return;
    const cmd = this.commandFor(drag, tile);
    if (!cmd) return;
    const res = this.host.execute(cmd);
    if (res.ok) {
      if (cmd.kind === 'place-road') this.store.toast(`Road built · ${money(res.cost)}`);
      else if (cmd.kind === 'paint-zone') this.store.toast(`Zoned ${res.tiles} tiles · ${money(res.cost)}`);
      else this.store.toast(res.tiles > 0 ? `Cleared ${res.tiles} tiles · ${money(res.cost)}` : 'Nothing to clear');
    } else {
      this.store.toast(res.shortBy ? `${res.reason} (${money(res.shortBy)} short)` : res.reason);
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const tool = TOOL_KEYS[e.code];
    if (tool) {
      this.actions.setTool(tool);
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      this.actions.togglePause();
    } else if (e.code === 'KeyO') {
      this.actions.toggleCamera();
    } else if (e.code === 'KeyV') {
      this.actions.toggleValueOverlay(); // T-207: land-value gradient overlay
    } else if (e.code === 'KeyB') {
      this.actions.toggleBudget(); // T-303: budget panel
    } else if (e.code === 'Escape') {
      if (this.drag) this.cancelDrag();
      else if (this.store.getState().budgetOpen) this.actions.toggleBudget(); // modal first (T-303)
      else this.store.set({ selectedTile: null });
    }
  }

  private cancelDrag(): void {
    this.drag = null;
    this.view.ghost.clear();
    this.store.set({ previewCost: null, previewNote: null });
    this.store.toast('Cancelled');
  }

  private commandFor(drag: Drag, tile: TilePos): Command | null {
    if (drag.tool === 'road') return { kind: 'place-road', path: planRoadPath(drag.anchor, tile) };
    if (drag.tool === 'bulldoze') return { kind: 'bulldoze', rect: normalizeRect(drag.anchor, tile) };
    if (drag.tool === 'zone-r') return { kind: 'paint-zone', rect: normalizeRect(drag.anchor, tile), zone: 1 };
    if (drag.tool === 'zone-c') return { kind: 'paint-zone', rect: normalizeRect(drag.anchor, tile), zone: 2 };
    if (drag.tool === 'zone-i') return { kind: 'paint-zone', rect: normalizeRect(drag.anchor, tile), zone: 3 };
    return null;
  }

  private toGhostTiles(tiles: TilePos[], state: GhostTile['state'] | ((t: TilePos) => GhostTile['state'])): GhostTile[] {
    return tiles.map((t) => {
      const c = this.view.tileCenter(t);
      return { x: c.x, z: c.z, y: this.view.groundY(c.x, c.z), state: typeof state === 'function' ? state(t) : state };
    });
  }

  private updatePreview(cur: TilePos): void {
    const drag = this.drag;
    if (!drag) return;
    const world = this.host.world;
    if (drag.tool === 'road') {
      const path = planRoadPath(drag.anchor, cur);
      const v = this.host.validateRoad(path);
      this.view.ghost.setTiles(this.toGhostTiles(path, v.ok ? 'ok' : 'err'));
      this.store.set(
        v.ok
          ? { previewCost: v.cost, previewNote: `${money(v.cost)} · ${v.tiles} tiles` }
          : { previewCost: null, previewNote: v.reason },
      );
    } else if (drag.tool === 'bulldoze') {
      const rect = normalizeRect(drag.anchor, cur);
      const tiles = rectTiles(rect).filter((t) => world.inBounds(t.x, t.y));
      const v = this.host.validateBulldoze(rect);
      const ghost = this.toGhostTiles(
        tiles.filter((t) => {
          const i = world.idx(t.x, t.y);
          return (world.road[i] as number) === 1 || (world.zone[i] as number) !== 0;
        }),
        'warn',
      );
      this.view.ghost.setTiles(ghost.slice(0, 4096));
      this.store.set(
        v.ok
          ? {
              previewCost: v.cost,
              previewNote: v.tiles > 0 ? `${money(v.cost)} · ${v.tiles} tiles` : 'Nothing to clear',
            }
          : { previewCost: null, previewNote: v.reason },
      );
    } else {
      const rect = normalizeRect(drag.anchor, cur);
      const tiles = rectTiles(rect).filter((t) => world.inBounds(t.x, t.y));
      const v = this.host.validateZone(rect);
      const ghost = this.toGhostTiles(tiles, (t) => {
        const i = world.idx(t.x, t.y);
        return (world.road[i] as number) === 1 || world.buildBlockReason(t.x, t.y) !== null ? 'err' : 'ok';
      });
      const truncated = ghost.length > 4096;
      this.view.ghost.setTiles(ghost.slice(0, 4096));
      this.store.set(
        v.ok
          ? {
              previewCost: v.cost,
              previewNote: `${money(v.cost)} · ${v.tiles} tiles${v.plan && v.plan.skipped > 0 ? ` (+${v.plan.skipped} skipped)` : ''}${truncated ? ' · preview truncated' : ''}`,
            }
          : { previewCost: null, previewNote: v.reason },
      );
    }
  }
}
