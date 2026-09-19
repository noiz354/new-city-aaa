// BlockedIconLayer (T-204, FR-C06): the "no road attachment" marker from
// transportation-and-pathfinding §1 — a floating unlit red octahedron over every lot whose
// road-access flag is blocked. Same contract as BuildingLayer: pure projection of sim truth —
// deltas via `apply()` ('road-access-changed'), wholesale sync via `sync()` (boot/load) —
// view never owns which lots are blocked. Procedural, zero assets, no lights (MeshBasicMaterial),
// so it cannot violate the no-new-lights constraint. Keyed by tile index; dense swap-remove.
import * as THREE from 'three';
import type { TilePos } from '../shared/types.js';

/** Minimal geometry facts the layer needs (structurally satisfied by WorldView). */
export interface IconGeo {
  tileCenterWorld(x: number, y: number): { x: number; z: number };
  groundHeightAt(wx: number, wz: number): number;
  size: number;
}

export interface RoadAccessEvent {
  x: number;
  y: number;
  blocked: boolean;
}

export class BlockedIconLayer {
  readonly group = new THREE.Group();
  private readonly world: IconGeo;
  private readonly geometry = new THREE.OctahedronGeometry(1.6);
  private readonly material = new THREE.MeshBasicMaterial({ color: 0xd23c2e });
  private cap: number;
  private mesh: THREE.InstancedMesh;
  private readonly keys: number[] = []; // dense: instance index → tile index
  private readonly indexOf = new Map<number, number>();
  private readonly size: number;

  constructor(world: IconGeo, initialCapacity = 64) {
    this.world = world;
    this.size = world.size;
    this.cap = Math.max(1, initialCapacity);
    this.geometry.translate(0, 7.5, 0); // floats above roofs/sim-strata
    this.mesh = this.makeMesh();
    this.group.add(this.mesh);
    this.group.name = 'blocked-icons';
  }

  get count(): number {
    return this.keys.length;
  }

  has(x: number, y: number): boolean {
    return this.indexOf.has(y * this.size + x);
  }

  /** One flip from the sim event drain; blocked → ensure marker, unblocked → remove. */
  apply(e: RoadAccessEvent): void {
    if (e.blocked) this.add(e.x, e.y);
    else this.remove(yKey(e.x, e.y, this.size));
  }

  /** Full resync from sim.roadAccess.collectBlocked() (boot + post-load). Idempotent. */
  sync(blocked: TilePos[]): void {
    this.keys.length = 0;
    this.indexOf.clear();
    this.mesh.count = 0;
    for (const t of blocked) this.add(t.x, t.y);
  }

  dispose(): void {
    this.group.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }

  // ---- internals ----

  private makeMesh(): THREE.InstancedMesh {
    const m = new THREE.InstancedMesh(this.geometry, this.material, this.cap);
    m.count = 0;
    m.name = 'blocked-icons';
    return m;
  }

  private add(x: number, y: number): void {
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
  }

  private remove(key: number): void {
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
  }

  private grow(): void {
    this.cap *= 2;
    const next = this.makeMesh();
    for (let i = 0; i < this.keys.length; i++) {
      const m = new THREE.Matrix4();
      this.mesh.getMatrixAt(i, m);
      next.setMatrixAt(i, m);
    }
    next.count = this.keys.length;
    this.group.remove(this.mesh);
    this.mesh.dispose();
    this.mesh = next;
    this.group.add(this.mesh);
  }
}

function yKey(x: number, y: number, size: number): number {
  return y * size + x;
}
