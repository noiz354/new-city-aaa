// RoadGraph T-401 fixtures (docs/04-agents-pathfinding §6 / T-016): straight, T-junction, loop,
// disconnected. Nodes = road tiles with 4-neighbour count ≠ 2; edges = maximal count-2 runs;
// pure rings get a pseudo-node self-loop. Also incremental flush == canonical rebuild equality,
// component merge/split on edit, graphVersion monotonic, and determinism.
import { describe, expect, it } from 'vitest';
import { ROAD_CAPACITY } from './roadGraph.js';
import { TILE_M } from '../shared/types.js';
import { Sim } from './sim.js';

function sim(): Sim {
  return new Sim({ seed: 7, size: 64, preset: 'plains' });
}

function place(s: Sim, xs: number[], ys: number[]): void {
  const path = xs.map((x, i) => ({ x, y: ys[i]! }));
  const r = s.execute({ kind: 'place-road', path });
  if (!r.ok) throw new Error(`place-road failed: ${r.reason}`);
}

describe('RoadGraph T-401 — node/edge extraction', () => {
  it('straight line → 2 endpoint nodes, 1 edge, length (N−1)·8, capacity/lanes/speed defaults', () => {
    const s = sim();
    place(s, [10, 11, 12, 13, 14, 15], [10, 10, 10, 10, 10, 10]); // 6-tile horizontal run
    const g = s.roadGraph;
    expect(g.componentCount).toBe(1);
    expect(g.nodeCount).toBe(2);
    expect(g.edgeCount).toBe(1);
    const edge = g.allEdges()[0]!;
    expect(edge.lengthM).toBe(5 * TILE_M); // 6 tiles → 5 travel segments
    expect(edge.a).not.toBe(edge.b);
    expect(edge.lanes).toBe(2);
    expect(edge.speedKph).toBe(40);
    expect(edge.capacity).toBe(ROAD_CAPACITY);
    expect(edge.volume).toBe(0);
    expect(edge.tiles.length).toBe(6);
  });

  it('T-junction → 4 nodes (3 endpoints + junction), 3 edges meeting at the junction', () => {
    const s = sim();
    place(s, [10, 10, 10, 10, 10], [8, 9, 10, 11, 12]); // vertical stem 8..12
    place(s, [11, 12, 13], [10, 10, 10]); // right arm from the junction tile (10,10)
    const g = s.roadGraph;
    expect(g.componentCount).toBe(1);
    expect(g.nodeCount).toBe(4);
    expect(g.edgeCount).toBe(3);
    const junction = g.nodeAt(10, 10);
    expect(junction).toBeGreaterThan(0);
    expect(g.nodeAt(10, 8)).toBeGreaterThan(0);
    expect(g.nodeAt(10, 12)).toBeGreaterThan(0);
    expect(g.nodeAt(13, 10)).toBeGreaterThan(0);
    // pass-through tiles are not nodes
    expect(g.nodeAt(10, 9)).toBe(-1);
    expect(g.nodeAt(11, 10)).toBe(-1);
    for (const e of g.allEdges()) {
      expect(e.a === junction || e.b === junction).toBe(true); // every edge touches the junction
    }
  });

  it('closed loop (no count≠2 tile) → 1 pseudo-node + 1 self-loop edge whose length wraps the ring', () => {
    const s = sim();
    // 3×3 ring (8 tiles), centre (20,20) empty
    place(s, [19, 20, 21, 21, 21, 20, 19, 19], [19, 19, 19, 20, 21, 21, 21, 20]);
    const g = s.roadGraph;
    expect(g.componentCount).toBe(1);
    expect(g.nodeCount).toBe(1);
    expect(g.edgeCount).toBe(1);
    const edge = g.allEdges()[0]!;
    expect(edge.a).toBe(edge.b); // self-loop
    expect(edge.lengthM).toBe(8 * TILE_M); // 8-tile ring → 8 segments
    const node = g.allNodes()[0]!;
    expect(node.edgeIds.length).toBe(2); // self-loop contributes both directions to traversal
  });

  it('disconnected segments → 2 components, 4 nodes, 2 edges (each line its own component)', () => {
    const s = sim();
    place(s, [10, 11, 12], [10, 10, 10]); // segment A
    place(s, [30, 31, 32], [40, 40, 40]); // segment B far away
    const g = s.roadGraph;
    expect(g.componentCount).toBe(2);
    expect(g.nodeCount).toBe(4);
    expect(g.edgeCount).toBe(2);
    expect(g.componentAt(10, 10)).not.toBe(g.componentAt(30, 40));
    expect(g.componentAt(10, 10)).toBe(g.componentAt(12, 10)); // same line = same component
  });
});

