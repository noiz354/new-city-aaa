// RoadLayer: per-chunk merged quads at ground height + offset. Rebuilt on dirty.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TILE_M } from '../shared/types.js';
import { CHUNK, type WorldView } from '../shared/types.js';

const ASPHALT: [number, number, number] = [0.23, 0.24, 0.27];
const JUNCTION: [number, number, number] = [0.28, 0.29, 0.33];

function popcount(m: number): number {
  let n = 0;
  while (m > 0) {
    n += m & 1;
    m >>>= 1;
  }
  return n;
}

export class RoadLayer {
  readonly group = new THREE.Group();
  private readonly chunks = new Map<number, THREE.Mesh>();
  private readonly material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  constructor() {
    this.group.name = 'roads';
  }

  rebuildAll(world: WorldView): void {
    const n = world.size / CHUNK;
    for (let cy = 0; cy < n; cy++) for (let cx = 0; cx < n; cx++) this.rebuildChunk(world, cx, cy);
  }

  rebuildChunk(world: WorldView, cx: number, cy: number): void {
    const key = cy * (world.size / CHUNK) + cx;
    const old = this.chunks.get(key);
    if (old) {
      this.group.remove(old);
      old.geometry.dispose();
      this.chunks.delete(key);
    }
    const parts: THREE.BufferGeometry[] = [];
    for (let ty = cy * CHUNK; ty < (cy + 1) * CHUNK; ty++) {
      for (let tx = cx * CHUNK; tx < (cx + 1) * CHUNK; tx++) {
        const i = world.idx(tx, ty);
        if ((world.road[i] as number) !== 1) continue;
        const c = world.tileCenterWorld(tx, ty);
        const y = world.groundHeightAt(c.x, c.z) + 0.07;
        const g = new THREE.PlaneGeometry(TILE_M * 0.92, TILE_M * 0.92);
        g.rotateX(-Math.PI / 2);
        g.translate(c.x, y, c.z);
        const tint = popcount(world.roadMask[i] as number) >= 3 ? JUNCTION : ASPHALT;
        const count = (g.attributes.position as THREE.BufferAttribute).count;
        const colors = new Float32Array(count * 3);
        for (let v = 0; v < count; v++) {
          colors[v * 3] = tint[0];
          colors[v * 3 + 1] = tint[1];
          colors[v * 3 + 2] = tint[2];
        }
        g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        parts.push(g);
      }
    }
    if (parts.length === 0) return;
    const merged = mergeGeometries(parts);
    for (const p of parts) p.dispose();
    const mesh = new THREE.Mesh(merged, this.material);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.chunks.set(key, mesh);
  }

  clear(): void {
    for (const m of this.chunks.values()) {
      this.group.remove(m);
      m.geometry.dispose();
    }
    this.chunks.clear();
  }

  dispose(): void {
    this.clear();
    this.material.dispose();
  }
}
