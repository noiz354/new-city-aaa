// View: owns SceneManager + rig + layers; polls chunk-dirty flags each frame.
import * as THREE from 'three';
import type { BuildingSlotData, SimEvent, TilePos } from '../shared/types.js';
import { DIRTY_NONE, DIRTY_ROADS, DIRTY_ZONES, type WorldView } from '../shared/types.js';
import { BuildingLayer } from './buildings.js';
import { CameraRig } from './cameras.js';
import { FpsOverlay } from './f3.js';
import { BlockedIconLayer } from './icons.js';
import { LandValueOverlay, type FieldsView } from './landvalue.js';
import { GhostLayer, HoverMarker } from './highlight.js';
import { Picker, type PickResult } from './picking.js';
import { RoadLayer } from './roads.js';
import { SceneManager } from './scene.js';
import { buildTerrainMesh } from './terrain.js';
import { buildWaterMesh } from './water.js';
import { ZoneOverlay } from './zones.js';

export class View {
  private world: WorldView;
  readonly sceneMgr: SceneManager;
  readonly rig: CameraRig;
  readonly picker = new Picker();
  readonly hover = new HoverMarker();
  readonly ghost: GhostLayer;
  private roads: RoadLayer;
  private zones: ZoneOverlay;
  private terrain: THREE.Mesh;
  private buildings: BuildingLayer;
  private icons: BlockedIconLayer;
  private landValueOv: LandValueOverlay;
  private fields: FieldsView | null = null;
  private readonly f3: FpsOverlay;

  constructor(
    private readonly container: HTMLElement,
    world: WorldView,
  ) {
    this.world = world;
    this.sceneMgr = new SceneManager(container, world.mapMeters);
    this.rig = new CameraRig(this.sceneMgr.canvas, world.mapMeters);
    this.terrain = buildTerrainMesh(world);
    this.sceneMgr.scene.add(this.terrain);
    this.sceneMgr.scene.add(buildWaterMesh(world.mapMeters));
    this.roads = new RoadLayer();
    this.roads.rebuildAll(world);
    this.sceneMgr.scene.add(this.roads.group);
    this.zones = new ZoneOverlay(world);
    this.sceneMgr.scene.add(this.zones.mesh);
    this.buildings = new BuildingLayer(world);
    this.sceneMgr.scene.add(this.buildings.group);
    this.icons = new BlockedIconLayer(world);
    this.sceneMgr.scene.add(this.icons.group);
    this.landValueOv = new LandValueOverlay(world);
    this.sceneMgr.scene.add(this.landValueOv.mesh);
    this.sceneMgr.scene.add(this.hover.group);
    world.chunkDirty.fill(DIRTY_NONE);
    this.ghost = new GhostLayer(this.sceneMgr.scene);
    this.f3 = new FpsOverlay();
  }

  get canvas(): HTMLCanvasElement {
    return this.sceneMgr.canvas;
  }

  get projection(): 'ortho' | 'persp' {
    return this.rig.projection;
  }

  toggleProjection(): void {
    this.rig.toggleProjection();
  }

  /** Full rebuild after load (world object identity changes). */
  setWorld(world: WorldView): void {
    this.world = world;
    this.sceneMgr.scene.remove(this.terrain);
    this.terrain.geometry.dispose();
    (this.terrain.material as THREE.Material).dispose();
    this.terrain = buildTerrainMesh(world);
    this.sceneMgr.scene.add(this.terrain);
    this.roads.rebuildAll(world);
    this.zones.update(world);
    this.buildings.dispose();
    this.buildings = new BuildingLayer(world);
    this.sceneMgr.scene.add(this.buildings.group);
    this.icons.dispose();
    this.icons = new BlockedIconLayer(world);
    this.sceneMgr.scene.add(this.icons.group);
    this.landValueOv.dispose();
    this.landValueOv = new LandValueOverlay(world);
    this.sceneMgr.scene.add(this.landValueOv.mesh);
    if (this.fields !== null) {
      this.landValueOv.update(this.fields);
      this.landValueOv.setVisible(true); // preserve on-state across the load rebuild
    }
    world.chunkDirty.fill(DIRTY_NONE);
  }

  /** Consume the sim event stream (drained once per frame by main). */
  applyEvents(events: SimEvent[]): void {
    for (const e of events) {
      if (e.type === 'building-changed') this.buildings.apply(e);
      else if (e.type === 'road-access-changed') this.icons.apply(e); // T-204 FR-C06
    }
  }

  /** Rebuild the building projection wholesale (boot + post-load full sync). */
  syncBuildings(slots: BuildingSlotData[]): void {
    this.buildings.sync(slots);
  }

  /** Rebuild blocked-attachment markers wholesale (boot + post-load full sync). */
  syncIcons(blocked: TilePos[]): void {
    this.icons.sync(blocked);
  }

  /** T-207: bind the sim Fields (land value truth) and refresh the texture. */
  attachFields(fields: FieldsView, visible: boolean): void {
    this.fields = fields;
    this.landValueOv.update(fields);
    this.landValueOv.setVisible(visible);
  }

  /** 4 Hz refresh while the overlay is on (fields change only at day boundaries anyway). */
  refreshLandValue(): void {
    if (this.fields !== null && this.landValueOv.visible) this.landValueOv.update(this.fields);
  }

  screenToTile(clientX: number, clientY: number): PickResult | null {
    const rect = this.canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
    return this.picker.pick(this.rig.activeCamera, ndcX, ndcY, this.world);
  }

  private syncDirty(): void {
    const flags = this.world.chunkDirty;
    let needZones = false;
    const n = this.world.size / 16;
    for (let cy = 0; cy < n; cy++) {
      for (let cx = 0; cx < n; cx++) {
        const i = cy * n + cx;
        const f = flags[i] as number;
        if (f === DIRTY_NONE) continue;
        if (f & DIRTY_ROADS) this.roads.rebuildChunk(this.world, cx, cy);
        if (f & DIRTY_ZONES) needZones = true;
        flags[i] = DIRTY_NONE;
      }
    }
    if (needZones) this.zones.update(this.world);
  }

  update(frameMs: number, tick: number, date: string, simMs: number): void {
    this.rig.update(frameMs / 1000);
    this.syncDirty();
    this.sceneMgr.activeCamera = this.rig.activeCamera;
    const t0 = performance.now();
    this.sceneMgr.render();
    const renderMs = performance.now() - t0;
    const info = this.sceneMgr.info();
    this.f3.frame(frameMs, { simMs, renderMs, draws: info.draws, tris: info.tris, tick, date });
  }

  tileCenter(tile: TilePos): { x: number; z: number } {
    return this.world.tileCenterWorld(tile.x, tile.y);
  }

  groundY(wx: number, wz: number): number {
    return this.world.groundHeightAt(wx, wz);
  }

  dispose(): void {
    this.rig.dispose();
    this.roads.dispose();
    this.zones.dispose();
    this.buildings.dispose();
    this.icons.dispose();
    this.landValueOv.dispose();
    this.sceneMgr.dispose();
  }
}
