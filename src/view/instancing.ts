// InstancedMesh bounds helpers shared by the projection layers (buildings, blocked icons, …).
//
// three.js culls an InstancedMesh by `mesh.boundingSphere`, which it computes ONCE (lazily, on
// the first render) from whatever instances exist at that moment and never refreshes. Layers
// that start empty and fill via setMatrixAt therefore keep an empty/stale sphere and vanish as
// soon as the camera frames a region away from the world origin. Every mutation path must go
// through these helpers so culling always follows the live instance span.
import * as THREE from 'three';

const _sphere = new THREE.Sphere();

/** Grow `mesh.boundingSphere` to cover one instance placed at `matrix` (O(1)). */
export function expandInstanceBounds(mesh: THREE.InstancedMesh, matrix: THREE.Matrix4): void {
  const geometry = mesh.geometry;
  if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
  if (mesh.boundingSphere === null) {
    mesh.computeBoundingSphere(); // first touch: covers every live instance, including this one
    return;
  }
  _sphere.copy(geometry.boundingSphere as THREE.Sphere).applyMatrix4(matrix);
  mesh.boundingSphere.union(_sphere);
}

/** Recompute from the live instances (after removals / wholesale sync / capacity growth). */
export function refreshInstanceBounds(mesh: THREE.InstancedMesh): void {
  mesh.computeBoundingSphere();
}
