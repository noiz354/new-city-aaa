// BuildingLayer: projection of sim/buildings.ts into two InstancedMeshes (T-203, FR-R04).
//
// State → mesh mapping (canonical lifecycle, design-doc §2):
//   construction → scaffold box (uniform amber, no per-instance color)
//   occupied     → procedural house (walls + hip roof, default bright tint)
//   abandoned    → SAME house instance with a derelict dark tint (readability first)
//   vacant(0)    → instance removed; both meshes stay dense (swap-remove)
// View never owns truth: this layer is a pure function of sim state — deltas arrive via
// `apply()` (from 'building-changed' events), full rebuild via `sync()` (boot/load) — the
// renderer is never the source of building facts (module-boundaries). Procedural only:
// zero external assets, so a missing GLTF can never crash the slice ("0 crash if assets
// missing", tasks T-203); a future asset pack replaces the two geometries behind the
// same interface. Capacity doubles on demand; instance rotation varies by stable id.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { BuildingSlotData } from '../shared/types.js';

/** Minimal geometry facts the layer needs (structurally satisfied by sim.World). */
export interface BuildingGeo {
  tileCenterWorld(x: number, y: number): { x: number; z: number };
  groundHeightAt(wx: number, wz: number): number;
}

export interface BuildingChangeEvent {
  id: number;
  x: number;
  y: number;
  state: number; // 0=vacant 1=construction 2=occupied 3=abandoned (shared SimEvent contract)
}

type MeshKind = 'construction' | 'house';

const OCCUPIED_TINT = new THREE.Color(1, 1, 1);
const ABANDONED_TINT = new THREE.Color(0.34, 0.34, 0.4);

function buildHouseGeometry(): THREE.BufferGeometry {
  const walls = new THREE.BoxGeometry(4.8, 3.2, 4.8);
  walls.translate(0, 1.6, 0);
  const roof = new THREE.ConeGeometry(3.9, 2.0, 4);
  roof.rotateY(Math.PI / 4); // square hip roof aligned with the walls
  roof.translate(0, 4.2, 0);
  return mergeGeometries([walls, roof]);
}

function buildScaffoldGeometry(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(3.8, 1.8, 3.8);
  g.translate(0, 0.9, 0);
  return g;
}

interface MeshSet {
  mesh: THREE.InstancedMesh;
  ids: number[]; // dense: instance index → building id
  indexOf: Map<number, number>; // building id → instance index
}

export class BuildingLayer {
  readonly group = new THREE.Group();
  private readonly world: BuildingGeo;
  private readonly houseGeometry = buildHouseGeometry();
  private readonly scaffoldGeometry = buildScaffoldGeometry();
  private readonly houseMaterial = new THREE.MeshLambertMaterial({ color: 0xd8c9ae });
  private readonly scaffoldMaterial = new THREE.MeshLambertMaterial({ color: 0xc98a2e });
  private cap: number;
  private constructionSet: MeshSet;
  private houseSet: MeshSet;
  /** building id → which meshset holds it (needed to move/swap between meshes). */
  private readonly placement = new Map<number, MeshKind>();

  constructor(world: BuildingGeo, initialCapacity = 64) {
    this.world = world;
    this.cap = Math.max(1, initialCapacity);
    this.constructionSet = this.makeSet(this.scaffoldGeometry, this.scaffoldMaterial, 'construction');
    this.houseSet = this.makeSet(this.houseGeometry, this.houseMaterial, 'house');
    this.group.add(this.constructionSet.mesh, this.houseSet.mesh);
    this.group.name = 'buildings';
  }

  get constructionMesh(): THREE.InstancedMesh {
    return this.constructionSet.mesh;
  }

  get houseMesh(): THREE.InstancedMesh {
    return this.houseSet.mesh;
  }

  get capacity(): number {
    return this.cap;
  }

  counts(): { construction: number; house: number; total: number } {
    const construction = this.constructionSet.ids.length;
    const house = this.houseSet.ids.length;
    return { construction, house, total: construction + house };
  }

  debugPlacement(id: number): { kind: MeshKind; index: number } | undefined {
    const kind = this.placement.get(id);
    if (kind === undefined) return undefined;
    const set = kind === 'house' ? this.houseSet : this.constructionSet;
    const index = set.indexOf.get(id);
    return index === undefined ? undefined : { kind, index };
  }

  /** Apply one lifecycle delta (from the sim event drain); unknown/0 removes. */
  apply(change: BuildingChangeEvent): void {
    if (change.state === 1) this.place(change, 'construction');
    else if (change.state === 2) this.place(change, 'house', OCCUPIED_TINT);
    else if (change.state === 3) this.place(change, 'house', ABANDONED_TINT);
    else this.remove(change.id);
  }

