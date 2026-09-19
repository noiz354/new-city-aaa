import { describe, expect, it } from 'vitest';
import { Clock, TICKS_PER_DAY } from './clock.js';

describe('Clock', () => {
  it('accumulates fractional time and runs whole ticks (1x = 2 tps)', () => {
    const c = new Clock();
    let ticks = 0;
    expect(c.update(250, () => ticks++)).toBe(0); // 0.5 tick banked
    expect(c.update(250, () => ticks++)).toBe(1); // completes the tick
    expect(ticks).toBe(1);
    expect(c.tick).toBe(1);
  });

  it('is FPS-independent: same total time => same ticks regardless of chunking', () => {
    const run = (chunks: number[]): number => {
      const c = new Clock();
      let n = 0;
      for (const ms of chunks) c.update(ms, () => n++);
      return n;
    };
    // totals sit 0.2 ticks clear of any tick boundary so float residue can't flip a count
    const a = run(Array.from({ length: 126 }, () => 1000 / 60)); // 2.1 s @60fps
    const b = run([1000, 1100]); // 2.1 s in 2 chunks (each clamped to 250ms!)
    const c = run([250, 250, 250, 250, 250, 250, 250, 250, 100]); // 2.1 s exact
    expect(a).toBe(4); // 2.1s * 2tps = 4.2 -> 4 ticks
    expect(c).toBe(4); // same total, different chunking -> identical ticks
    expect(b).toBe(1); // 2 x 250ms x 2tps = 1 tick (debt dropped by design)
  });

  it('caps ticks per frame (spiral-of-death guard)', () => {
    const c = new Clock(() => 0, { maxTicksPerFrame: 3 });
    c.setSpeed(3); // 12 tps
    expect(c.update(250, () => {})).toBe(3); // 3 ticks, rest dropped
  });

  it('computes calendar dates (24 ticks/day, 30-day months)', () => {
    const c = new Clock();
    expect(c.date()).toEqual({ year: 1, month: 1, day: 1, dayIndex: 0 });
    // 250ms chunks: 500ms+ would hit the clamp and bank only half a tick each
    for (let i = 0; i < TICKS_PER_DAY * 2; i++) c.update(250, () => {}); // 24 ticks = 1 day at 1x
    expect(c.date().dayIndex).toBe(1);
    expect(c.date().day).toBe(2);
  });

  it('pauses and resumes', () => {
    const c = new Clock();
    c.setSpeed(0);
    expect(c.update(10_000, () => {})).toBe(0);
    c.togglePause();
    expect(c.paused).toBe(false);
  });
});
