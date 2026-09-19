// F3 debug overlay (framework-free): FPS + frame/sim/render stats. Toggled with F3.
export interface FrameStats {
  fps: number;
  frameMs: number;
  simMs: number;
  renderMs: number;
  draws: number;
  tris: number;
  tick: number;
  date: string;
}

export class FpsOverlay {
  private readonly el: HTMLDivElement;
  private visible = true;
  private frames = 0;
  private accMs = 0;
  fps = 0;

  constructor(parent: HTMLElement = document.body) {
    this.el = document.createElement('div');
    this.el.id = 'f3-overlay';
    this.el.setAttribute(
      'style',
      'position:fixed;top:8px;left:8px;z-index:9999;font:11px/1.5 ui-monospace,monospace;' +
        'color:#b6f5c4;background:rgba(8,12,10,.78);padding:6px 8px;border-radius:6px;' +
        'pointer-events:none;white-space:pre;',
    );
    parent.appendChild(this.el);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F3') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? 'block' : 'none';
  }

  /** Call every frame; recomputes fps once per 500 ms and repaints text. */
  frame(frameMs: number, extra: Omit<FrameStats, 'fps' | 'frameMs'>): void {
    this.frames++;
    this.accMs += frameMs;
    if (this.accMs >= 500) {
      this.fps = Math.round((this.frames * 1000) / this.accMs);
      this.frames = 0;
      this.accMs = 0;
      if (this.visible) {
        const avg = (frameMs: number): string => frameMs.toFixed(2);
        this.el.textContent =
          `fps ${this.fps}  frame ${avg(frameMs)} ms  sim ${avg(extra.simMs)} ms  render ${avg(extra.renderMs)} ms\n` +
          `draws ${extra.draws}  tris ${extra.tris}  tick ${extra.tick}  ${extra.date}`;
      }
    }
  }
}
