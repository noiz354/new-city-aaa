import type { JSX } from 'react';
import { TERRAIN_FOREST, TERRAIN_GRASS, TERRAIN_ROCK, TERRAIN_SAND, TERRAIN_WATER, type TilePos, type WorldView } from '../../shared/types.js';
import type { UiActions } from '../actions.js';

const TERRAIN_NAMES: Record<number, string> = {
  [TERRAIN_WATER]: 'Water',
  [TERRAIN_GRASS]: 'Grass',
  [TERRAIN_SAND]: 'Sand',
  [TERRAIN_ROCK]: 'Rock',
  [TERRAIN_FOREST]: 'Forest',
};
const ZONE_NAMES: Record<number, string> = { 0: '—', 1: 'Residential', 2: 'Commercial', 3: 'Industrial' };

export function Inspector({
  tile,
  world,
  actions,
}: {
  tile: TilePos | null;
  world: WorldView | null;
  actions: UiActions;
}): JSX.Element {
  if (!tile || !world) {
    return (
      <div className="inspector panel">
        <div className="dim">Select tool (1) + click a tile to inspect.</div>
        <div className="dim">Right-drag pans · wheel zooms · drag with a build tool.</div>
      </div>
    );
  }
  const i = world.idx(tile.x, tile.y);
  const rows: [string, string][] = [
    ['Tile', `${tile.x}, ${tile.y}`],
    ['Terrain', TERRAIN_NAMES[world.terrain[i] as number] ?? '?'],
    ['Slope', world.slopeAt(tile.x, tile.y).toFixed(3)],
    ['Zone', ZONE_NAMES[world.zone[i] as number] ?? '?'],
    ['Road', (world.road[i] as number) === 1 ? 'yes' : 'no'],
  ];
  return (
    <div className="inspector panel">
      <div className=" insp-head">
        <b>Inspector</b>
        <button onClick={() => actions.clearSelection()} title="Close (Esc)">
          ✕
        </button>
      </div>
      {rows.map(([k, v]) => (
        <div className="row" key={k}>
          <span className="dim">{k}</span>
          <span>{v}</span>
        </div>
      ))}
    </div>
  );
}
