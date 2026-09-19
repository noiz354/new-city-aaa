// Deterministic fixtures for tests + perf: scripted cities on fixed seeds.
// Importable ONLY from *.test.ts, perf/, e2e/ (enforced by arch-check).
import { Sim } from '../sim/sim.js';
import { planRoadPath } from '../shared/grid.js';

/** Hamlet: 128^2 plains, road cross + R/C/I blocks. ~11k of 20k starting funds. */
export function buildHamlet(): Sim {
  const sim = new Sim({ seed: 7, size: 128, preset: 'plains' });
  const cx = 64;
  const cy = 64;
  const roads = [
    planRoadPath({ x: 14, y: cy }, { x: 114, y: cy }),
    planRoadPath({ x: cx, y: 14 }, { x: cx, y: 114 }),
    planRoadPath({ x: 14, y: 30 }, { x: 114, y: 30 }),
    planRoadPath({ x: 30, y: 14 }, { x: 30, y: 114 }),
  ];
  for (const path of roads) {
    const r = sim.execute({ kind: 'place-road', path });
    if (!r.ok) throw new Error(`fixture road failed: ${r.reason}`);
  }
  const zones = [
    { rect: { x0: 34, y0: 34, x1: 45, y1: 45 }, zone: 1 as const },
    { rect: { x0: 70, y0: 34, x1: 81, y1: 45 }, zone: 2 as const },
    { rect: { x0: 34, y0: 70, x1: 45, y1: 81 }, zone: 3 as const },
    { rect: { x0: 70, y0: 70, x1: 81, y1: 81 }, zone: 1 as const },
  ];
  for (const z of zones) {
    const r = sim.execute({ kind: 'paint-zone', rect: z.rect, zone: z.zone });
    if (!r.ok) throw new Error(`fixture zone failed: ${r.reason}`);
  }
  return sim;
}

/** Advance a sim by whole days through the public update() path. */
export function runDays(sim: Sim, days: number, chunkMs = 250): void {
  // 1x = 2 ticks/s, 24 ticks/day -> 12 s of updates per day at 1x
  const updatesPerDay = Math.ceil((24 * 1000) / (2 * chunkMs));
  for (let d = 0; d < days; d++) {
    for (let i = 0; i < updatesPerDay; i++) sim.update(chunkMs);
  }
}
