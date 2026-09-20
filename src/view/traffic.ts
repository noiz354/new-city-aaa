// Traffic overlay (T-403, docs/02 §Traffic viz): per-tile LOS tint over every road edge,
// painted straight from RoadGraph truth (edge.volumes are the sim's daily assignment).
//
//   TrafficOverlay — DataTexture tint: LOS A clear-green … LOS F strong red (UJ-03: a jammed
//     corridor reads red; once a parallel street draws the flow away it returns green).
//     TopBar toggle (T key), same pump contract as PowerOverlay/WaterOverlay.
//
// ARCH: view only imports `shared` (arch-check) → the graph seam is the local structural
// TrafficView below, and the LOS ratio thresholds are mirrored from TRAFFIC_TUNING.losVCaps
// (duplication-by-contract, same trade-off as the power/water overlay color tables).
import * as THREE from 'three';
import type { WorldView } from '../shared/types.js';

/** Structural bits the overlay needs from sim.RoadGraph (read-only, no sim import). */
export interface TrafficView {
  allEdges(): Iterable<{
    tiles: Int32Array; // linear tile indices y*size+x
    volume: number;
    capacity: number;
  }>;
}

/** v/c → LOS index 0..5 (caps mirror TRAFFIC_TUNING.losVCaps [0.6,0.7,0.8,0.9,1.0]). */
function losIndexOf(vcr: number): number {
  if (vcr < 0.6) return 0;
  if (vcr < 0.7) return 1;
  if (vcr < 0.8) return 2;
  if (vcr < 0.9) return 3;
  if (vcr < 1.0) return 4;
  return 5;
}

/** LOS A..F → rgba (alpha ramps with severity so congestion pops on the map). */
const LOS_COLORS: readonly (readonly [number, number, number, number])[] = [
  [74, 196, 108, 100], // A — clear green
  [140, 208, 88, 110], // B
  [233, 213, 80, 120], // C — yellow
  [243, 158, 62, 140], // D — amber
  [232, 86, 50, 170], // E — orange/red
  [216, 36, 40, 220], // F — jammed red (UJ-03 "macet merah")
];

export class TrafficOverlay {
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
    this.texture.magFilter = THREE.NearestFilter; // crisp per-tile read
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.needsUpdate = true;

    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false }),
    );
    this.mesh.name = 'traffic-overlay';
    this.mesh.visible = false;
  }

  /**
   * Refresh from graph truth: every edge tile tinted by its v/c LOS. Same orientation rule
   * as ZoneOverlay/PowerOverlay: texture row r holds tile row (size-1-r). Volumes only change
   * at day boundaries (daily assignment), so a 4 Hz pump is plenty while visible.
   */
  update(traffic: TrafficView): void {
    this.data.fill(0); // non-road tiles stay transparent
    const n = this.size;
    for (const e of traffic.allEdges()) {
      const vcr = e.volume / Math.max(1, e.capacity);
      const [r, g, b, a] = LOS_COLORS[losIndexOf(vcr)] as readonly [number, number, number, number];
      for (const tile of e.tiles) {
        const x = tile % n;
        const y = Math.floor(tile / n);
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
