// Pathfinder T-402 fixtures (docs/04 §4–§7 / T-017): exact straight path, congestion-driven
// route switch on a parallel-detour lattice, disconnected → null, expansion-budget greedy
// fallback, determinism (same seed → identical paths), O-D LRU cache + hit-ratio, worker
// protocol round-trip on the sync core, and cache flush on road edits (sim wiring).
import { describe, expect, it } from 'vitest';
import { edgeWeightHours, Pathfinder } from './path.js';
import { handleRouteBatch, type RouteRequest } from './path.worker.js';
import { Sim } from './sim.js';

function sim(): Sim {
  return new Sim({ seed: 7, size: 64, preset: 'plains' });
}

function place(s: Sim, xs: number[], ys: number[]): void {
  const path = xs.map((x, i) => ({ x, y: ys[i]! }));
  const r = s.execute({ kind: 'place-road', path });
  if (!r.ok) throw new Error(`place-road failed: ${r.reason}`);
}

const h = (meters: number): number => meters / (40 * 1000); // free-flow hours at 40 kph

/**
 * 4-node lattice: main straight B—C (160 m) vs parallel detour B—C (224 m) through the
 * bottom street, with endpoint spurs A—B and C—D (16 m each). Congestion on the main edge
 * must flip the optimal route onto the detour (BPR weight, docs/04 §4).
 */
function placeLattice(s: Sim): void {
  place(s, Array.from({ length: 25 }, (_, k) => 8 + k), Array.from({ length: 25 }, () => 20)); // y=20: x 8..32
  place(s, Array.from({ length: 21 }, (_, k) => 10 + k), Array.from({ length: 21 }, () => 24)); // y=24: x 10..30
  place(s, [10, 10, 10], [21, 22, 23]); // west leg
  place(s, [30, 30, 30], [21, 22, 23]); // east leg
}

