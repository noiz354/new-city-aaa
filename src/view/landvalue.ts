// LandValueOverlay (T-207): gradient projection of sim fields.landValue ("overlay gradien").
// Same pattern as ZoneOverlay: ground-hugging plane + RGBA DataTexture refreshed in JS.
// Pure projection — values arrive from the sim Fields arrays; the overlay never computes
// value itself (module-boundaries: sim is truth). Hidden by default; TopBar toggle (V key).
import * as THREE from 'three';
import type { WorldView } from '../shared/types.js';

/** Structural bits the overlay needs from sim.Fields (read-only). */
export interface FieldsView {
  landValue: Float32Array;
}

/** Gradient ramp, 0..100 → RGBA. SC family convention: low = empty brown, high = rich green. */
export function valueColor(v: number): [number, number, number, number] {
  const t = Math.max(0, Math.min(100, v)) / 100;
  // 0 → (96,72,40) brown · 0.5 → (110,130,64) olive · 1 → (60,190,90) green
  const r = Math.round(96 + t * (60 - 96));
  const g = Math.round(72 + t * (190 - 72));
  const b = Math.round(40 + t * (90 - 40));
  return [r, g, b, 140];
}

export class LandValueOverlay {
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
      pos.setY(i, world.groundHeightAt(pos.getX(i), pos.getZ(i)) + 0.16);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    this.data = new Uint8Array(world.size * world.size * 4);
    this.texture = new THREE.DataTexture(this.data, world.size, world.size, THREE.RGBAFormat);
    this.texture.magFilter = THREE.LinearFilter; // smooth gradient read (vs zone NearestFilter)
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.needsUpdate = true;

    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false }),
    );
    this.mesh.name = 'landvalue-overlay';
    this.mesh.visible = false; // hidden until the player toggles (avoids double-tint on zones)
  }

  /** Refresh the texture from sim truth. Cheap path for toggled-on refreshes (4 Hz max).
   *  Texture row r holds tile row (size-1-r) — same orientation mapping as ZoneOverlay. */
  update(fields: FieldsView): void {
    const n = this.size;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = fields.landValue[y * n + x] as number;
        const [r, g, b, a] = valueColor(v);
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
