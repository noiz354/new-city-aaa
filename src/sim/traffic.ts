// Traffic assignment (T-403, docs/02 §Daily + docs/04 §7): the daily volume pass.
//
// Order per spec (zero → assign → v/c → LOS → BPR feedback → commute penalty):
//   1. flush the O-D cache — YESTERDAY's edge volumes ARE today's BPR weights (the feedback);
//   2. derive worker→job chunk flows from the cohort's chunk snapshot (gravity allocation
//      mirroring COHORT_TUNING reachability, capped at maxOdPairs + overflow);
//   3. route every pair through the cached Pathfinder (≈cache-warm: same O/D recur a lot);
//   4. NOW zero all volumes and accumulate today's: volume += count × 2 trips × 0.8 car-share;
//   5. v/c → LOS A–F (TRAFFIC_TUNING.losVCaps); commute minutes → over-commute share, which
//      cohort.consumes TOMORROW (happy penalty, frozen order cohort → traffic → demand).
//
// BPR-stability decision (plan jebakan): NO damping on purpose. Assignment is all-or-nothing
// per O-D pair (each pair takes exactly one best path — classic UE assignment would split;
// that needs iterative loading, which the M-size scope defers to T-404+ evidence). Two
// near-equal parallel corridors can alternate day-to-day (A full → B cheap → B full → …);
// the oscillation is deterministic and bounded (N-day period), and writers (UJ-03, the
// balancing suite) only read ONE-day states. Recorded here; revisit when T-404's agent
// sampling needs a smoother signal.
//
// Derived (spec §9): volumes live on RoadEdge records already (T-401); this system persists
// nothing, bumps no codec, never touches Math.random (flows come from the cohort snapshot).
import { CHUNK, TILE_M } from '../shared/types.js';
import { Cohort } from './cohort.js';
import { Pathfinder } from './path.js';
import type { RoadGraph } from './roadGraph.js';
import { COHORT_TUNING } from './tuning/cohort.js';
import { TRAFFIC_TUNING } from './tuning/traffic.js';

/** Level of service index: 0=A … 5=F (docs/02 §lossary; thresholds = TRAFFIC_TUNING.losVCaps). */
export function losOf(vcr: number): number {
  const caps = TRAFFIC_TUNING.losVCaps;
  for (let i = 0; i < caps.length; i++) {
    if (vcr < (caps[i] as number)) return i;
  }
  return caps.length; // F
}

export const LOS_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export interface TrafficStats {
  /** LOS edge counts [A, B, C, D, E, F]; sums to roadGraph.edgeCount. */
  losCounts: readonly [number, number, number, number, number, number];
  /** Highest v/c on any edge (0 on an empty graph). */
  vcrMax: number;
  /** Flow-weighted mean one-way commute, minutes (0 when nothing routed). */
  avgCommuteMinutes: number;
  /** Share of employed workers whose commute exceeds 45 min (0..1) — cohort's tomorrow input. */
  overCommuteShare: number;
  /** Employed workers whose O-D pair had no road route (docs/04 §7 no-path marking). */
  unconnectedWorkers: number;
  /** Distinct chunk pairs considered (pre cap). */
  odPairs: number;
}

const ZERO_STATS: TrafficStats = {
  losCounts: [0, 0, 0, 0, 0, 0],
  vcrMax: 0,
  avgCommuteMinutes: 0,
  overCommuteShare: 0,
  unconnectedWorkers: 0,
  odPairs: 0,
};

export class Traffic {
  private readonly graph: RoadGraph;
  private readonly pathfinder: Pathfinder;
  private readonly cohort: Cohort;
  private current: TrafficStats = ZERO_STATS;

  constructor(graph: RoadGraph, pathfinder: Pathfinder, cohort: Cohort) {
    this.graph = graph;
    this.pathfinder = pathfinder;
    this.cohort = cohort;
  }

  stats(): TrafficStats {
    return this.current;
  }

  /** Convenience for the cophort call-site: yesterday's over-commute share (1-day lag). */
  overCommuteShare(): number {
    return this.current.overCommuteShare;
  }

