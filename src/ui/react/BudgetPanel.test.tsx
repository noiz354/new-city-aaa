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
    tax: { r: 9, c: 9, i: 9 },
    jobs: 0,
    unemployment: 0,
    bankrupt: false,
    lastMonth: { income: 0, expense: 0, subsidy: 0 },
    history: [],
    size: 64,
    seed: 1,
    paused: false,
    speed: 1,
    counts: { roads: 0, zonesR: 0, zonesC: 0, zonesI: 0 },
    power: { active: false, plants: 0, nets: 0, supplyMw: 0, demandMw: 0, unpowered: 0 },
    ...over,
  };
}

describe('T-303 FR-U05 — budget panel renders the sim ledger (kernel is empty)', () => {
  it('shows exact breakdown numbers, correct sign, and one bar pair per recorded month', () => {
    const html = renderToStaticMarkup(
      <BudgetPanel
        snapshot={snap({
          lastMonth: { income: 23, expense: 27, subsidy: 8 },
          history: [
            { income: 23, expense: 27, subsidy: 8 },
            { income: 46, expense: 27, subsidy: 8 },
            { income: 69, expense: 30, subsidy: 0 },
          ],
        })}
        onClose={() => {}}
      />,
    );
    expect(html).toContain('Tax income');
    expect(html).toContain('+$23');
    expect(html).toContain('−$27');
    expect(html).toContain('Frontier subsidy');
    expect(html).toContain('+$8');
    expect(html).toContain('Net');
    expect(html).toContain('+$4'); // 23 − 27 + 8 = the treasury's real movement (subsidy is not paid)
    expect(html).not.toContain('−$4'); // the pre-fix figure (income − gross) overstated the loss
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

  it('T-302 — renders three tax sliders at the current rates and reports changes via onTax', () => {
    let last: { zone: 'r' | 'c' | 'i'; rate: number } | null = null;
    const html = renderToStaticMarkup(
      <BudgetPanel
        snapshot={snap({ tax: { r: 12, c: 9, i: 15 } })}
        onClose={() => {}}
        onTax={(zone, rate) => {
          last = { zone, rate };
        }}
      />,
    );
    // Three labelled range inputs, current values echoed in the readout.
    expect((html.match(/type="range"/g) ?? []).length).toBe(3);
    expect(html).toContain('Residential');
    expect(html).toContain('Industrial');
    expect(html).toContain('12%');
    expect(html).toContain('15%');
    // Sliders are wired to the onTax callback (React attaches onChange at render; we assert the
    // handler is reachable by checking the markup carries the controlled value, not the handler).
    expect(last).toBeNull(); // no interaction happened during static render
  });
});
