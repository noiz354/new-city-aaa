// main.ts: wiring only (module-boundaries §2). Boots storage -> sim -> view ->
// UI, runs the frame loop, exposes window.__game for E2E/debugging.
import './ui/index.css';
import type { CommandHost } from './shared/types.js';
import { decodeSave, encodeSave } from './persistence/codec.js';
import { SlotManager, type SlotId } from './persistence/store.js';
import { Sim } from './sim/sim.js';
import { validateBulldoze, validateRoad, validateZone } from './sim/commands.js';
import { COSTS } from './sim/tuning/costs.js';
import type { UiActions } from './ui/actions.js';
import { mountReact } from './ui/react/mount.js';
import { UiStore } from './ui/store.js';
import { ToolController } from './ui/tools.js';
import { View } from './view/view.js';

export interface GameDebug {
  sim: Sim;
  view: View;
  store: UiStore;
  storage: SlotManager;
  actions: UiActions;
  save(slot: SlotId): Promise<void>;
  load(slot: SlotId): Promise<void>;
}

function el(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node;
}

async function boot(): Promise<void> {
  const container = el('scene-container');
  const uiRoot = el('ui-root');
  const storage = await SlotManager.create();

  // Fixed seeds + presets via URL (screenshot suite, repros). Defaults: random plains.
  const params = new URLSearchParams(window.location.search);
  const seedParam = Number(params.get('seed'));
  const seed = Number.isInteger(seedParam) && seedParam > 0 ? (seedParam >>> 0) || 1 : ((Date.now() % 0x7fffffff) >>> 0) || 1;
  const presetParam = params.get('preset');
  const preset = presetParam === 'default' || presetParam === 'river' || presetParam === 'bay' || presetParam === 'hills' ? presetParam : 'plains';
  const sim = new Sim({ seed, size: 256, preset });
  const view = new View(container, sim.world);
  const store = new UiStore(sim.snapshot());
  store.world = sim.world;
  store.set({ storageDriver: storage.driverName });

  const host: CommandHost = {
    world: sim.world,
    execute: (cmd) => sim.execute(cmd),
    validateRoad: (path) => validateRoad(sim.world, sim.economy, path),
    validateZone: (rect) => validateZone(sim.world, sim.economy, rect),
    validateBulldoze: (rect) => validateBulldoze(sim.world, sim.economy, rect),
  };

  const save = async (slot: SlotId): Promise<void> => {
    const bytes = encodeSave(sim);
    await storage.save(slot, bytes);
    store.toast(`Saved ${slot} (${(bytes.length / 1024).toFixed(1)} KB)`);
  };
    const load = async (slot: SlotId): Promise<void> => {
    const bytes = await storage.load(slot);
    if (!bytes) {
      store.toast(`Slot ${slot} is empty`);
      return;
    }
    const dec = decodeSave(bytes);
    sim.loadState(dec.meta, dec.layers, dec.entities ?? undefined, dec.policy);
    view.setWorld(sim.world);
    view.syncBuildings(sim.buildings.serialize().slots);
    view.syncIcons(sim.roadAccess.collectBlocked()); // T-204: post-load icon resync
    store.world = sim.world;
    store.set({ snapshot: sim.snapshot(), selectedTile: null });
    store.toast(`Loaded ${slot}${dec.repairs.length > 0 ? ` (${dec.repairs.length} repairs)` : ''}`);
  };
  const actions: UiActions = {
    setTool: (tool) => store.set({ tool, previewCost: null, previewNote: null }),
    setSpeed: (speed) => {
      sim.clock.setSpeed(speed);
      store.set({ snapshot: sim.snapshot() });
    },
    togglePause: () => {
      sim.clock.togglePause();
      store.set({ snapshot: sim.snapshot() });
    },
    save,
    load,
    toggleCamera: () => {
      view.toggleProjection();
      store.set({ projection: view.projection });
    },
    clearSelection: () => store.set({ selectedTile: null }),
    // T-207: land-value overlay — toggle flips store state; binds sim truth through
    // view.attachFields; refresh cadence rides the 250ms snapshot pump below.
    toggleValueOverlay: () => {
      const next = !store.getState().valueOverlay;
      view.attachFields(sim.fields, next);
      store.set({ valueOverlay: next });
    },
    toggleBudget: () => store.set({ budgetOpen: !store.getState().budgetOpen }), // T-303
    // T-302: tax-rate writer (the seam economy.setTax existed for). Pushes a fresh snapshot so the
    // sliders re-render at the clamped value; persistence rides the next save via section 5.
    setTax: (zone, rate) => {
      sim.economy.setTax(zone, rate);
      store.set({ snapshot: sim.snapshot() });
    },
    // T-204 FR-C06: sim-owned blocking reason for the Inspector (growth.growthBlockReason
    // probe; icon layer is the visual twin — both read the same attachment truth).
    growthBlockReason: (x, y) => sim.growth.growthBlockReason(x, y),
    roadAccessReason: () => sim.roadAccess.blockedReason(),
  };

  new ToolController(view.canvas, view, store, host, actions);
  mountReact(uiRoot, store, actions, {
    roadPerTile: COSTS.roadPerTile,
    zonePerTile: COSTS.zonePerTile,
    bulldozeRoad: COSTS.bulldozeRoad,
    bulldozePerTile: COSTS.bulldozePerTile,
  });

  let last = performance.now();
  let snapAcc = 0;
  let lastAutoYear = sim.clock.date().year;
  const loop = (now: number): void => {
    const frameMs = Math.min(now - last, 250);
    last = now;
    let simMs = 0;
    if (!document.hidden) {
      const t0 = performance.now();
      sim.update(frameMs);
      view.applyEvents(sim.drainEvents()); // T-203: building deltas flow into the projection
      simMs = performance.now() - t0;
      snapAcc += frameMs;
      if (snapAcc >= 250) {
        snapAcc = 0;
        store.set({ snapshot: sim.snapshot() });
        view.refreshLandValue(); // T-207 overlay pump (no-op when hidden)
      }
      const d = sim.clock.date();
      if (d.month === 1 && d.day === 1 && d.year !== lastAutoYear) {
        lastAutoYear = d.year;
        void storage.saveAuto(encodeSave(sim));
      }
    }
    const s = store.getState().snapshot;
    view.update(frameMs, s.tick, `Y${s.date.year} M${s.date.month} D${s.date.day}`, simMs);
  };
  view.sceneMgr.renderer.setAnimationLoop(loop);

  const debug: GameDebug = { sim, view, store, storage, actions, save, load };
  (window as unknown as { __game?: GameDebug }).__game = debug;
}

void boot();
