import { describe, expect, it } from 'vitest';
import { normalizeRect, planRoadPath, rectTiles } from './grid.js';

describe('grid', () => {
  it('normalizes rects regardless of corner order', () => {
    expect(normalizeRect({ x: 5, y: 1 }, { x: 2, y: 4 })).toEqual({ x0: 2, y0: 1, x1: 5, y1: 4 });
  });

  it('enumerates inclusive rect tiles', () => {
    expect(rectTiles({ x0: 0, y0: 0, x1: 1, y1: 1 })).toHaveLength(4);
  });

  it('plans an L path: horizontal leg then vertical, deduplicated', () => {
    const p = planRoadPath({ x: 2, y: 2 }, { x: 4, y: 4 });
    expect(p).toEqual([
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 3 },
      { x: 4, y: 4 },
    ]);
  });

  it('plans straight and single-tile paths', () => {
    expect(planRoadPath({ x: 0, y: 0 }, { x: 3, y: 0 })).toHaveLength(4);
    expect(planRoadPath({ x: 7, y: 7 }, { x: 7, y: 7 })).toEqual([{ x: 7, y: 7 }]);
  });
});
