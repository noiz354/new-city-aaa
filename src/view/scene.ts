// SceneManager: renderer + lights + sky + resize. Owns the canvas.
import * as THREE from 'three';

export class SceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly canvas: HTMLCanvasElement;
  private readonly resizeObserver: ResizeObserver;
  private sun: THREE.DirectionalLight;

  constructor(container: HTMLElement, mapMeters: number) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.canvas = this.renderer.domElement;
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    container.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    const sky = new THREE.Color(0x9ec7e8);
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, mapMeters * 0.45, mapMeters * 2.2);

    const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7f6a, 0.9);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff2dd, 1.7);
    this.sun.position.set(mapMeters * 0.35, mapMeters * 0.6, mapMeters * 0.22);
    this.sun.castShadow = true;
    const half = mapMeters / 2;
    const sc = this.sun.shadow.camera;
    sc.left = -half;
    sc.right = half;
    sc.top = half;
    sc.bottom = -half;
    sc.near = 1;
    sc.far = mapMeters * 3;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 1.5;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
  }

  render(): void {
    this.renderer.render(this.scene, this.activeCamera as THREE.Camera);
  }

  /** Set by the CameraRig owner each frame (rig owns camera switching). */
  activeCamera: THREE.OrthographicCamera | THREE.PerspectiveCamera | null = null;

  info(): { draws: number; tris: number } {
    return { draws: this.renderer.info.render.calls, tris: this.renderer.info.render.triangles };
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
    this.renderer.dispose();
    this.canvas.remove();
  }
}
