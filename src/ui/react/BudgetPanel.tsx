import type { JSX } from 'react';
import type { SimSnapshot } from '../../shared/types.js';

/**
 * T-303 budget panel (docs/02 §4 + UI doc §1 bottom bar): last-month breakdown + 12-month sparkline.
 * Pure presentation of sim truth (snapshot.history/lastMonth). The funding-slider block is a
 * service-era ledger item (50/100/150% scales service outputs — services land in VS-5; tracked in
 * tasks.md T-303's remaining list), rendered as a disabled placeholder so the layout is canonical.
 */
export function BudgetPanel({ snapshot, onClose }: { snapshot: SimSnapshot; onClose: () => void }): JSX.Element {
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
        <p className="dim budget-note">
          Service funding sliders unlock with the services era (VS-5) — outputs scale 50/100/150% per
          docs/02 §4. Tax sliders land with T-302 (save-format decision pending, spec §9).
        </p>
      </div>
    </div>
  );
}