describe('Pathfinder T-402 — budgeted A* + O-D cache', () => {
  it('straight line: exact nodes/edges/cost; trivial same-node route', () => {
    const s = sim();
    place(s, [10, 11, 12, 13, 14, 15], [10, 10, 10, 10, 10, 10]);
    const g = s.roadGraph;
    const a = g.nodeAt(10, 10);
    const b = g.nodeAt(15, 10);
    const e = g.allEdges()[0]!;
    const pf = new Pathfinder(g);
    const res = pf.route(a, b);
    expect(res).not.toBeNull();
    expect(res!.nodes).toEqual([a, b]);
    expect(res!.edges).toEqual([e.id]);
    expect(res!.costHours).toBeCloseTo(h(5 * 8), 12);
    expect(res!.costHours).toBeCloseTo(edgeWeightHours(e), 12);
    expect(res!.fallback).toBe(false);
    const trivial = pf.route(a, a);
    expect(trivial).not.toBeNull();
    expect(trivial!.nodes).toEqual([a]);
    expect(trivial!.edges).toEqual([]);
    expect(trivial!.costHours).toBe(0);
  });

  it('congestion flips the optimal route onto the parallel detour (BPR weight)', () => {
    const s = sim();
    placeLattice(s);
    const g = s.roadGraph;
    expect(g.nodeCount).toBe(4);
    const A = g.nodeAt(8, 20);
    const D = g.nodeAt(32, 20);
    const main = g.allEdges().find((e) => e.lengthM === 160)!;
    const detour = g.allEdges().find((e) => e.lengthM === 224)!;
    const pf = new Pathfinder(g);

    const free = pf.route(A, D);
    expect(free).not.toBeNull();
    expect(free!.edges[1]).toBe(main.id); // middle leg = main straight
    expect(free!.costHours).toBeCloseTo(h(16 + 160 + 16), 10);
    expect(free!.fallback).toBe(false);

    // Jam the main street: 2600 > 1600 capacity → BPR ≈ 2.05× (160→327 h-units × m⁻¹).
    main.volume = 2600;
    pf.flushCache(); // T-403 hook: daily volume assignment invalidates cached routes
    const jam = pf.route(A, D);
    expect(jam).not.toBeNull();
    expect(jam!.edges[1]).toBe(detour.id);
    expect(jam!.costHours).toBeCloseTo(h(16 + 224 + 16), 3);
    expect(jam!.costHours).toBeLessThan(0.0085); // still cheaper than the jammed main (~0.0090)
  });

  it('disconnected O-D → null (docs/04 §7 no-path)', () => {
    const s = sim();
    place(s, [10, 11, 12], [10, 10, 10]);
    place(s, [40, 41, 42], [40, 40, 40]); // separate island component
    const g = s.roadGraph;
    expect(g.componentCount).toBe(2);
    const pf = new Pathfinder(g);
    expect(pf.route(g.nodeAt(10, 10), g.nodeAt(42, 40))).toBeNull();
    expect(pf.route(g.nodeAt(10, 10), g.nodeAt(12, 10))).not.toBeNull();
  });

  it('expansion budget: primary pass starves → greedy fallback arrives (flag set); both starved → null', () => {
    const s = sim();
    placeLattice(s);
    const g = s.roadGraph;
    const A = g.nodeAt(8, 20);
    const D = g.nodeAt(32, 20);
    const tight = new Pathfinder(g, { maxExpansions: 3 }); // A→D needs ≥ 4 pops at A* rank
    const res = tight.route(A, D);
    expect(res).not.toBeNull();
    expect(res!.fallback).toBe(true);
    expect(res!.nodes[0]).toBe(A);
    expect(res!.nodes[res!.nodes.length - 1]).toBe(D);
    expect(tight.stats().fallbacks).toBe(1);
    const starved = new Pathfinder(g, { maxExpansions: 0 });
    expect(starved.route(A, D)).toBeNull(); // deterministic: null, not a partial path
  });

  it('deterministic: same seed → identical path sequences across an identical graph', () => {
    const s1 = sim();
    const s2 = sim();
    placeLattice(s1);
    placeLattice(s2);
    const flat = (s: Sim): [number, number][] => {
      const g = s.roadGraph;
      const ns = [g.nodeAt(8, 20), g.nodeAt(10, 20), g.nodeAt(30, 20), g.nodeAt(32, 20)];
      return [
        [ns[0]!, ns[3]!],
        [ns[3]!, ns[0]!],
        [ns[1]!, ns[2]!],
        [ns[2]!, ns[1]!],
        [ns[0]!, ns[2]!],
        [ns[1]!, ns[3]!],
      ];
    };
    const seq = (s: Sim): string => {
      const pf = new Pathfinder(s.roadGraph);
      return JSON.stringify(flat(s).map(([o, d]) => pf.route(o, d)));
    };
    expect(seq(s1)).toBe(seq(s2));
  });

  it('O-D cache: hit serves identical result; LRU bounds size; hit-ratio reported', () => {
    const s = sim();
    placeLattice(s);
    const g = s.roadGraph;
    const A = g.nodeAt(8, 20);
    const D = g.nodeAt(32, 20);
    const B = g.nodeAt(10, 20);
    const pf = new Pathfinder(g, { cacheMaxEntries: 2 });
    const first = pf.route(A, D)!;
    expect(pf.stats().hits).toBe(0);
    const second = pf.route(A, D)!;
    expect(pf.stats().hits).toBe(1);
    expect(second.edges).toEqual(first.edges);
    expect(second.nodes).toEqual(first.nodes);
    pf.route(B, D); // miss → evict LRU (A,D stays hot … B,D newest)
    pf.route(A, D); // hit again (A,D was refreshed by the earlier hit)
    expect(pf.stats().cacheSize).toBeLessThanOrEqual(2);
    expect(pf.hitRatio()).toBeGreaterThan(0);
    expect(pf.stats().misses).toBeGreaterThan(0);
  });

  it('worker protocol: batch replies reqId-sorted, stale buckets skipped, results match sync route', () => {
    const s = sim();
    placeLattice(s);
    const g = s.roadGraph;
    const A = g.nodeAt(8, 20);
    const D = g.nodeAt(32, 20);
    const pf = new Pathfinder(g);
    const reqs = structuredClone([
      { reqId: 7, origin: A, dest: D, versionBucket: g.graphVersion },
      { reqId: 2, origin: D, dest: A, versionBucket: g.graphVersion },
      { reqId: 5, origin: A, dest: D, versionBucket: g.graphVersion + 99 }, // stale
    ] satisfies RouteRequest[]);
    const replies = handleRouteBatch(pf, g.graphVersion, reqs);
    expect(replies.map((r) => r.reqId)).toEqual([2, 5, 7]); // reqId-sorted, never completion order
    expect(replies[0]!.ok).toBe(true);
    expect(replies[1]!.stale).toBe(true); // mismatched versionBucket → skipped for free
    expect(replies[1]!.nodes).toBeNull();
    expect(replies[2]!.ok).toBe(true);
    expect(replies[2]!.edges).toEqual(pf.route(A, D)!.edges); // worker-core = main-thread-core
  });

  it('cache flushes on road edits via sim wiring (place-road + bulldoze + load)', () => {
    const s = sim();
    placeLattice(s);
    const A = s.roadGraph.nodeAt(8, 20);
    const D = s.roadGraph.nodeAt(32, 20);
    s.pathfinder.route(A, D);
    expect(s.pathfinder.stats().cacheSize).toBeGreaterThan(0);
    const r = s.execute({ kind: 'place-road', path: [{ x: 50, y: 50 }] }); // unrelated road
    expect(r.ok).toBe(true);
    expect(s.pathfinder.stats().cacheSize).toBe(0); // explicit flush at the edit site
    s.pathfinder.route(A, D);
    const b = s.execute({ kind: 'bulldoze', rect: { x0: 50, y0: 50, x1: 50, y1: 50 } });
    expect(b.ok).toBe(true);
    expect(s.pathfinder.stats().cacheSize).toBe(0);
    // ...and a load rebuild flushes too (covered by codec round-trips: no stale routes span a load).
  });
});
