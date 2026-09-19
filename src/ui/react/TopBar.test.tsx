import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TopBar } from './TopBar.js';
import type { UiActions } from '../actions.js';
import type { SimSnapshot } from '../../shared/types.js';

const noop = () => {};
const actions = new Proxy({} as UiActions, { get: () => noop }); // TopBar only forwards; never invoked here

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

describe('T-208 FR-U02 — HUD pop/jobs/unemployment follow city growth', () => {
  it('renders grown-city values and changing RCI demand', () => {
    const html = renderToStaticMarkup(
      <TopBar
        snapshot={snap({ population: 1_928, demand: { r: 30, c: -5, i: 12 } })}
        projection="persp"
        driver="webgl2"
        actions={actions}
        valueOverlay={false}
      />,
    );
    // 4 Hz cadence is the 250 ms snapshot pump in main; this strip is always visible.
    expect(html).toContain('1,928');
    expect(html).toContain('Jobs 0');
    expect(html).toContain('Unemp 0%'); // T-305 ledger: honest zeros, visible by design
    expect(html).toContain('+30');
    expect(html).toContain('-5');
    expect(html).toContain('+12');
  });
});
