// ZoneOverlay: ground-hugging displaced plane + DataTexture sampled in-shader.
// NOTE on orientation: PlaneGeometry rotated -90° about X maps uv.y=1 to z=-half
// (tile row y=0), so texture row r holds tile row (size-1-r).
import * as THREE from 'three';
import type { WorldView } from '../shared/types.js';

const ZONE_COLORS: Record<number, [number, number, number]> = {
  1: [0.3, 0.78, 0.32], // R green
  2: [0.13, 0.59, 0.95], // C blue
  3: [1.0, 0.6, 0.0], // I orange
};

export class ZoneOverlay {
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
      pos.setY(i, world.groundHeightAt(pos.getX(i), pos.getZ(i)) + 0.12);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    this.data = new Uint8Array(world.size * world.size * 4);
    this.texture = new THREE.DataTexture(this.data, world.size, world.size, THREE.RGBAFormat);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.needsUpdate = true;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: this.texture },
        uOpacity: { value: 0.42 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          vec4 t = texture2D(map, vUv);
          if (t.a < 0.01) discard;
          gl_FragColor = vec4(t.rgb, t.a * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.name = 'zones';
    this.update(world);
  }

  update(world: WorldView): void {
    const n = this.size;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const z = world.zone[world.idx(x, y)] as number;
        const o = ((n - 1 - y) * n + x) * 4;
        if (z >= 1 && z <= 3) {
          const c = ZONE_COLORS[z] as [number, number, number];
          this.data[o] = Math.round(c[0] * 255);
          this.data[o + 1] = Math.round(c[1] * 255);
          this.data[o + 2] = Math.round(c[2] * 255);
          this.data[o + 3] = 255;
        } else {
          this.data[o + 3] = 0;
        }
      }
    }
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.texture.dispose();
  }
}
