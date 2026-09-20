import type { JSX } from 'react';
import type { ToolId } from '../../shared/types.js';
import type { PriceList, UiActions } from '../actions.js';

export function Toolbar({
  tool,
  previewCost,
  previewNote,
  actions,
  prices,
}: {
  tool: ToolId;
  previewCost: number | null;
  previewNote: string | null;
  actions: UiActions;
  prices: PriceList;
}): JSX.Element {
  const tools: { id: ToolId; label: string; key: string; tip: string }[] = [
    { id: 'select', label: 'Select', key: '1', tip: 'Inspect tiles' },
    { id: 'road', label: 'Road', key: '2', tip: `Drag to build · $${prices.roadPerTile}/tile` },
    { id: 'zone-r', label: 'Zone R', key: '3', tip: `Residential · $${prices.zonePerTile}/tile` },
    { id: 'zone-c', label: 'Zone C', key: '4', tip: `Commercial · $${prices.zonePerTile}/tile` },
    { id: 'zone-i', label: 'Zone I', key: '5', tip: `Industrial · $${prices.zonePerTile}/tile` },
    { id: 'bulldoze', label: 'Raze', key: '6', tip: 'Bulldoze area' },
    { id: 'power-line', label: 'Pwr Line', key: '7', tip: `Power line · $${prices.powerLinePerTile}/tile` },
    { id: 'plant', label: 'Plant', key: '8', tip: `Coal plant · $${prices.powerPlant} · 60 MW` },
    { id: 'water-tower', label: 'Tower', key: '9', tip: `Water tower · $${prices.waterTower} · 800 kL` },
  ];
  return (
    <div className="toolbar panel">
      {tools.map((t) => (
        <button key={t.id} className={tool === t.id ? 'on' : ''} onClick={() => actions.setTool(t.id)} title={`${t.tip} (${t.key})`}>
          <span className="kbd">{t.key}</span> {t.label}
        </button>
      ))}
      <div className="preview" aria-live="polite">
        {previewCost !== null ? <b>${previewCost.toLocaleString('en-US')}</b> : <span>&nbsp;</span>}
        {previewNote && <span className="note">{previewNote}</span>}
      </div>
    </div>
  );
}
