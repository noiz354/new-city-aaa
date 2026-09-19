import { describe, expect, it } from 'vitest';
import { Economy } from './economy.js';
import { COSTS } from './tuning/costs.js';

describe('Economy', () => {
  it('starts funded and spends only when affordable', () => {
    const e = new Economy();
    expect(e.balance).toBe(COSTS.startBalance);
    expect(e.spend(100)).toBe(true);
    expect(e.balance).toBe(COSTS.startBalance - 100);
    expect(e.spend(Number.MAX_SAFE_INTEGER)).toBe(false);
    expect(e.balance).toBe(COSTS.startBalance - 100);
  });
});
