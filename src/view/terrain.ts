// Terrain mesh: height-displaced plane + per-vertex class colors.
import * as THREE from 'three';
import { TERRAIN_FOREST, TERRAIN_GRASS, TERRAIN_ROCK, TERRAIN_SAND, TERRAIN_WATER, TILE_M } from '../shared/types.js';
import type { WorldView } from '../shared/types.js';

const COLORS: Record<number, [number, number, number]> = {
  [TERRAIN_GRASS]: [0.36, 0.6, 0.28],
  [TERRAIN_SAND]: [0.84, 0.75, 0.54],
  [TERRAIN_ROCK]: [0.5, 0.48, 0.46],
  [TERRAIN_FOREST]: [0.15, 0.4, 0.2],
  [TERRAIN_WATER]: [0.3, 0.44, 0.48],
};

function shade(i: number): number {
  let h = Math.imul(i + 1, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return 0.93 + (0.07 * ((h ^ (h >>> 13)) >>> 0)) / 0x100000000;
}

export function buildTerrainMesh(world: WorldView): THREE.Mesh {
  const size = world.size;
  const mapM = world.mapMeters;
  const geo = new THREE.PlaneGeometry(mapM, mapM, size, size);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const half = mapM / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, world.groundHeightAt(x, z));
    const tx = Math.max(0, Math.min(size - 1, Math.floor((x + half) / TILE_M)));
    const ty = Math.max(0, Math.min(size - 1, Math.floor((z + half) / TILE_M)));
    const kind = world.terrain[world.idx(tx, ty)] as number;
    const c: [number, number, number] = COLORS[kind] ?? [0.36, 0.6, 0.28];
    const s = shade(i);
    colors[i * 3] = (c[0] as number) * s;
    colors[i * 3 + 1] = (c[1] as number) * s;
    colors[i * 3 + 2] = (c[2] as number) * s;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}
