// Pathfinder (T-402, FR-C03): binary-heap A* over RoadGraph with BPR congestion weights,
// an expansion-budgeted search (YAPF control) with a greedy fallback pass, and an LRU O-D
// cache keyed by graphVersion.
//
// Spec: docs/04 §4 + docs/02 transportation §Pathfinding:
//   w(edge) = lengthM/speedKph × (1 + α(v/c)^β)   [hours]
//   heuristic = euclidM / maxSpeed                 [admissible: BPR ≥ 1]
//   budgeted A*; budget habis → greedy fallback + flag (docs/02 §Pathfinding, S-06)
//   cache key = (originNode, destNode, graphVersionBucket)
//
// Derived state: paths and the O-D cache are pure functions of (graph structure, edge
// volumes). NEVER persisted (spec §9 — no codec bump); the sim flushes the cache on road
// edits (noteRect/flush sites) and T-403 will flush after its daily volume assignment.
//
// Determinism: heap compares (f, nodeId) so equal-f ties pop in node-id order; adjacency
// iterates in graph insertion order; greedy pass uses (h, nodeId) with an id tie-break too.
// No RNG, no wall clock.
import type { RoadEdge, RoadGraph } from './roadGraph.js';
import { PATH_TUNING } from './tuning/traffic.js';
import { TILE_M } from '../shared/types.js';

/** Congestion-weighted edge cost in hours (docs/04 §4): free-flow × BPR. */
export function edgeWeightHours(edge: RoadEdge): number {
  const vcr = Math.max(0, edge.volume) / Math.max(1, edge.capacity);
  const bpr = 1 + PATH_TUNING.bprAlpha * vcr ** PATH_TUNING.bprBeta;
  return (edge.lengthM / (edge.speedKph * 1000)) * bpr;
}

/**
 * Binary heap of (priority, value) ordered by (priority asc, value asc). The id tie-break
 * is what makes equal-priority pops deterministic (spec §4 needs deterministic paths).
 */
export class BinaryHeap {
  private keys: number[] = [];
  private vals: number[] = [];

  get size(): number {
    return this.keys.length;
  }

  push(key: number, val: number): void {
    const keys = this.keys;
    const vals = this.vals;
    keys.push(key);
    vals.push(val);
    let i = keys.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.less(i, p)) {
        keys[i] = keys[p] as number;
        vals[i] = vals[p] as number;
        keys[p] = key;
        vals[p] = val;
        i = p;
      } else break;
    }
  }

  /** Pop the minimum (key asc, then value asc); returns the value. */
  pop(): number {
    const keys = this.keys;
    const vals = this.vals;
    const top = vals[0] as number;
    const lastKey = keys.pop() as number;
    const lastVal = vals.pop() as number;
    if (keys.length > 0) {
      keys[0] = lastKey;
      vals[0] = lastVal;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < keys.length && this.less(l, m)) m = l;
        if (r < keys.length && this.less(r, m)) m = r;
        if (m === i) break;
        keys[i] = keys[m] as number;
        vals[i] = vals[m] as number;
        keys[m] = lastKey;
        vals[m] = lastVal;
        i = m;
      }
    }
    return top;
  }

  clear(): void {
    this.keys.length = 0;
    this.vals.length = 0;
  }

  private less(i: number, j: number): boolean {
    const ki = this.keys[i] as number;
    const kj = this.keys[j] as number;
    if (ki !== kj) return ki < kj;
    return (this.vals[i] as number) < (this.vals[j] as number);
  }
}

export interface PathResult {
  /** Node ids in travel order (origin … dest). `[origin]` when origin === dest. */
  nodes: number[];
  /** Edge ids in travel order; empty for a trivial same-node path. */
  edges: number[];
  /** Total weighted cost in hours. */
  costHours: number;
  /** True when the greedy fallback pass produced this path (YAPF budget control fired). */
  fallback: boolean;
}

export interface PathfinderStats {
  cacheSize: number;
  hits: number;
  misses: number;
  computes: number;
  fallbacks: number;
  expansionsLast: number;
}

interface CachedRoute {
  nodes: number[];
  edges: number[];
  costHours: number;
  fallback: boolean;
}

export class Pathfinder {
  private readonly graph: RoadGraph;
  private readonly maxExpansions: number;
  private readonly cacheMaxEntries: number;
  /** LRU O-D cache (insertion-ordered Map); keys embed the graphVersion bucket. */
  private readonly cache = new Map<string, CachedRoute>();
  private seenVersion = -1;
  private hits = 0;
  private misses = 0;
  private computes = 0;
  private fallbacks = 0;
  private expansionsLast = 0;

  constructor(
    graph: RoadGraph,
    opts: { maxExpansions?: number; cacheMaxEntries?: number } = {},
  ) {
    this.graph = graph;
    this.maxExpansions = opts.maxExpansions ?? PATH_TUNING.maxExpansions;
    this.cacheMaxEntries = opts.cacheMaxEntries ?? PATH_TUNING.odCacheMaxEntries;
  }

  /** Drop every cached route (road edits + T-403 daily volume refresh call this). */
  flushCache(): void {
    this.cache.clear();
    this.seenVersion = this.graph.graphVersion;
  }

  hitRatio(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }

  stats(): PathfinderStats {
    return {
      cacheSize: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      computes: this.computes,
      fallbacks: this.fallbacks,
      expansionsLast: this.expansionsLast,
    };
  }

