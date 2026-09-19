// Hover marker + drag-ghost (single InstancedMesh, per-instance green/red/yellow).
import * as THREE from 'three';
import { TILE_M } from '../shared/types.js';

export type GhostState = 'ok' | 'err' | 'warn';

const GHOST_COLORS: Record<GhostState, THREE.Color> = {
  ok: new THREE.Color(0x35d05a),
  err: new THREE.Color(0xe5484d),
  warn: new THREE.Color(0xf5b301),
};

export interface GhostTile {
  x: number; // world meters (center)
  z: number;
  y: number; // ground height; offset applied internally
  state: GhostState;
}

export class HoverMarker {
  readonly group = new THREE.Group();

  constructor() {
    const geo = new THREE.PlaneGeometry(TILE_M + 0.4, TILE_M + 0.4);
    geo.rotateX(-Math.PI / 2);
    const fill = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.3, depthWrite: false }),
    );
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(TILE_M + 0.4, TILE_M + 0.4).rotateX(-Math.PI / 2)),
      new THREE.LineBasicMaterial({ color: 0xffe14d }),
    );
    fill.position.y = 0.1;
    edge.position.y = 0.1;
    this.group.add(fill, edge);
    this.group.visible = false;
  }

  setTile(wx: number, wy: number, wz: number): void {
    this.group.position.set(wx, wy, wz);
    this.group.visible = true;
  }

  hide(): void {
    this.group.visible = false;
  }
}

const GHOST_CAP = 4096;

export class GhostLayer {
  readonly mesh: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    const geo = new THREE.PlaneGeometry(TILE_M, TILE_M);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(
      geo,
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false }),
      GHOST_CAP,
    );
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  setTiles(tiles: GhostTile[]): void {
    const n = Math.min(tiles.length, GHOST_CAP);
    for (let i = 0; i < n; i++) {
      const t = tiles[i] as GhostTile;
      this.dummy.position.set(t.x, t.y + 0.15, t.z);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, GHOST_COLORS[t.state]);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear(): void {
    this.mesh.count = 0;
  }
}
