// Power view layers (T-405): projections of sim PowerGrid truth — never owners of it.
//   UnpoweredIconLayer — amber tetrahedron over every relevant tile without power
//     (the "overload → ikon unpowered" half of the T-405 acceptance). Tetrahedron, not the
//     red octahedron of BlockedIconLayer, so the two states differ by shape AND colour.
//   PlantLayer         — slate boxes marking player-built coal plants.
//   PowerLineLayer     — amber pylons on power-line tiles (resynced wholesale on change).
//   PowerOverlay       — DataTexture tint: supplied conductors green, dead-net conductors
//     faint red, unpowered building tiles strong red, plants amber. Hidden by default;
//     TopBar toggle (P key), same pump contract as LandValueOverlay.
// Same contracts as the T-204 layers: deltas via apply(), wholesale via sync()/update().
import * as THREE from 'three';
import type { TilePos, WorldView } from '../shared/types.js';
import { expandInstanceBounds, refreshInstanceBounds } from './instancing.js';

/** Structural bits the power view needs from sim.PowerGrid (read-only, no sim import). */
export interface PowerView {
  readonly active: boolean;
  poweredAt(x: number, y: number): boolean;
  energizedAt(x: number, y: number): boolean;
  isPlantAt(x: number, y: number): boolean;
}

/** Minimal geometry facts the icon/marker layers need (satisfied by WorldView). */
export interface PowerIconGeo {
  tileCenterWorld(x: number, y: number): { x: number; z: number };
  groundHeightAt(wx: number, wz: number): number;
  size: number;
}

export interface PowerFlip {
  x: number;
  y: number;
  powered: boolean;
}

function yKey(x: number, y: number, size: number): number {
  return y * size + x;
}

class KeyedMarkers {
  readonly group = new THREE.Group();
  protected readonly world: PowerIconGeo;
  protected readonly size: number;
  protected cap: number;
  protected mesh: THREE.InstancedMesh;
  protected readonly keys: number[] = []; // dense: instance index → tile index
  protected readonly indexOf = new Map<number, number>();

  constructor(world: PowerIconGeo, geometry: THREE.BufferGeometry, material: THREE.Material, name: string) {
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
      const m = new THREE.Matrix4();
      this.mesh.getMatrixAt(lastIndex, m);
      this.mesh.setMatrixAt(index, m);
      this.keys[index] = lastKey;
      this.indexOf.set(lastKey, index);
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

export class UnpoweredIconLayer extends KeyedMarkers {
  constructor(world: PowerIconGeo) {
    super(
      world,
      new THREE.TetrahedronGeometry(2.0),
      new THREE.MeshBasicMaterial({ color: 0xe6b400 }),
      'unpowered-icons',
    );
  }

  /** One flip from the sim event drain; unpowered → ensure marker, powered → remove. */
  apply(e: PowerFlip): void {
    if (e.powered) this.removeAt(e.x, e.y);
    else this.add(e.x, e.y);
  }
}

export class PlantLayer extends KeyedMarkers {
  constructor(world: PowerIconGeo) {
    super(
      world,
      new THREE.BoxGeometry(5.5, 7, 5.5),
      new THREE.MeshBasicMaterial({ color: 0x46525e }),
      'power-plants',
    );
  }

  apply(x: number, y: number, present: boolean): void {
    if (present) this.add(x, y);
    else this.removeAt(x, y);
  }
}

export class PowerLineLayer extends KeyedMarkers {
  constructor(world: PowerIconGeo) {
    super(
      world,
      new THREE.CylinderGeometry(0.35, 0.35, 9, 6),
      new THREE.MeshBasicMaterial({ color: 0xd8c23a }),
      'power-lines',
    );
  }

  /** Wholesale resync from the world layer (command + load path; 65k scan, cheap). */
  resync(world: WorldView): void {
    const tiles: TilePos[] = [];
    for (let y = 0; y < world.size; y++) {
      for (let x = 0; x < world.size; x++) {
        if ((world.powerLine[world.idx(x, y)] as number) === 1) tiles.push({ x, y });
      }
    }
    this.sync(tiles);
  }

  /** Plant sites for the PlantLayer (read from the bound PowerView on load). */
  static plantTiles(world: WorldView, power: PowerView): TilePos[] {
    const tiles: TilePos[] = [];
    for (let y = 0; y < world.size; y++) {
      for (let x = 0; x < world.size; x++) {
        if (power.isPlantAt(x, y)) tiles.push({ x, y });
      }
    }
    return tiles;
  }
}

export class PowerOverlay {
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
    this.mesh.name = 'power-overlay';
    this.mesh.visible = false;
  }

  /**
   * Refresh from sim truth: plants amber, supplied conductors green, dead-net conductors
   * faint red, unpowered building tiles strong red. Same orientation mapping as ZoneOverlay:
   * texture row r holds tile row (size-1-r).
   */
  update(world: WorldView, power: PowerView): void {
    const n = this.size;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = world.idx(x, y);
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        if (power.isPlantAt(x, y)) {
          r = 255; g = 180; b = 40; a = 220;
        } else if ((world.building[i] as number) !== -1 && !power.poweredAt(x, y)) {
          r = 220; g = 60; b = 50; a = 200;
        } else if ((world.powerLine[i] as number) === 1 || (world.road[i] as number) === 1) {
          if (power.energizedAt(x, y)) {
            r = 60; g = 190; b = 90; a = 110;
          } else if (power.active) {
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