describe('RoadGraph T-401 — incremental rebuild + edits', () => {
  it('incremental flush produces the same structure as a canonical full rebuild', () => {
    const s = sim();
    place(s, [10, 11, 12, 13, 14], [10, 10, 10, 10, 10]); // line A
    place(s, [13, 13], [11, 12]); // branch down from (13,10) → T-junction
    place(s, [30, 31, 32], [30, 30, 30]); // separate line B (flush already ran incrementally)
    const flushSig = s.roadGraph.signature();
    s.roadGraph.rebuildAll(); // canonical
    expect(s.roadGraph.signature().split('|')[1]).toBe(flushSig.split('|')[1]); // structure identical
    expect(s.roadGraph.componentCount).toBe(2);
    expect(s.roadGraph.nodeCount).toBe(6); // A junction net: 4 nodes; B line: 2 nodes
    expect(s.roadGraph.edgeCount).toBe(4); // A: 3 + B: 1
  });

  it('placing a connector merges two components into one', () => {
    const s = sim();
    place(s, [10, 11, 12], [10, 10, 10]);
    place(s, [10, 11, 12], [12, 12, 12]);
    expect(s.roadGraph.componentCount).toBe(2);
    place(s, [11], [11]); // vertical link (11,11) joining both horizontal lines
    expect(s.roadGraph.componentCount).toBe(1);
    // (11,11) had count 2 along the new link, but the H now has a junction at (11,10) & (11,12)
    expect(s.roadGraph.nodeAt(11, 10)).toBeGreaterThan(0);
    expect(s.roadGraph.nodeAt(11, 12)).toBeGreaterThan(0);
  });

  it('bulldozing the middle of a line splits one component into two', () => {
    const s = sim();
    place(s, [10, 11, 12, 13, 14], [10, 10, 10, 10, 10]);
    expect(s.roadGraph.componentCount).toBe(1);
    expect(s.roadGraph.edgeCount).toBe(1);
    const r = s.execute({ kind: 'bulldoze', rect: { x0: 12, y0: 10, x1: 12, y1: 10 } });
    if (!r.ok) throw new Error(`bulldoze failed: ${r.reason}`);
    expect(s.roadGraph.componentCount).toBe(2);
    expect(s.roadGraph.edgeCount).toBe(2);
  });

  it('graphVersion is monotonic and bumps on every structural change', () => {
    const s = sim();
    const v0 = s.roadGraph.graphVersion;
    place(s, [10, 11, 12], [10, 10, 10]);
    const v1 = s.roadGraph.graphVersion;
    expect(v1).toBeGreaterThan(v0);
    place(s, [13, 14], [10, 10]);
    expect(s.roadGraph.graphVersion).toBeGreaterThan(v1);
  });

  it('determinism: identical command scripts reproduce identical graph structure + signature', () => {
    const a = sim();
    const b = sim();
    for (const s of [a, b]) {
      place(s, [10, 11, 12, 13], [10, 10, 10, 10]);
      place(s, [12, 12, 12], [11, 12, 13]);
      place(s, [40, 41, 42], [40, 40, 40]);
      s.execute({ kind: 'bulldoze', rect: { x0: 41, y0: 40, x1: 41, y1: 40 } });
    }
    expect(a.roadGraph.signature()).toBe(b.roadGraph.signature());
    expect(a.hash()).toBe(b.hash()); // graph is derived → sim hash unaffected by rebuild path
  });
});
