# 04 — Citizens, Jobs, Pathfinding & Traffic

> Covers FR-C01..06 + FR-S06 determinism. The "living city" system — most algorithmically dense.

## 1. Population Model: Cohorts + Visual Sample

Full 1:1 agents for 100k citizens is infeasible in JS main thread. AAA approach:

- **Cohorts (statistical truth):** aggregate commuters by `(homeChunk → workChunk)`. Each cohort: `{home, work, count, path, distM}`. Cap ~2,000 cohorts; merge smallest into "other" bucket. Recomputed daily or on zone/road change. All employment/traffic math uses cohorts.
- **Visual agents (theater):** pooled `500 cars + 300 peds` that sample the busiest cohorts proportionally. A road with 10× the flow shows ~10× the cars. Player perceives a living city; sim stays cheap.

```ts
interface Cohort { homeChunk: number; workChunk: number; count: number;
  edgePath: number[]; distM: number; timeMin: number; version: number }
```

## 2. Job Matching — Gravity Model (FR-C02)

Daily: match residents → jobs.

```
For each residential building r with workers Wr, each commercial/industrial b with openings Ob:
  attractiveness = Ob / (1 + distM(r,b)/800)^2     // β=2 decay, 800m half-pull
Assign greedily by attractiveness until Wr exhausted or no openings within 3000m.
Unmatched workers = unemployed. Unmatched openings = vacant jobs.
```

- Perf: aggregate to chunk level (16×16 chunks → ≤256 origins × 256 dests = 65k pairs worst case; prune pairs with 0 workers/openings; typical <5k pairs). Deterministic order (sort by chunk id).
- Outputs: `employed, unemployed, happiness inputs, cohort counts` (cohort per O-D pair with count>0).

## 3. Road Graph (from docs/02 §5)

```ts
interface RoadNode { id: number; x: number; y: number; edgeIds: number[] }
interface RoadEdge { id: number; a: number; b: number; tiles: number[];
  lengthM: number; lanes: 2; speedKph: 40; capacity: number; volume: number;
  version: number }
// capacity = lanes * 400 veh/hr-ish abstract units; tune: street 800/day-lane
```

- Build: scan road tiles; nodes where neighbor-count ≠ 2; walk runs for edges. Length = tiles×8m. Rebuild incremental (dirty chunks + ring).
- Buildings attach to nearest edge within 2 tiles → `accessEdge`, `accessNode`. No attachment = `connected=false` → no growth + icon (FR-C06).

## 4. Pathfinding — A* with Congestion Weights (FR-C03)

**Per cohort** (home accessNode → work accessNode):

```
w(edge) = lengthM / speedKph * BPR(edge)     // hours-ish
BPR(edge) = 1 + 0.15 * (volume/capacity)^4
A*: binary heap, heuristic = euclidM / maxSpeed (admissible), early-exit at target.
Cache: key (originNode, destNode, graphVersionBucket) — invalidate on graphVersion bump or daily volume refresh.
Budget: ≤500 pathfinds/day full A*; beyond that reuse nearest-cached path (same dest chunk).
Worker: pathfinding batches run in sim-worker; main thread uses last-known paths meanwhile (1-day staleness OK).
```

Complexity: graph nodes typically <2k even in big cities; A* with heap ≈ O(E log V) ≈ sub-ms each. 500/day = trivial; worker is insurance for 256² megacities.

Pseudocode:

```ts
function astar(g: Graph, s: number, t: number, w: (e:RoadEdge)=>number): number[] {
  const open = new BinaryHeap<Node>(); const gScore = new Map([[s,0]]);
  const came = new Map<number,number>(); // + edge tracking
  open.push(s, heuristic(s,t));
  while (open.size) {
    const u = open.pop();
    if (u===t) return reconstruct(came,t);
    for (const e of g.edgesFrom(u)) {
      const v = e.a===u? e.b : e.a;
      const ng = gScore.get(u)! + w(e);
      if (ng < (gScore.get(v) ?? Infinity)) { gScore.set(v,ng); came.set(v,u); open.push(v, ng+heuristic(v,t)); }
    }
  }
  return []; // no path → cohort marked unconnected, contributes unemployment
}
```

## 5. Traffic Assignment & Congestion (FR-C04)

1. Zero all `edge.volume`. For each employed cohort: `volPerCohort = count × TRIPS_PER_DAY(2) × CAR_SHARE(0.8)`; add to each edge on path.
2. `vc = volume/capacity`; LOS: A<0.3<B<0.6<C<0.8<D<1.0<E<1.3<F(v/c≥1.3). Overlay colors green→yellow→red→dark-red.
3. Travel time per cohort via BPR; avg commute shown in HUD tooltip; commute>45min lowers happiness (−10).
4. Rush-hour theater: visual car density pulses by visual-time-of-day (7–9am, 5–7pm ×1.8).

Tuning: single 2-lane street ≈ 1,600 trips/day capacity. A 2k-pop bedroom suburb commuting over one road WILL jam (UJ-03 by design).

## 6. Visual Agents (FR-C05)

- Pool: `InstancedMesh` cars (box+cabin merged, 200 tris) ×500, peds as instanced billboards ×300.
- Each active agent: `{edgePath, segT, speed, color}`; advance `segT += speed*dt/len`; hop edges; respawn from weighted cohort sampler when done.
- Cars drive on right offset (+1.5m lateral); headlights at night (emissive quad, opacity=nightFactor).
- Pause: freeze. Speed 2x/3x: agents move proportionally (visual only).

## 7. No-Path & Disconnected Handling (FR-C06)

- Cohort with empty path → residents counted as unemployed-ish (`disconnectedWorkers`), building shows 🔌/🛣️ icon, excluded from growth scoring.
- Road bulldozed under active paths → graphVersion bump → recompute next day; meanwhile agents finish current edge then despawn gracefully.

## 8. Roadmap: Transit (stretch T-101)

- Bus: stops as special road tiles; mode split: cohorts with both ends near stops shift 40% to bus (no road volume, small upkeep ultra-cheap). Same A* over transit-augmented graph.

## 9. Acceptance

- T-016: graph fixtures (straight/T/loop) exact. T-017: 500 deterministic paths <100ms, worker roundtrip tested. T-018: UJ-03 screenshots. T-019: cars visible + pause freezes.
