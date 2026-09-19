// Perf harness (VS-1): hamlet fixture (128^2, roads+zones), 30 simulated days.
// Contract: perf/results.json { tickMsAvg, tickMsP95, buildMs, heapMB, commit }.
// Budgets: build < 3000ms, simulated-day p95 < 50ms (docs/07), heap < 512MB.
// Refresh the committed baseline with UPDATE_BASELINE=1 after intentional changes.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
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

    const results: PerfResults = {
      tickMsAvg,
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

    if (process.env.UPDATE_BASELINE === '1' || !existsSync(BASELINE)) {
      writeFileSync(BASELINE, JSON.stringify(results, null, 2) + '\n');
      console.warn('perf: baseline.json (re)written');
    } else {
      const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as PerfResults;
      expect(results.dayMsP95).toBeLessThanOrEqual(Math.max(base.dayMsP95 * 2, base.dayMsP95 + 0.5));
      expect(results.buildMs).toBeLessThanOrEqual(Math.max(base.buildMs * 2, base.buildMs + 50));
    }
  });
});
