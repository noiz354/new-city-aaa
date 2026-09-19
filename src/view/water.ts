// Water plane at y=0 (world water level). Animated shader arrives in VS-5.
import * as THREE from 'three';

export function buildWaterMesh(mapMeters: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(mapMeters, mapMeters);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2e6f9e,
    transparent: true,
    opacity: 0.78,
    roughness: 0.25,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0;
  mesh.receiveShadow = false;
  mesh.name = 'water';
  return mesh;
}
