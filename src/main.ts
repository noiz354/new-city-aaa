// VS-0 scaffold boot: F3 overlay + fixed-timestep loop heartbeat (no sim world yet).
// VS-1 replaces this with the full boot (Sim + View + UI + storage).
import { Clock } from './sim/clock.js';
import { FpsOverlay } from './view/f3.js';

function boot(): void {
  const container = document.getElementById('scene-container');
  if (container) {
    container.textContent = 'VS-0 scaffold: engine loop running (world arrives in VS-1).';
    container.setAttribute(
      'style',
      'display:flex;align-items:center;justify-content:center;height:100vh;' +
        'background:#0b0e11;color:#8b949e;font:14px system-ui,sans-serif;',
    );
  }
  const f3 = new FpsOverlay();
  const clock = new Clock(() => performance.now());
  let last = performance.now();
  let simMs = 0;

  function frame(now: number): void {
    const frameMs = now - last;
    last = now;
    const t0 = performance.now();
    clock.update(frameMs, () => {
      // VS-0: heartbeat only; VS-1 ticks the Sim here.
    });
    simMs = performance.now() - t0;
    const d = clock.date();
    f3.frame(frameMs, {
      simMs,
      renderMs: 0,
      draws: 0,
      tris: 0,
      tick: clock.tick,
      date: `Y${d.year} M${d.month} D${d.day}`,
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
