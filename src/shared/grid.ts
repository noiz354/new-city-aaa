// Pure grid math (shared so sim/ and ui/ both use it without coupling).
import type { TilePos, TileRect } from './types.js';

export function normalizeRect(a: TilePos, b: TilePos): TileRect {
  return {
    x0: Math.min(a.x, b.x),
    y0: Math.min(a.y, b.y),
    x1: Math.max(a.x, b.x),
    y1: Math.max(a.y, b.y),
  };
}

export function rectTiles(rect: TileRect): TilePos[] {
  const out: TilePos[] = [];
  for (let y = rect.y0; y <= rect.y1; y++) for (let x = rect.x0; x <= rect.x1; x++) out.push({ x, y });
  return out;
}

/** Manhattan L-path: horizontal leg first, then vertical. Deduplicated. */
export function planRoadPath(from: TilePos, to: TilePos): TilePos[] {
  const path: TilePos[] = [];
  const dx = Math.sign(to.x - from.x);
  for (let x = from.x; ; x += dx) {
    path.push({ x, y: from.y });
    if (x === to.x) break;
  }
  const dy = Math.sign(to.y - from.y);
  for (let y = from.y + dy; dy !== 0 && y !== to.y + dy; y += dy) {
    path.push({ x: to.x, y });
  }
  return path;
}
