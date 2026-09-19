// Fixed-timestep accumulator clock (ADR-01). No wall-clock reads: time is injected.
// TICKS_PER_DAY=24: 1 game-hour per tick; month=30d, year=12mo.
import type { SimDate } from '../shared/types.js';

export type Speed = 0 | 1 | 2 | 3; // paused, 1x, 2x, 3x
export const TICKS_PER_SECOND: Record<Speed, number> = { 0: 0, 1: 2, 2: 6, 3: 12 };
export const TICKS_PER_DAY = 24;
export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = 12;

export interface ClockState {
  tick: number;
  accumulator: number;
  speed: Speed;
}

export class Clock {
  tick = 0;
  accumulator = 0;
  speed: Speed = 1;
  readonly maxTicksPerFrame: number;
  /** EMA of tick callback cost in ms (display only; never affects state). */
  emaTickMs = 0;

  constructor(
    private readonly now: () => number = () => 0,
    opts?: { maxTicksPerFrame?: number },
  ) {
    this.maxTicksPerFrame = opts?.maxTicksPerFrame ?? 8;
  }

  get paused(): boolean {
    return this.speed === 0;
  }

  setSpeed(speed: Speed): void {
    this.speed = speed;
  }

  togglePause(): Speed {
    this.speed = this.paused ? 1 : 0;
    return this.speed;
  }

  date(): SimDate {
    const dayIndex = Math.floor(this.tick / TICKS_PER_DAY);
    const year = Math.floor(dayIndex / (DAYS_PER_MONTH * MONTHS_PER_YEAR)) + 1;
    const month = Math.floor(dayIndex / DAYS_PER_MONTH) % MONTHS_PER_YEAR + 1;
    const day = (dayIndex % DAYS_PER_MONTH) + 1;
    return { year, month, day, dayIndex };
  }

  /** Advance by real elapsed ms; runs whole ticks via onTick. Returns ticks executed. */
  update(realDtMs: number, onTick: (tick: number) => void): number {
    if (this.paused) return 0;
    const clamped = Math.min(Math.max(realDtMs, 0), 250);
    this.accumulator += (clamped / 1000) * TICKS_PER_SECOND[this.speed];
    let n = 0;
    while (this.accumulator >= 1 && n < this.maxTicksPerFrame) {
      this.accumulator -= 1;
      this.tick += 1;
      const t0 = this.now();
      onTick(this.tick);
      const cost = this.now() - t0;
      this.emaTickMs += (cost - this.emaTickMs) * 0.05;
      n++;
    }
    if (this.accumulator >= 1) this.accumulator = 0; // spiral-of-death guard (time debt dropped, state stays valid)
    return n;
  }

  getState(): ClockState {
    return { tick: this.tick, accumulator: this.accumulator, speed: this.speed };
  }

  setState(s: ClockState): void {
    this.tick = s.tick;
    this.accumulator = s.accumulator;
    this.speed = s.speed;
  }
}
