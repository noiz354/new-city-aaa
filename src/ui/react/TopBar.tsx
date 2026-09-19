import type { JSX } from 'react';
import type { SimSnapshot } from '../../shared/types.js';
import type { UiActions } from '../actions.js';

function money(n: number): string {
  return `$${n.toLocaleString('en-US')}`;
}

export function TopBar({
  snapshot,
  projection,
  driver,
  actions,
  valueOverlay,
}: {
  snapshot: SimSnapshot;
  projection: 'ortho' | 'persp';
  driver: string;
  actions: UiActions;
  valueOverlay: boolean;
}): JSX.Element {
  const d = snapshot.date;
  const speeds: { label: string; value: 0 | 1 | 2 | 3 }[] = [
    { label: 'II', value: 0 },
    { label: '1×', value: 1 },
    { label: '2×', value: 2 },
    { label: '3×', value: 3 },
  ];
  return (
    <div className="topbar panel">
      <span className="brand">City Builder</span>
      <span className="stat" title="Treasury">
        {money(snapshot.balance)}
      </span>
      <span className="stat dim" title="Population">
        Pop {snapshot.population.toLocaleString('en-US')}
      </span>
      {/* T-206 FR-S02: the canonical RCI bars mirror sim.demand (sim truth, no UI kernel). */}
      <span className="rci" role="group" aria-label="RCI demand">
        {(['r', 'c', 'i'] as const).map((k) => (
          <span key={k} className={`rci-${k} ${snapshot.demand[k] >= 0 ? 'pos' : 'neg'}`} title={`${k.toUpperCase()} demand`}>
            {k.toUpperCase()} {snapshot.demand[k] > 0 ? `+${snapshot.demand[k]}` : snapshot.demand[k]}
          </span>
        ))}
      </span>
      <span className="stat dim" title={`Tick ${snapshot.tick}`}>
        Y{d.year} M{d.month} D{d.day}
      </span>
      <span className="spacer" />
      <span className="seg" role="group" aria-label="Game speed">
        {speeds.map((sp) => (
          <button
            key={sp.label}
            className={snapshot.speed === sp.value ? 'on' : ''}
            onClick={() => actions.setSpeed(sp.value)}
            title={sp.value === 0 ? 'Pause (Space)' : `Speed ${sp.value}x`}
          >
            {sp.label}
          </button>
        ))}
      </span>
      <button onClick={() => void actions.save('city0')} title="Save to slot city0">
        Save
      </button>
      <button onClick={() => void actions.load('city0')} title="Load slot city0">
        Load
      </button>
      <button onClick={() => actions.toggleCamera()} title="Toggle projection (O)">
        {projection === 'ortho' ? 'Ortho' : 'Persp'}
      </button>
      {/* T-207: land-value gradient overlay (FR-S02 context) */}
      <button
        className={valueOverlay ? 'on' : ''}
        onClick={() => actions.toggleValueOverlay()}
        title="Land value overlay (V)"
      >
        Value
      </button>
      <span className="stat dim" title="Save storage driver">
        {driver}
      </span>
    </div>
  );
}