  /** Daily pass — runs between cohort.recompute and demand.recompute (frozen order §2). */
  recompute(): void {
    const T = TRAFFIC_TUNING;
    // 1. Weights for today's routes = yesterday's volumes (BPR feedback). The cache was cut
    //    against those very weights throughout yesterday, so flush before re-routing.
    this.pathfinder.flushCache();

    const chunks = this.cohort.chunkData();
    const employeesTotal = chunks.matched;
    if (employeesTotal === 0 || chunks.workers.size === 0 || chunks.jobs.size === 0) {
      for (const e of this.graph.allEdges()) e.volume = 0;
      const losCounts = this.countLos();
      this.current = { ...ZERO_STATS, losCounts, vcrMax: 0 };
      return;
    }
    const employment = employeesTotal / chunks.residents; // fraction of residents with a job

    // 2. Flows: gravity allocation over chunk pairs, mirroring cohort reachability exactly
    //    (same R0/cutoff). Each worker chunk distributes its employed residents across the
    //    reachable job chunks by gravity weight; same-chunk pairs commute locally (foot —
    //    no road volume, ~0 car-minutes).
    interface Flow {
      wk: number;
      jk: number;
      count: number;
    }
    const flows: Flow[] = [];
    let pairsConsidered = 0;
    let capped0Workers = 0; // overflow-bucket workers (counted, not routed — documented S-cut)
    const gWeight = (dMeters: number): number =>
      1 / (1 + dMeters / COHORT_TUNING.gravityMeters) ** 2;
    for (const [wk, wCount] of chunks.workers) {
      const wcx = wk % chunks.stride;
      const wcy = Math.floor(wk / chunks.stride);
      const employed = wCount * employment;
      if (employed <= 0) continue;
      let denom = 0;
      const reachable: { jk: number; d: number }[] = [];
      for (const jk of chunks.jobs.keys()) {
        const jcx = jk % chunks.stride;
        const jcy = Math.floor(jk / chunks.stride);
        const d = Math.hypot((jcx - wcx) * CHUNK * TILE_M, (jcy - wcy) * CHUNK * TILE_M);
        if (d > COHORT_TUNING.maxCommuteMeters) continue;
        reachable.push({ jk, d });
        denom += (chunks.jobs.get(jk) as number) * gWeight(d);
      }
      if (reachable.length === 0) {
        capped0Workers += employed; // no reachable job chunk: cannot commute by any gravity weight
        continue;
      }
      for (const { jk, d } of reachable) {
        pairsConsidered++;
        const count = (employed * (chunks.jobs.get(jk) as number) * gWeight(d)) / denom;
        if (count <= 1e-9) continue;
        if (flows.length < T.maxOdPairs) flows.push({ wk, jk, count });
        else capped0Workers += count;
      }
    }

    // 3. Route every flow (cache-warm) — cost uses yesterday's BPR weights.
    const volumeAcc = new Map<number, number>();
    let routedTotal = 0;
    let minutesTotals = 0;
    let overWorkers = 0;
    let unconnected = capped0Workers;
    for (const f of flows) {
      if (f.wk === f.jk) {
        routedTotal += f.count; // same-chunk commute: local (no road load, no car minutes)
        continue;
      }
      const o = this.attachNode(f.wk, chunks.stride);
      const d = this.attachNode(f.jk, chunks.stride);
      if (o < 0 || d < 0) {
        unconnected += f.count; // no road node reachable from a chunk — docs/04 §7 no-path
        continue;
      }
      const res = this.pathfinder.route(o, d);
      if (!res) {
        unconnected += f.count; // disconnected components
        continue;
      }
      routedTotal += f.count;
      const minutes = res.costHours * 60;
      minutesTotals += f.count * minutes;
      if (minutes > T.commutePenaltyThresholdMin) overWorkers += f.count;
      const add = f.count * T.tripsPerWorker * T.carShare;
      for (const eid of res.edges) {
        volumeAcc.set(eid, (volumeAcc.get(eid) ?? 0) + add);
      }
    }

    // 4. Replace volumes with today's measurement (zero → accumulate).
    for (const e of this.graph.allEdges()) e.volume = 0;
    for (const [eid, v] of volumeAcc) {
      const e = this.graph.edge(eid);
      if (e) e.volume = v; // floats: gravity shares are not integers; LOS thresholds are ratios
    }

    // 5. LOS + stats.
    const losCounts = this.countLos();
    let vcrMax = 0;
    for (const e of this.graph.allEdges()) {
      vcrMax = Math.max(vcrMax, e.volume / Math.max(1, e.capacity));
    }
    this.current = {
      losCounts,
      vcrMax,
      avgCommuteMinutes: routedTotal > 0 ? minutesTotals / routedTotal : 0,
      overCommuteShare: overWorkers / employeesTotal,
      unconnectedWorkers: unconnected,
      odPairs: pairsConsidered,
    };
  }

  /** Nearest road node within chunkAttachRadiusTiles of a chunk's center tile (−1 = none). */
  private attachNode(chunkKey: number, stride: number): number {
    const cx = chunkKey % stride;
    const cy = Math.floor(chunkKey / stride);
    const tx = cx * CHUNK + (CHUNK - 1) / 2;
    const ty = cy * CHUNK + (CHUNK - 1) / 2;
    const cap = TRAFFIC_TUNING.chunkAttachRadiusTiles;
    let best = -1;
    let bestD = cap * cap + 1; // strict < keeps the FIRST max-insertion node on ties = deterministic
    for (const n of this.graph.allNodes()) {
      const dx = n.x - tx;
      const dy = n.y - ty;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD) {
        bestD = d2;
        best = n.id;
      }
    }
    return best;
  }

  private countLos(): [number, number, number, number, number, number] {
    const counts: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
    for (const e of this.graph.allEdges()) {
      const los = losOf(e.volume / Math.max(1, e.capacity)) as 0 | 1 | 2 | 3 | 4 | 5;
      counts[los]++;
    }
    return counts;
  }
}