  /** Full rebuild from the save/live store (boot, load). Idempotent. */
  sync(slots: BuildingSlotData[]): void {
    this.resetSet(this.constructionSet);
    this.resetSet(this.houseSet);
    this.placement.clear();
    for (let id = 0; id < slots.length; id++) {
      const s = slots[id] as BuildingSlotData;
      if (s.state === 0) continue;
      this.apply({ id, x: s.x, y: s.y, state: s.state });
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.constructionSet.mesh.dispose();
    this.houseSet.mesh.dispose();
    this.houseGeometry.dispose();
    this.scaffoldGeometry.dispose();
    this.houseMaterial.dispose();
    this.scaffoldMaterial.dispose();
  }

  // ---- internals ----

  private makeSet(geometry: THREE.BufferGeometry, material: THREE.Material, name: string): MeshSet {
    const mesh = new THREE.InstancedMesh(geometry, material, this.cap);
    mesh.count = 0;
    mesh.name = `buildings-${name}`;
    mesh.frustumCulled = true;
    return { mesh, ids: [], indexOf: new Map() };
  }

  private resetSet(set: MeshSet): void {
    set.ids.length = 0;
    set.indexOf.clear();
    set.mesh.count = 0;
  }

  private setFor(kind: MeshKind): MeshSet {
    return kind === 'house' ? this.houseSet : this.constructionSet;
  }

  private place(change: BuildingChangeEvent, kind: MeshKind, tint?: THREE.Color): void {
    const prevKind = this.placement.get(change.id);
    if (prevKind !== undefined && prevKind !== kind) this.remove(change.id);
    const set = this.setFor(kind);
    let index = set.indexOf.get(change.id);
    if (index === undefined) {
      if (set.ids.length >= this.cap) this.grow();
      index = set.ids.length;
      set.ids.push(change.id);
      set.indexOf.set(change.id, index);
      this.placement.set(change.id, kind);
    }
    const c = this.world.tileCenterWorld(change.x, change.y);
    const y = this.world.groundHeightAt(c.x, c.z);
    const m = new THREE.Matrix4();
    m.makeRotationY((change.id % 4) * (Math.PI / 2)); // deterministic facade variety
    m.setPosition(c.x, y, c.z);
    set.mesh.setMatrixAt(index, m);
    if (set === this.houseSet) set.mesh.setColorAt(index, tint ?? OCCUPIED_TINT);
    set.mesh.count = set.ids.length;
    set.mesh.instanceMatrix.needsUpdate = true;
    if (set.mesh.instanceColor) set.mesh.instanceColor.needsUpdate = true;
  }

  private remove(id: number): void {
    const kind = this.placement.get(id);
    if (kind === undefined) return;
    const set = this.setFor(kind);
    const index = set.indexOf.get(id) as number;
    const lastIndex = set.ids.length - 1;
    if (index !== lastIndex) {
      // swap-remove: move the last instance into the freed slot to stay dense
      const lastId = set.ids[lastIndex] as number;
      const m = new THREE.Matrix4();
      set.mesh.getMatrixAt(lastIndex, m);
      set.mesh.setMatrixAt(index, m);
      set.ids[index] = lastId;
      set.indexOf.set(lastId, index);
      if (set.mesh.instanceColor) {
        const c = new THREE.Color();
        set.mesh.getColorAt(lastIndex, c);
        set.mesh.setColorAt(index, c);
      }
    }
    set.ids.pop();
    set.indexOf.delete(id);
    this.placement.delete(id);
    set.mesh.count = set.ids.length;
    set.mesh.instanceMatrix.needsUpdate = true;
    if (set.mesh.instanceColor) set.mesh.instanceColor.needsUpdate = true;
    set.mesh.computeBoundingSphere(); // frustum culling follows the dense span
  }

  /** Double capacity: rebuild instanced buffers, copy live instances over, free the old ones. */
  private grow(): void {
    this.cap *= 2;
    for (const kind of ['construction', 'house'] as const) {
      const set = this.setFor(kind);
      const geometry = kind === 'house' ? this.houseGeometry : this.scaffoldGeometry;
      const material = kind === 'house' ? this.houseMaterial : this.scaffoldMaterial;
      const next = new THREE.InstancedMesh(geometry, material, this.cap);
      next.name = set.mesh.name;
      next.frustumCulled = true;
      for (let i = 0; i < set.ids.length; i++) {
        const m = new THREE.Matrix4();
        set.mesh.getMatrixAt(i, m);
        next.setMatrixAt(i, m);
        if (set.mesh.instanceColor) {
          const c = new THREE.Color();
          set.mesh.getColorAt(i, c);
          next.setColorAt(i, c);
        }
      }
      next.count = set.ids.length;
      this.group.remove(set.mesh);
      set.mesh.dispose(); // frees instance attribute buffers only; geometry/material are ours
      set.mesh = next;
      this.group.add(next);
    }
  }
}
