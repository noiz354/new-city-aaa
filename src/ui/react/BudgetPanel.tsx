import type { JSX } from 'react';
import type { SimSnapshot } from '../../shared/types.js';

type TaxZone = 'r' | 'c' | 'i';

const TAX_ZONES: { zone: TaxZone; label: string }[] = [
  { zone: 'r', label: 'Residential' },
  { zone: 'c', label: 'Commercial' },
  { zone: 'i', label: 'Industrial' },
];

/**
 * T-303 budget panel (docs/02 §4 + UI doc §1 bottom bar): last-month breakdown + 12-month sparkline.
 * Pure presentation of sim truth (snapshot.history/lastMonth). T-302 adds the per-zone tax sliders
 * (0..20 %, default 9) which call onTax → sim.economy.setTax. The funding-slider block is a
 * service-era ledger item (50/100/150% scales service outputs — services land in VS-5; tracked in
 * tasks.md T-303's remaining list), rendered as a disabled placeholder so the layout is canonical.
 */
export function BudgetPanel({
  snapshot,
  onClose,
  onTax,
}: {
  snapshot: SimSnapshot;
  onClose: () => void;
  onTax?: (zone: TaxZone, rate: number) => void;
}): JSX.Element {
  const m = snapshot.lastMonth;
  const history = snapshot.history;
  // Net ≡ what the treasury actually moved: income − gross upkeep + the Frontier subsidy share
  // the city did not pay (docs/02 §4 / docs/05 B6). Omitting the subsidy overstated the loss.
  const net = m.income - m.expense + m.subsidy;
  const maxV = Math.max(1, ...history.flatMap((h) => [h.income, h.expense]));
  const W = 220;
  const H = 48;
  const barW = history.length > 0 ? W / 12 : 12;
  const offset = W - history.length * barW; // right-align: newest month at the right edge
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal panel budget-panel" role="dialog" aria-label="City budget" onClick={(e) => e.stopPropagation()}>
        <div className="budget-head">
          <h2>City Budget</h2>
          <button className="close" onClick={onClose} aria-label="Close budget" title="B">
            ✕
          </button>
        </div>
        <table className="budget-table">
          <tbody>
            <tr>
              <td>Tax income (last month)</td>
              <td className="num pos">+${m.income.toLocaleString('en-US')}</td>
            </tr>
            <tr>
              <td>Upkeep — buildings + roads</td>
              <td className="num neg">−${m.expense.toLocaleString('en-US')}</td>
            </tr>
            <tr>
              <td title="Cities under 500 residents pay 70% of upkeep (docs/05 B6)">Frontier subsidy (pop &lt; 500)</td>
              <td className={`num ${m.subsidy > 0 ? 'pos' : 'dim'}`}>+${m.subsidy.toLocaleString('en-US')}</td>
            </tr>
            <tr className="total">
              <td>Net</td>
              <td className={`num ${net >= 0 ? 'pos' : 'neg'}`}>
                {net >= 0 ? '+' : '−'}${Math.abs(net).toLocaleString('en-US')}
              </td>
            </tr>
          </tbody>
        </table>
        <svg className="spark" width={W} height={H} role="img" aria-label="12-month income/expense sparkline">
          {history.map((h, i) => {
            const x = offset + i * barW;
            const inc = (h.income / maxV) * (H - 4);
            const exp = (h.expense / maxV) * (H - 4);
            return (
              <g key={i}>
                <rect className="bar-inc" x={x} y={H - inc} width={barW / 2 - 1} height={inc} />
                <rect className="bar-exp" x={x + barW / 2} y={H - exp} width={barW / 2 - 1} height={exp} />
              </g>
            );
          })}
          {history.length === 0 && <text className="dim" x={W / 2} y={H / 2} textAnchor="middle">no month settled yet</text>}
        </svg>
        <fieldset className="tax-sliders">
          <legend>Tax rates</legend>
          {TAX_ZONES.map(({ zone, label }) => {
            const rate = snapshot.tax[zone];
            return (
              <div className="tax-row" key={zone}>
                <label htmlFor={`tax-${zone}`}>{label}</label>
                <input
                  id={`tax-${zone}`}
                  type="range"
                  min={0}
                  max={20}
                  step={1}
                  value={rate}
                  onChange={(e) => onTax?.(zone, Number(e.target.value))}
                  aria-label={`${label} tax rate`}
                />
                <span className="tax-value">{rate}%</span>
              </div>
            );
          })}
        </fieldset>
        <p className="dim budget-note">
          Service funding sliders unlock with the services era (VS-5) — outputs scale 50/100/150% per
          docs/02 §4.
        </p>
      </div>
    </div>
  );
}
