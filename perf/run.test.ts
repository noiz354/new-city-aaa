// Perf harness (VS-0): fixed-timestep tick throughput + schema-valid results.json.
// VS-1 upgrades the workload to the hamlet fixture (30 simulated days).
// Contract: perf/results.json { tickMsAvg, tickMsP95, buildMs, heapMB, commit }.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Clock } from '../src/sim/clock.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const RESULTS = join(DIR, 'results.json');
const BASELINE = join(DIR, 'baseline.json');

export interface PerfResults {
  tickMsAvg: number;
  tickMsP95: number;
  buildMs: number;
  heapMB: number;
  commit: string;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] as number;
}

describe('perf', () => {
  it('tick throughput meets the VS-0 smoke budget and writes results.json', () => {
    const clock = new Clock(() => performance.now());
    const samples: number[] = [];
    const t0 = performance.now();
    // 2000 ticks in 250ms chunks at 3x (12tps): exercises accumulator + callback path
    for (let i = 0; i < 2000; i++) {
      const s = performance.now();
      clock.update(250, () => {});
      samples.push(performance.now() - s);
    }
    const buildMs = performance.now() - t0; // VS-0: no world build yet
    samples.sort((a, b) => a - b);
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const results: PerfResults = {
      tickMsAvg: avg,
      tickMsP95: percentile(samples, 95),
      buildMs,
      heapMB: process.memoryUsage().heapUsed / 1024 / 1024,
      commit: execSync('git rev-parse --short HEAD', { cwd: DIR }).toString().trim(),
    };
    mkdirSync(DIR, { recursive: true });
    writeFileSync(RESULTS, JSON.stringify(results, null, 2) + '\n');
    expect(results.tickMsP95).toBeLessThan(50); // smoke budget; real budgets in VS-1+

    if (!existsSync(BASELINE)) {
      writeFileSync(BASELINE, JSON.stringify(results, null, 2) + '\n');
      console.warn('perf: baseline.json created (first run)');
    } else {
      const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as PerfResults;
      expect(results.tickMsP95).toBeLessThanOrEqual(base.tickMsP95 * 1.5);
    }
  });
});