  /**
   * Route origin node → dest node under current congestion weights. Null when the pair is
   * disconnected (docs/04 §7: caller marks the O-D unconnected). Cache hits return a fresh
   * result object over the stored arrays (callers must not mutate either).
   */
  route(origin: number, dest: number): PathResult | null {
    const gv = this.graph.graphVersion;
    if (gv !== this.seenVersion) this.flushCache(); // belt & braces beside the sim flush sites
    const key = `${gv}|${origin}|${dest}`;
    const hit = this.cache.get(key);
    if (hit) {
      this.hits++;
      // LRU refresh: re-insert so the entry stays hot.
      this.cache.delete(key);
      this.cache.set(key, hit);
      return { nodes: hit.nodes, edges: hit.edges, costHours: hit.costHours, fallback: hit.fallback };
    }
    this.misses++;
    const out = this.compute(origin, dest);
    if (!out) return null;
    if (this.cacheMaxEntries > 0) {
      if (this.cache.size >= this.cacheMaxEntries) {
        const oldest = this.cache.keys().next().value;
        if (oldest !== undefined) this.cache.delete(oldest);
      }
      this.cache.set(key, { nodes: out.nodes, edges: out.edges, costHours: out.costHours, fallback: out.fallback });
    }
    return out;
  }

  // ── internals ────────────────────────────────────────────────────────────────

  private compute(origin: number, dest: number): PathResult | null {
    if (origin === dest) {
      this.computes++;
      this.expansionsLast = 0;
      if (!this.graph.node(origin)) return null;
      return { nodes: [origin], edges: [], costHours: 0, fallback: false };
    }
    const destNode = this.graph.node(dest);
    if (!destNode || !this.graph.node(origin)) return null;
    this.computes++;
    const primary = this.search(origin, dest, false);
    this.expansionsLast = primary.expansions;
    let res = primary.result;
    let fallback = false;
    if (res === undefined) {
      // YAPF control: expansion budget exhausted → greedy best-first pass (h only), with
      // doubled headroom (it makes no optimality claim, but must be able to finish streets
      // the strict pass had to abandon). null here = genuinely unreachable.
      const greedy = this.search(origin, dest, true, this.maxExpansions * 2);
      this.expansionsLast += greedy.expansions;
      if (greedy.result !== undefined) {
        res = greedy.result;
        fallback = true;
        this.fallbacks++;
      }
    }
    if (res == null) return null; // both passes drained or starved → no route
    return { ...res, fallback };
  }

  /**
   * One search pass. Returns {result} on reaching dest (undefined if the pass exhausted the
   * expansion budget, null if the frontier drained → unreachable). `greedy` ranks by h only
   * (A* ranks by g+h); both share the (priority, nodeId) deterministic heap order.
   */
  private search(
    origin: number,
    dest: number,
    greedy: boolean,
    expansionLimit = this.maxExpansions,
  ): { result?: Omit<PathResult, 'fallback'> | null; expansions: number } {
    const graph = this.graph;
    const destNode = graph.node(dest);
    if (!destNode) return { result: null, expansions: 0 };
    const hScale = 1 / (PATH_TUNING.maxSpeedKph * 1000); // hours per meter
    const heap = new BinaryHeap();
    const gScore = new Map<number, number>();
    const cameEdge = new Map<number, number>();
    const closed = new Set<number>();
    const hOf = (node: number): number => {
      const n = graph.node(node);
      if (!n) return 0;
      return Math.hypot(n.x - destNode.x, n.y - destNode.y) * TILE_M * hScale;
    };
    gScore.set(origin, 0);
    heap.push(hOf(origin), origin);
    let expansions = 0;
    while (heap.size > 0) {
      if (expansions >= expansionLimit) return { result: undefined, expansions }; // budget out
      const u = heap.pop();
      if (closed.has(u)) continue;
      closed.add(u);
      expansions++;
      if (u === dest) return { result: this.reconstruct(origin, dest, cameEdge), expansions };
      const guRaw = gScore.get(u); // greedy ignores accumulated g
      const gu = greedy || guRaw === undefined ? 0 : guRaw;
      for (const eid of graph.edgesFrom(u)) {
        const e = graph.edge(eid);
        if (!e) continue;
        const v = e.a === u ? e.b : e.a;
        if (v === u || closed.has(v)) continue; // self-loops carry no O-D value
        const ng = gu + edgeWeightHours(e);
        const old = gScore.get(v);
        if (old === undefined || ng < old) {
          gScore.set(v, ng);
          cameEdge.set(v, eid);
          heap.push(greedy ? hOf(v) : ng + hOf(v), v);
        }
      }
    }
    return { result: null, expansions }; // frontier drained → unreachable
  }

  /**
   * Walk cameEdge back from dest, emitting edges/nodes in travel order. Cost is re-summed
   * from the chosen edges (honest for the greedy pass, whose g-scores are not path costs;
   * identical to the A* g-score within float addition order).
   */
  private reconstruct(
    origin: number,
    dest: number,
    cameEdge: Map<number, number>,
  ): Omit<PathResult, 'fallback'> {
    const edges: number[] = [];
    const nodes: number[] = [dest];
    let cur = dest;
    while (cur !== origin) {
      const eid = cameEdge.get(cur);
      if (eid === undefined) break; // defensive; maps are complete on recorded paths
      const e = this.graph.edge(eid);
      if (!e) break;
      edges.push(eid);
      cur = e.a === cur ? e.b : e.a;
      nodes.push(cur);
    }
    edges.reverse();
    nodes.reverse();
    let costHours = 0;
    for (const eid of edges) {
      const e = this.graph.edge(eid);
      if (e) costHours += edgeWeightHours(e);
    }
    return { nodes, edges, costHours };
  }
}
