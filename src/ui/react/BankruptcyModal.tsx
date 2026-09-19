import type { JSX } from 'react';
import type { SimSnapshot } from '../../shared/types.js';

/**
 * T-301 docs/02 §4: balance < −$5,000 forces this modal and blocks paid commands
 * (gate lives in Sim.execute — engine truth; this is presentation only). Almighty minimal:
 * T-303's budget panel subsumes the breakdown; this modal just shows last month's ledger.
 */
export function BankruptcyModal({ snapshot }: { snapshot: SimSnapshot }): JSX.Element | null {
  if (!snapshot.bankrupt) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal panel" role="alertdialog" aria-label="City bankrupt">
        <h2>City Bankrupt</h2>
        <p>
          Treasury fell below −$5,000. Paid commands (roads, zones, bulldoze) are blocked until the
          balance recovers. Last month: income ${snapshot.lastMonth.income.toLocaleString('en-US')},
          expenses ${snapshot.lastMonth.expense.toLocaleString('en-US')}.
        </p>
        <p className="dim">Frontier subsidy keeps cities under 500 pop afloat — growth is the way out.</p>
      </div>
    </div>
  );
}
