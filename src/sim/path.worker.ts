// Pathfinding worker protocol (T-402): the batch boundary a sim-worker would serve.
//
// docs/04 §4: pathfinding batches run in a sim-worker; the main thread uses last-known
// paths meanwhile (1-day staleness OK). The real postMessage channel belongs to the VS-8
// sim-worker slice — this module freezes the PROTOCOL and ships the sync handler both
// sides will run, so the round-trip is exactly testable in vitest (which has no Worker).
//
//   request  {reqId, origin, dest, versionBucket}  — versionBucket = graphVersion the
//             request was cut against; stale requests are skipped (resort keeps order).
//   reply    {reqId, ok, nodes, edges, costHours, fallback} — sorted by reqId asc.
//
// Determinism: replies are re-sorted by reqId (never by completion order); the handler
// itself is the same sync Pathfinder used on the main thread, so worker and sync results
// are bit-identical. No RNG, no wall clock.
import type { Pathfinder } from './path.js';

export interface RouteRequest {
  reqId: number;
  origin: number;
  dest: number;
  /** graph.graphVersion the caller validated against; mismatched requests are stale. */
  versionBucket: number;
}

export interface RouteReply {
  reqId: number;
  ok: boolean;
  nodes: number[] | null;
  edges: number[] | null;
  costHours: number;
  fallback: boolean;
  /** True when the request was cut against a newer/other graphVersion and skipped. */
  stale: boolean;
}

/**
 * Serve one batch on a Pathfinder (worker-core = main-thread-core, spec §4 complexity).
 * Requests arrive in any order; the graph side computes in index order for cache warmth
 * and the reply array is REQID-SORTED (message-boundary invariant: results never depend
 * on channel timing). `stale` requests cost nothing and reply without a path.
 */
export function handleRouteBatch(pathfinder: Pathfinder, version: number, requests: RouteRequest[]): RouteReply[] {
  const replies: RouteReply[] = [];
  // Compute in request-index order (deterministic cache history), then re-sort by reqId.
  for (const req of requests) {
    if (req.versionBucket !== version) {
      replies.push({ reqId: req.reqId, ok: false, nodes: null, edges: null, costHours: 0, fallback: false, stale: true });
      continue;
    }
    const res = pathfinder.route(req.origin, req.dest);
    if (!res) {
      replies.push({ reqId: req.reqId, ok: false, nodes: null, edges: null, costHours: 0, fallback: false, stale: false });
    } else {
      replies.push({ reqId: req.reqId, ok: true, nodes: res.nodes, edges: res.edges, costHours: res.costHours, fallback: res.fallback, stale: false });
    }
  }
  replies.sort((a, b) => a.reqId - b.reqId);
  return replies;
}

/**
 * Main-thread client for the protocol. Runs the sync core directly today (the fallback the
 * spec REQUIRES when a Worker is unavailable); the VS-8 sim-worker slice swaps computeFor
 * for a postMessage channel without touching callers or the reply shape.
 */
export class PathWorkerClient {
  private readonly pathfinder: Pathfinder;
  private readonly getVersion: () => number;

  constructor(pathfinder: Pathfinder, getVersion: () => number) {
    this.pathfinder = pathfinder;
    this.getVersion = getVersion;
  }

  /** Sync round-trip (worker fallback path = required vitest behavior). */
  routeBatch(requests: RouteRequest[]): RouteReply[] {
    return handleRouteBatch(this.pathfinder, this.getVersion(), requests);
  }
}
