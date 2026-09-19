// Deterministic PRNG (mulberry32). All sim randomness flows through Rng instances.
// Exact state (seed + u32 state) is serialized into saves; streams fork per subsystem/day.
import { fnv1aString } from '../shared/crc32.js';

export interface RngState {
  seed: number;
  state: number;
}

function hashSeed(seed: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  return (h ^ (h >>> 15)) >>> 0;
}

export class Rng {
  private seed: number;
  private state: number;

  constructor(seed: number, state?: number) {
    this.seed = seed >>> 0;
    this.state = (state ?? hashSeed(this.seed)) >>> 0;
  }

  nextUint32(): number {
    this.state = (Math.imul(this.state ^ (this.state >>> 15), this.state | 1)) >>> 0;
    let t = (Math.imul(this.state ^ (this.state >>> 7), this.state | 61) ^ this.state) >>> 0;
    t = (t ^ (t >>> 14)) >>> 0;
    return t;
  }

  /** Float in [0, 1). */
  next(): number {
    return this.nextUint32() / 0x100000000;
  }

  /** Integer in [min, max]. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Deterministic child stream for (subsystem, day). Independent of sibling draws. */
  fork(stream: string, day: number): Rng {
    return new Rng(fnv1aString(`${this.seed}:${stream}:${day >>> 0}`));
  }

  getState(): RngState {
    return { seed: this.seed, state: this.state };
  }

  setState(s: RngState): void {
    this.seed = s.seed >>> 0;
    this.state = s.state >>> 0;
  }

  static dayStream(seed: number, stream: string, day: number): Rng {
    return new Rng(seed).fork(stream, day);
  }
}
