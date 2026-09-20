// Water view layers (T-406): projections of sim WaterGrid truth — never owners of it.
//   UnwateredIconLayer — blue cone over every relevant tile without water
//     (the "bangunan jauh unwatered" half of the T-406 acceptance).
//   TowerLayer       — slate-blue boxes on tower tiles (event-driven deltas).
//   WaterOverlay     — blue pressure-gradient DataTexture tint over conductors
//     (towers solid, unwatered buildings strong red, supplied conductors blue by
//     pressure, dead-net conductors faint red). Hidden by default (TopBar / W key).
import * as THREE from 'three';
import type { TilePos, WorldView } from '../shared/types.js';
import { expandInstanceBounds, refreshInstanceBounds } from './instancing.js';

/** Structural bits the water view needs from sim.WaterGrid (read-only, no sim import). */
export interface WaterView {
  readonly active: boolean;
  wateredAt(x: number, y: number): boolean;
  isTowerAt(x: number, y: number): boolean;
  pressureAt(x: number, y: number): number;
}

/** Minimal geometry facts the icon/marker layers need (satisfied by WorldView). */
export interface WaterIconGeo {
  tileCenterWorld(x: number, y: number): { x: number; z: number };
  groundHeightAt(wx: number, wz: number): number;
  size: number;
}

export interface WaterFlip {
  x: number;
  y: number;
  watered: boolean;
}

function yKey(x: number, y: number, size: number): number {
  return y * size + x;
}

class KeyedMarkers {
  readonly group = new THREE.Group();
  protected readonly world: WaterIconGeo;
  protected readonly size: number;
  protected cap: number;
  protected mesh: THREE.InstancedMesh;
  protected readonly keys: number[] = []; // dense: instance index → tile index
  protected readonly indexOf = new Map<number, number>();

  constructor(world: WaterIconGeo, geometry: THREE.BufferGeometry, material: THREE.Material, name: string) {
    this.world = world;
    this.size = world.size;
    this.cap = 64;
    geometry.translate(0, 7.5, 0); // floats above roofs/sim-strata
    this.mesh = new THREE.InstancedMesh(geometry, material, this.cap);
    this.mesh.count = 0;
    this.mesh.name = name;
    this.group.add(this.mesh);
    this.group.name = name;
  }

  get count(): number {
    return this.keys.length;
  }

  has(x: number, y: number): boolean {
    return this.indexOf.has(yKey(x, y, this.size));
  }

  sync(tiles: TilePos[]): void {
    this.keys.length = 0;
    this.indexOf.clear();
    this.mesh.count = 0;
    for (const t of tiles) this.add(t.x, t.y);
    refreshInstanceBounds(this.mesh);
  }

  dispose(): void {
    this.group.removeFromParent();
    this.mesh.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }

  protected add(x: number, y: number): void {
    const key = yKey(x, y, this.size);
    if (this.indexOf.has(key)) return;
    if (this.keys.length >= this.cap) this.grow();
    const index = this.keys.length;
    this.keys.push(key);
    this.indexOf.set(key, index);
    const c = this.world.tileCenterWorld(x, y);
    const gy = this.world.groundHeightAt(c.x, c.z);
    const m = new THREE.Matrix4();
    m.setPosition(c.x, gy, c.z);
    this.mesh.setMatrixAt(index, m);
    this.mesh.count = this.keys.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    expandInstanceBounds(this.mesh, m);
  }

  protected removeAt(x: number, y: number): void {
    const key = yKey(x, y, this.size);
    const index = this.indexOf.get(key);
    if (index === undefined) return;
    const lastIndex = this.keys.length - 1;
    if (index !== lastIndex) {
      const lastKey = this.keys[lastIndex] as number;
      this.keys[index] = lastKey;
      this.indexOf.set(lastKey, index);
      const m = new THREE.Matrix4();
      this.mesh.getMatrixAt(lastIndex, m);
      this.mesh.setMatrixAt(index, m);
    }
    this.keys.pop();
    this.indexOf.delete(key);
    this.mesh.count = this.keys.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    refreshInstanceBounds(this.mesh);
  }

