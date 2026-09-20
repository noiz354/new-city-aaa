// View: owns SceneManager + rig + layers; polls chunk-dirty flags each frame.
import * as THREE from 'three';
import type { BuildingSlotData, SimEvent, TilePos } from '../shared/types.js';
import { DIRTY_NONE, DIRTY_ROADS, DIRTY_ZONES, type WorldView } from '../shared/types.js';
import { BuildingLayer } from './buildings.js';
import { CameraRig } from './cameras.js';
import { FpsOverlay } from './f3.js';
import { BlockedIconLayer } from './icons.js';
import { LandValueOverlay, type FieldsView } from './landvalue.js';
import { PlantLayer, PowerLineLayer, PowerOverlay, type PowerView, UnpoweredIconLayer } from './power.js';
import { TowerLayer, UnwateredIconLayer, WaterOverlay, type WaterView } from './watergrid.js';
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
  private powerIcons: UnpoweredIconLayer; // T-405: amber ⚡ markers for unpowered lots
  private plants: PlantLayer; // T-405: coal-plant markers
  private powerLines: PowerLineLayer; // T-405: pylon markers on power-line tiles
  private powerOv: PowerOverlay; // T-405: net tint overlay (hidden by default)
  private power: PowerView | null = null;
  private waterIcons: UnwateredIconLayer; // T-406: blue cones for unwatered lots
  private towers: TowerLayer; // T-406: water-tower markers
  private waterOv: WaterOverlay; // T-406: pressure tint overlay (hidden by default)
  private water: WaterView | null = null;
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
    this.powerIcons = new UnpoweredIconLayer(world);
    this.sceneMgr.scene.add(this.powerIcons.group);
    this.plants = new PlantLayer(world);
    this.sceneMgr.scene.add(this.plants.group);
    this.powerLines = new PowerLineLayer(world);
    this.powerLines.resync(world);
    this.sceneMgr.scene.add(this.powerLines.group);
    this.powerOv = new PowerOverlay(world);
    this.sceneMgr.scene.add(this.powerOv.mesh);
    this.waterIcons = new UnwateredIconLayer(world);
    this.sceneMgr.scene.add(this.waterIcons.group);
    this.towers = new TowerLayer(world);
    this.sceneMgr.scene.add(this.towers.group);
    this.waterOv = new WaterOverlay(world);
    this.sceneMgr.scene.add(this.waterOv.mesh);
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
    this.powerIcons.dispose();
    this.powerIcons = new UnpoweredIconLayer(world);
    this.sceneMgr.scene.add(this.powerIcons.group);
    this.plants.dispose();
    this.plants = new PlantLayer(world);
    this.sceneMgr.scene.add(this.plants.group);
    this.powerLines.dispose();
    this.powerLines = new PowerLineLayer(world);
    this.powerLines.resync(world);
    this.sceneMgr.scene.add(this.powerLines.group);
    this.powerOv.dispose();
    this.powerOv = new PowerOverlay(world);
    this.sceneMgr.scene.add(this.powerOv.mesh);
    if (this.power !== null) {
      this.powerOv.update(world, this.power);
      this.powerOv.setVisible(true); // preserve on-state across the load rebuild
    }
    this.waterIcons.dispose();
    this.waterIcons = new UnwateredIconLayer(world);
    this.sceneMgr.scene.add(this.waterIcons.group);
    this.towers.dispose();
    this.towers = new TowerLayer(world);
    this.sceneMgr.scene.add(this.towers.group);
    this.waterOv.dispose();
    this.waterOv = new WaterOverlay(world);
    this.sceneMgr.scene.add(this.waterOv.mesh);
    if (this.water !== null) {
      this.waterOv.update(world, this.water);
      this.waterOv.setVisible(true); // preserve on-state across the load rebuild
    }
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
      else if (e.type === 'power-changed') this.powerIcons.apply(e); // T-405
      else if (e.type === 'plant-changed') this.plants.apply(e.x, e.y, e.present); // T-405
      else if (e.type === 'power-line-changed') this.powerLines.resync(this.world); // T-405
      else if (e.type === 'water-changed') this.waterIcons.apply(e); // T-406
      else if (e.type === 'tower-changed') this.towers.apply(e.x, e.y, e.present); // T-406
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

  /** Rebuild power markers wholesale (boot + post-load full sync). */
  syncPower(unpowered: TilePos[]): void {
    this.powerIcons.sync(unpowered);
    if (this.power !== null) this.plants.sync(PowerLineLayer.plantTiles(this.world, this.power));
    this.powerLines.resync(this.world);
  }

  /** Rebuild water markers wholesale (boot + post-load full sync). */
  syncWater(unwatered: TilePos[]): void {
    this.waterIcons.sync(unwatered);
    if (this.water !== null) this.towers.sync(TowerLayer.towerTiles(this.world, this.water));
  }

  /** T-406: bind the sim WaterGrid (grid truth) and refresh the overlay tint. */
  attachWater(water: WaterView, visible: boolean): void {
    this.water = water;
    this.towers.sync(TowerLayer.towerTiles(this.world, water));
    this.waterOv.update(this.world, water);
    this.waterOv.setVisible(visible);
  }

  /** 4 Hz refresh while the overlay is on (water flags change only at day boundaries anyway). */
  refreshWater(): void {
    if (this.water !== null && this.waterOv.visible) this.waterOv.update(this.world, this.water);
  }

  /** T-405: bind the sim PowerGrid (grid truth) and refresh the overlay tint. */
  attachPower(power: PowerView, visible: boolean): void {
    this.power = power;
    this.plants.sync(PowerLineLayer.plantTiles(this.world, power));
    this.powerOv.update(this.world, power);
    this.powerOv.setVisible(visible);
  }

  /** 4 Hz refresh while the overlay is on (power flags change only at day boundaries anyway). */
  refreshPower(): void {
    if (this.power !== null && this.powerOv.visible) this.powerOv.update(this.world, this.power);
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

  /** Camera "go to tile" (evidence captures now; alert click-to-locate in T-605). */
  focusTile(tile: TilePos, zoom?: number, instant = false): void {
    const c = this.world.tileCenterWorld(tile.x, tile.y);
    this.rig.focus(c.x, c.z, zoom, instant);
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
