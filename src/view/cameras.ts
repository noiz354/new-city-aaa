// CameraRig: orbit/pan/zoom with damped goals + ortho/persp toggle.
// Left-drag is reserved for tools; pan = right/middle-drag, zoom = wheel.
import * as THREE from 'three';

export type Projection = 'ortho' | 'persp';

const MIN_PITCH = (15 * Math.PI) / 180;
const MAX_PITCH = (85 * Math.PI) / 180;

export class CameraRig {
  readonly persp: THREE.PerspectiveCamera;
  readonly ortho: THREE.OrthographicCamera;
  projection: Projection = 'ortho';

  private target = new THREE.Vector3();
  private goalTarget = new THREE.Vector3();
  private yaw = Math.PI / 4;
  private goalYaw = Math.PI / 4;
  private pitch = (50 * Math.PI) / 180;
  private goalPitch = (50 * Math.PI) / 180;
  /** Ortho: frustum height (m). Persp: distance to target (m). */
  private zoom = 420;
  private goalZoom = 420;

  private panning: { x: number; y: number } | null = null;
  private readonly boundKey = (e: KeyboardEvent): void => this.onKey(e);

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly mapMeters: number,
  ) {
    const aspect = this.aspect();
    this.persp = new THREE.PerspectiveCamera(50, aspect, 1, 20000);
    this.ortho = new THREE.OrthographicCamera(-aspect * 210, aspect * 210, 210, -210, 1, 8000);
    canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerup', (e) => this.onUp(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', this.boundKey);
    this.snap();
  }

  get activeCamera(): THREE.OrthographicCamera | THREE.PerspectiveCamera {
    return this.projection === 'ortho' ? this.ortho : this.persp;
  }

  toggleProjection(): Projection {
    this.projection = this.projection === 'ortho' ? 'persp' : 'ortho';
    this.goalZoom = THREE.MathUtils.clamp(this.goalZoom, this.zoomRange()[0], this.zoomRange()[1]);
    this.zoom = THREE.MathUtils.clamp(this.zoom, this.zoomRange()[0], this.zoomRange()[1]);
    return this.projection;
  }

  private zoomRange(): [number, number] {
    return this.projection === 'ortho' ? [40, 1400] : [60, 2600];
  }

  private aspect(): number {
    const r = this.canvas.getBoundingClientRect();
    return r.height > 0 ? r.width / r.height : 16 / 9;
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const [lo, hi] = this.zoomRange();
    this.goalZoom = THREE.MathUtils.clamp(this.goalZoom * Math.pow(1.0015, e.deltaY), lo, hi);
  }

  private onDown(e: PointerEvent): void {
    if (e.button === 1 || e.button === 2) this.panning = { x: e.clientX, y: e.clientY };
  }

  private onMove(e: PointerEvent): void {
    if (!this.panning) return;
    const dx = e.clientX - this.panning.x;
    const dy = e.clientY - this.panning.y;
    this.panning = { x: e.clientX, y: e.clientY };
    this.panByPixels(dx, dy);
  }

  private onUp(e: PointerEvent): void {
    if (e.button === 1 || e.button === 2) this.panning = null;
  }

  private onKey(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const step = Math.PI / 36;
    if (e.code === 'KeyQ') this.goalYaw -= step;
    else if (e.code === 'KeyE') this.goalYaw += step;
    else if (e.code === 'KeyR') this.goalPitch = THREE.MathUtils.clamp(this.goalPitch + step, MIN_PITCH, MAX_PITCH);
    else if (e.code === 'KeyF') this.goalPitch = THREE.MathUtils.clamp(this.goalPitch - step, MIN_PITCH, MAX_PITCH);
    // NOTE: projection toggle (O) lives in ToolController so it flows through
    // actions.toggleCamera and the store stays in sync with the rig.
  }

  private worldPerPixel(): number {
    const hPx = this.canvas.getBoundingClientRect().height || 800;
    if (this.projection === 'ortho') return this.zoom / hPx;
    return (2 * this.zoom * Math.tan((this.persp.fov * Math.PI) / 360)) / hPx;
  }

  private panByPixels(dx: number, dy: number): void {
    const wpp = this.worldPerPixel();
    const ox = Math.sin(this.yaw) * Math.cos(this.pitch);
    const oz = Math.cos(this.yaw) * Math.cos(this.pitch);
    const right = new THREE.Vector3(oz, 0, -ox).normalize();
    const fwd = new THREE.Vector3(-ox, 0, -oz).normalize();
    this.goalTarget.addScaledVector(right, -dx * wpp);
    this.goalTarget.addScaledVector(fwd, dy * wpp);
    this.clampTarget(this.goalTarget);
  }

  private clampTarget(v: THREE.Vector3): void {
    const m = this.mapMeters / 2 + 200;
    v.x = THREE.MathUtils.clamp(v.x, -m, m);
    v.z = THREE.MathUtils.clamp(v.z, -m, m);
    v.y = 0;
  }

  private snap(): void {
    this.target.copy(this.goalTarget);
    this.yaw = this.goalYaw;
    this.pitch = this.goalPitch;
    this.zoom = this.goalZoom;
  }

  update(dtSec: number): void {
    const k = 1 - Math.exp(-12 * Math.max(dtSec, 0.0001));
    this.target.lerp(this.goalTarget, k);
    this.yaw += (this.goalYaw - this.yaw) * k;
    this.pitch += (this.goalPitch - this.pitch) * k;
    this.zoom += (this.goalZoom - this.zoom) * k;

    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    if (this.projection === 'ortho') {
      const aspect = this.aspect();
      const hw = (this.zoom * aspect) / 2;
      const hh = this.zoom / 2;
      this.ortho.left = -hw;
      this.ortho.right = hw;
      this.ortho.top = hh;
      this.ortho.bottom = -hh;
      this.ortho.updateProjectionMatrix();
      this.ortho.position.copy(this.target).addScaledVector(dir, 2000);
      this.ortho.lookAt(this.target);
    } else {
      this.persp.aspect = this.aspect();
      this.persp.near = Math.max(1, this.zoom * 0.02);
      this.persp.far = this.zoom + 9000;
      this.persp.updateProjectionMatrix();
      this.persp.position.copy(this.target).addScaledVector(dir, this.zoom);
      this.persp.lookAt(this.target);
    }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.boundKey);
  }
}
