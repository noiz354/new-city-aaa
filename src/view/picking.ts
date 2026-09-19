// Math-plane picking (no raycast-against-mesh): ray vs horizontal plane with
// iterative height refinement so hills pick the correct tile.
import * as THREE from 'three';
import { TILE_M, type TilePos } from '../shared/types.js';
import type { WorldView } from '../shared/types.js';

export interface PickResult {
  tile: TilePos;
  point: THREE.Vector3;
}

export class Picker {
  private readonly raycaster = new THREE.Raycaster();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly hit = new THREE.Vector3();

  pick(
    camera: THREE.Camera,
    ndcX: number,
    ndcY: number,
    world: WorldView,
  ): PickResult | null {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    let planeY = 0;
    let tile: TilePos | null = null;
    for (let i = 0; i < 3; i++) {
      this.plane.constant = -planeY;
      const p = this.raycaster.ray.intersectPlane(this.plane, this.hit);
      if (!p) return null;
      tile = this.worldToTile(p.x, p.z, world);
      if (!tile) return null;
      const c = world.tileCenterWorld(tile.x, tile.y);
      planeY = world.groundHeightAt(c.x, c.z);
    }
    if (!tile) return null;
    return { tile, point: this.hit.clone() };
  }

  worldToTile(wx: number, wz: number, world: WorldView): TilePos | null {
    const half = world.mapMeters / 2;
    const x = Math.floor((wx + half) / TILE_M);
    const y = Math.floor((wz + half) / TILE_M);
    if (!world.inBounds(x, y)) return null;
    return { x, y };
  }
}