  private grow(): void {
    this.cap *= 2;
    const next = new THREE.InstancedMesh(this.mesh.geometry, this.mesh.material, this.cap);
    for (let i = 0; i < this.keys.length; i++) {
      const m = new THREE.Matrix4();
      this.mesh.getMatrixAt(i, m);
      next.setMatrixAt(i, m);
    }
    next.count = this.keys.length;
    next.name = this.mesh.name;
    refreshInstanceBounds(next);
    this.group.remove(this.mesh);
    this.mesh.dispose();
    this.mesh = next;
    this.group.add(this.mesh);
  }
}

export class UnwateredIconLayer extends KeyedMarkers {
  constructor(world: WaterIconGeo) {
    super(
      world,
      new THREE.ConeGeometry(2.0, 5.0, 4),
      new THREE.MeshBasicMaterial({ color: 0x2f9df0 }),
      'unwatered-icons',
    );
  }

  /** One flip from the sim event drain; unwatered → ensure marker, watered → remove. */
  apply(e: WaterFlip): void {
    if (e.watered) this.removeAt(e.x, e.y);
    else this.add(e.x, e.y);
  }
}

export class TowerLayer extends KeyedMarkers {
  constructor(world: WaterIconGeo) {
    super(
      world,
      new THREE.BoxGeometry(6, 10, 6),
      new THREE.MeshBasicMaterial({ color: 0x3e5a78 }),
      'water-towers',
    );
  }

  apply(x: number, y: number, present: boolean): void {
    if (present) this.add(x, y);
    else this.removeAt(x, y);
  }

  /** Tower sites for the TowerLayer (read from the bound WaterView on load). */
  static towerTiles(world: WorldView, water: WaterView): TilePos[] {
    const tiles: TilePos[] = [];
    for (let y = 0; y < world.size; y++) {
      for (let x = 0; x < world.size; x++) {
        if (water.isTowerAt(x, y)) tiles.push({ x, y });
      }
    }
    return tiles;
  }
}

export class WaterOverlay {
  readonly mesh: THREE.Mesh;
  private readonly texture: THREE.DataTexture;
  private readonly data: Uint8Array;
  private readonly size: number;

  constructor(world: WorldView) {
    this.size = world.size;
    const mapM = world.mapMeters;
    const geo = new THREE.PlaneGeometry(mapM, mapM, world.size, world.size);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, world.groundHeightAt(pos.getX(i), pos.getZ(i)) + 0.18);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    this.data = new Uint8Array(world.size * world.size * 4);
    this.texture = new THREE.DataTexture(this.data, world.size, world.size, THREE.RGBAFormat);
    this.texture.magFilter = THREE.NearestFilter; // crisp per-tile read (nets, not gradients)
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.needsUpdate = true;

    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false }),
    );
    this.mesh.name = 'water-overlay';
    this.mesh.visible = false;
  }

  /**
   * Refresh from sim truth: towers solid blue, unwatered building tiles strong red,
   * supplied conductors blue-shaded by pressure, dead-net conductors faint red.
   * Same orientation mapping as ZoneOverlay: texture row r holds tile row (size-1-r).
   */
  update(world: WorldView, water: WaterView): void {
    const n = this.size;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = world.idx(x, y);
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        if (water.isTowerAt(x, y)) {
          r = 80; g = 160; b = 255; a = 220;
        } else if ((world.building[i] as number) !== -1 && !water.wateredAt(x, y)) {
          r = 220; g = 60; b = 50; a = 200;
        } else if ((world.powerLine[i] as number) === 1 || (world.road[i] as number) === 1) {
          if (water.wateredAt(x, y)) {
            // Blue gradient by pressure: deep blue at full pressure, pale when weak.
            const p = Math.max(0, Math.min(1, water.pressureAt(x, y)));
            r = Math.round(40 + 130 * (1 - p));
            g = Math.round(140 + 80 * (1 - p));
            b = 255; a = 150;
          } else if (water.active) {
            r = 150; g = 60; b = 50; a = 110;
          }
        }
        const o = ((n - 1 - y) * n + x) * 4;
        this.data[o] = r;
        this.data[o + 1] = g;
        this.data[o + 2] = b;
        this.data[o + 3] = a;
      }
    }
    this.texture.needsUpdate = true;
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  get visible(): boolean {
    return this.mesh.visible;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.texture.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
