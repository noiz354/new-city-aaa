// Regression: instanced projection layers must stay visible when the camera frames a region far
// from the world origin. three.js culls an InstancedMesh by a bounding sphere it computes once
// (lazily) and never refreshes — a layer that starts empty therefore vanished after the first
// pan/zoom (seen in the T-204 close-up capture: markers gone, draw count dropped).
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BuildingLayer } from './buildings.js';
import { BlockedIconLayer } from './icons.js';

const geo = {
  size: 256,
  tileCenterWorld: (x: number, y: number): { x: number; z: number } => ({ x: (x + 0.5) * 8 - 1024, z: (y + 0.5) * 8 - 1024 }),
  groundHeightAt: (): number => 2,
};

/** Ortho camera looking straight down at a world point with a `height`-metre square frustum. */
function frustumAt(wx: number, wz: number, height: number): THREE.Frustum {
  const cam = new THREE.OrthographicCamera(-height / 2, height / 2, height / 2, -height / 2, 1, 8000);
  cam.position.set(wx, 2000, wz);
  cam.lookAt(wx, 0, wz);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
}

function firstRenderCulling(mesh: THREE.InstancedMesh): void {
  // What the renderer does on the very first frame: lazily compute the (then empty) sphere.
  mesh.updateMatrixWorld();
  if (mesh.boundingSphere === null) mesh.computeBoundingSphere();
}

describe('instanced layers keep their culling sphere in step with live instances', () => {
  it('blocked icons: a marker at tile (120,120) survives a close-up that excludes the origin', () => {
    const icons = new BlockedIconLayer(geo);
    firstRenderCulling(icons.instancedMesh); // empty layer rendered once at boot
    icons.apply({ x: 120, y: 120, blocked: true });
    const c = geo.tileCenterWorld(120, 120);
    const closeUp = frustumAt(c.x, c.z, 120); // origin (0,0) is 90 m away → outside this frustum
    expect(closeUp.containsPoint(new THREE.Vector3(0, 0, 0))).toBe(false); // guard: origin really excluded
    expect(closeUp.intersectsObject(icons.instancedMesh)).toBe(true);
    // Removing the marker shrinks the sphere again (no stale far-away span keeps it "visible").
    icons.apply({ x: 120, y: 120, blocked: false });
    expect(icons.instancedMesh.boundingSphere?.isEmpty()).toBe(true);
    icons.dispose();
  });

  it('buildings: houses placed after boot are inside their mesh bounds; sync + growth refresh them', () => {
    const layer = new BuildingLayer(geo, 2);
    firstRenderCulling(layer.houseMesh);
    firstRenderCulling(layer.constructionMesh);
    layer.apply({ id: 0, x: 200, y: 40, state: 1 }); // scaffold far north-east
    layer.apply({ id: 1, x: 30, y: 220, state: 2 }); // house far south-west
    layer.apply({ id: 2, x: 31, y: 220, state: 2 }); // forces capacity growth (cap 2 → 4)
    const ne = geo.tileCenterWorld(200, 40);
    const sw = geo.tileCenterWorld(30, 220);
    expect(frustumAt(ne.x, ne.z, 100).intersectsObject(layer.constructionMesh)).toBe(true);
    expect(frustumAt(sw.x, sw.z, 100).intersectsObject(layer.houseMesh)).toBe(true);
    expect(frustumAt(ne.x, ne.z, 100).intersectsObject(layer.houseMesh)).toBe(false); // no houses up there
    // Wholesale sync (load) rebuilds bounds from the restored slots only.
    layer.sync([
      { state: 0, x: 0, y: 0, zone: 0, level: 0, occupants: 0, stateSinceTick: 0 },
      { state: 2, x: 10, y: 10, zone: 1, level: 1, occupants: 4, stateSinceTick: 0 },
    ]);
    const near = geo.tileCenterWorld(10, 10);
    expect(frustumAt(near.x, near.z, 100).intersectsObject(layer.houseMesh)).toBe(true);
    expect(frustumAt(sw.x, sw.z, 100).intersectsObject(layer.houseMesh)).toBe(false); // old span dropped
    layer.dispose();
  });
});
