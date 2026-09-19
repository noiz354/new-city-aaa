import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BudgetPanel } from './BudgetPanel.js';
import type { SimSnapshot } from '../../shared/types.js';

function snap(over: Partial<SimSnapshot>): SimSnapshot {
  return {
    tick: 0,
    date: { year: 1, month: 1, day: 1, dayIndex: 0 },
    balance: 50_000,
    population: 0,
    demand: { r: 0, c: 0, i: 0 },
    jobs: 0,
    unemployment: 0,
    bankrupt: false,
    lastMonth: { income: 0, expense: 0 },
    history: [],
    size: 64,
    seed: 1,
    paused: false,
    speed: 1,
    counts: { roads: 0, zonesR: 0, zonesC: 0, zonesI: 0 },
    ...over,
  };
}

describe('T-303 FR-U05 — budget panel renders the sim ledger (kernel is empty)', () => {
  it('shows exact breakdown numbers, correct sign, and one bar pair per recorded month', () => {
    const html = renderToStaticMarkup(
      <BudgetPanel
        snapshot={snap({
          lastMonth: { income: 23, expense: 27 },
          history: [
            { income: 23, expense: 27 },
            { income: 46, expense: 27 },
            { income: 69, expense: 30 },
          ],
        })}
        onClose={() => {}}
      />,
    );
    expect(html).toContain('Tax income');
    expect(html).toContain('+$23');
    expect(html).toContain('−$27');
    expect(html).toContain('Net');
    expect(html).toContain('−$4'); // 23 − 27 kept honest and red
    expect(html).toContain('sparkline');
    expect((html.match(/<rect/g) ?? []).length).toBe(3 * 2); // one income bar + one expense bar per month
    // Engine-side exactness (history content equals the settled ledger) is covered by
    // src/sim/economy.test.ts — this UI only mirrors, per the umd-not-kernel rule.
  });

  it('renders a placeholder message instead of bars before the first settled month', () => {
    const html = renderToStaticMarkup(<BudgetPanel snapshot={snap({})} onClose={() => {}} />);
    expect(html).toContain('no month settled yet');
    expect((html.match(/<rect/g) ?? []).length).toBe(0);
  });
});
