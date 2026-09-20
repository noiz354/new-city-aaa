// Perf harness (VS-1): hamlet fixture (128^2, roads+zones), 30 simulated days.
// Contract: perf/results.json { tickMsAvg, tickMsP95, buildMs, heapMB, commit }.
// Budgets: build < 3000ms, simulated-day p95 < 50ms (docs/07), heap < 512MB.
// Refresh the committed baseline with UPDATE_BASELINE=1 after intentional changes.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Pathfinder } from '../src/sim/path.js';
import { buildHamlet } from '../src/testing/fixtures.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const RESULTS = join(DIR, 'results.json');
const BASELINE = join(DIR, 'baseline.json');

export interface PerfResults {
  tickMsAvg: number;
  tickMsP95: number;
  dayMsP95: number;
  buildMs: number;
  heapMB: number;
  commit: string;
  /** T-402: pathfinding throughput on 500 O-D routes (AC: 500 path < 100ms). Additive. */
  pathsPerDay?: number;
  pathTotalMs?: number;
  pathP95Ms?: number;
  pathCacheHitRatio?: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] as number;
}

describe('perf', () => {
  it('hamlet 30-day run meets budgets and writes results.json', () => {
    const t0 = performance.now();
    const sim = buildHamlet();
    const buildMs = performance.now() - t0;

    const daySamples: number[] = [];
    const tick0 = sim.clock.tick;
    for (let d = 0; d < 30; d++) {
      const s = performance.now();
      for (let i = 0; i < 48; i++) sim.update(250); // 1 day at 1x
      daySamples.push(performance.now() - s);
    }
    const totalUpdateMs = daySamples.reduce((a, b) => a + b, 0);
    const ticks = sim.clock.tick - tick0;
    // per-update-call samples for p95 (48 calls/day; re-derive from day timings is too coarse,
    // so approximate per-tick cost from totals and bound it absolutely)
    const tickMsAvg = totalUpdateMs / ticks;
    daySamples.sort((a, b) => a - b);

    // ── T-402: 500 pathfinding routes, cold cache vs warm O-D cache ──
    const nodeIds = sim.roadGraph.allNodes().map((n) => n.id);
    const PATHS = 500;
    const pathSamples: number[] = [];
    const cold = new Pathfinder(sim.roadGraph, { cacheMaxEntries: 0 }); // raw A* throughput
    for (let k = 0; k < PATHS; k++) {
      const o = nodeIds[k % nodeIds.length] as number;
      const d = nodeIds[(k * 7 + 3) % nodeIds.length] as number;
      const s = performance.now();
      cold.route(o, d);
      pathSamples.push(performance.now() - s);
    }
    pathSamples.sort((a, b) => a - b);
    const pathTotalMs = pathSamples.reduce((a, b) => a + b, 0);
    const warm = new Pathfinder(sim.roadGraph); // same 500 through the O-D LRU cache
    for (let k = 0; k < PATHS; k++) {
      const o = nodeIds[k % nodeIds.length] as number;
      const d = nodeIds[(k * 7 + 3) % nodeIds.length] as number;
      warm.route(o, d);
    }
    const pathCacheHitRatio = warm.hitRatio();
    console.log(
      'perf T-402:',
      JSON.stringify({ pathsPerDay: PATHS, totalMs: pathTotalMs, p95Ms: percentile(pathSamples, 95), cacheHitRatio: pathCacheHitRatio }),
    );

    const results: PerfResults = {
      tickMsAvg,
      pathsPerDay: PATHS,
      pathTotalMs,
      pathP95Ms: percentile(pathSamples, 95),
      pathCacheHitRatio,
      tickMsP95: tickMsAvg, // VS-1: ticks are uniform time-only steps; true p95 arrives with systems (VS-2+)
      dayMsP95: percentile(daySamples, 95),
      buildMs,
      heapMB: process.memoryUsage().heapUsed / 1024 / 1024,
      commit: execSync('git rev-parse --short HEAD', { cwd: DIR }).toString().trim(),
    };
    writeFileSync(RESULTS, JSON.stringify(results, null, 2) + '\n');

    expect(results.buildMs).toBeLessThan(3000);
    expect(results.dayMsP95).toBeLessThan(50);
    expect(results.heapMB).toBeLessThan(512);
    expect(pathTotalMs).toBeLessThan(100); // T-402 accept: 500 path < 100ms (cold cache)

    if (process.env.UPDATE_BASELINE === '1' || !existsSync(BASELINE)) {
      writeFileSync(BASELINE, JSON.stringify(results, null, 2) + '\n');
      console.warn('perf: baseline.json (re)written');
    } else {
      const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as PerfResults;
      expect(results.dayMsP95).toBeLessThanOrEqual(Math.max(base.dayMsP95 * 2, base.dayMsP95 + 0.5));
      expect(results.buildMs).toBeLessThanOrEqual(Math.max(base.buildMs * 2, base.buildMs + 50));
      if (base.pathTotalMs !== undefined) {
        // guard: pre-T-402 baselines lack the path bench → absolute budget only
        expect(pathTotalMs).toBeLessThanOrEqual(Math.max(100, base.pathTotalMs * 2));
        expect(pathCacheHitRatio).toBeGreaterThan(0);
      }
    }
  });
});
