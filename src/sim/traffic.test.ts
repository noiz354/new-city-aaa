// Traffic T-403 fixtures (docs/02 §Daily + UJ-03): a single west→east corridor carries the
// whole commute (v/c ≥ 1 → LOS F = merah); a parallel relief street drops the corridor's
// measured v/c next day. Corridor EDGE_CAPACITY is narrowed in place to make honest volume
// reach the F threshold on a 64-tile fixture (capacity is a per-edge field — same surgery
// style as the T-402 volume test). Also: BPR feedback routing, over-commute happiness lag,
// deterministic replay, O-D cache reuse.
import { describe, expect, it } from 'vitest';
import { runDays } from '../testing/fixtures.js';
import { losOf } from './traffic.js';
import { Sim } from './sim.js';

function place(s: Sim, xs: number[], ys: number[]): void {
  const path = xs.map((x, i) => ({ x, y: ys[i]! }));
  const r = s.execute({ kind: 'place-road', path });
  if (!r.ok) throw new Error(`place-road failed: ${r.reason}`);
}

function zone(s: Sim, z: 1 | 2 | 3, rect: { x0: number; y0: number; x1: number; y1: number }): void {
  const r = s.execute({ kind: 'paint-zone', rect, zone: z });
  if (!r.ok) throw new Error(`paint-zone failed: ${r.reason}`);
}

/**
 * Corridor town (64²): R west of the map, C/I east of it; the ONLY road between them is the
 * y=32 street (x=20..44) — every commute crosses that one edge.
 */
function corridorTown(): Sim {
  const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
  // TRUE junctions need through-running streets (a mere bend is a pass-through per T-401).
  // West R feeder (through-crossed by the x=20 vertical at (20,20), a + junction).
  place(sim, Array.from({ length: 21 }, (_, k) => 4 + k), Array.from({ length: 21 }, () => 20)); // y=20, x=4..24
  place(sim, Array.from({ length: 15 }, () => 20), Array.from({ length: 15 }, (_, k) => 19 + k)); // x=20, y=19..33
  // The corridor itself (through-crosses both verticals → one 192m edge between junctions).
  place(sim, Array.from({ length: 29 }, (_, k) => 18 + k), Array.from({ length: 29 }, () => 32)); // y=32, x=18..46
  // East job vertical (crosses corridor at (44,32)) + feeder (crossed at (44,44)).
  place(sim, Array.from({ length: 15 }, () => 44), Array.from({ length: 15 }, (_, k) => 31 + k)); // x=44, y=31..45
  place(sim, Array.from({ length: 19 }, (_, k) => 42 + k), Array.from({ length: 19 }, () => 44)); // y=44, x=42..60
  // Zones (rows within road-access ≤2 of their feeder street).
  zone(sim, 1, { x0: 4, y0: 18, x1: 18, y1: 19 }); // R above west street
  zone(sim, 1, { x0: 4, y0: 21, x1: 18, y1: 22 }); // R below west street
  zone(sim, 2, { x0: 46, y0: 45, x1: 60, y1: 46 }); // C below east street
  zone(sim, 3, { x0: 46, y0: 42, x1: 60, y1: 43 }); // I above east street
  return sim;
}

/** The corridor edge = the 192m run between the (20,32) and (44,32) junctions (endpoint
 *  lookup survives the relief-street build, which splits verticals and adds its own 192m run). */
function corridorEdge(sim: Sim) {
  const g = sim.roadGraph;
  const a = g.nodeAt(20, 32);
  const b = g.nodeAt(44, 32);
  if (a < 0 || b < 0) throw new Error('corridor junctions missing');
  const hit = g.allEdges().find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
  if (!hit) throw new Error('corridor edge missing');
  return hit;
}

describe('losOf — LOS letter thresholds (docs/02 §Traffic)', () => {
  it('A below 0.6, F at/above 1.0, monotone between', () => {
    expect(losOf(0)).toBe(0);
    expect(losOf(0.59)).toBe(0);
    expect(losOf(0.6)).toBe(1);
    expect(losOf(0.75)).toBe(2);
    expect(losOf(0.85)).toBe(3);
    expect(losOf(0.95)).toBe(4);
    expect(losOf(1.0)).toBe(5);
    expect(losOf(2.5)).toBe(5);
  });
});

describe('Traffic T-403 — daily assignment + UJ-03', () => {
  it('single corridor jams: v/c ≥ 1 → LOS F on the crossing edge', () => {
    const sim = corridorTown();
    // Narrow the corridor so a full commute crosses the F threshold honestly on 64 tiles.
    corridorEdge(sim).capacity = 200;
    runDays(sim, 45);
    const st = sim.traffic.stats();
    const edge = corridorEdge(sim); // same record, volumes rewritten daily
    const vcr = edge.volume / edge.capacity;
    expect(edge.volume).toBeGreaterThan(edge.capacity); // honest overflow: v/c > 1
    expect(vcr).toBeGreaterThanOrEqual(1.0);
    expect(losOf(vcr)).toBe(5); // F = merah
    expect(st.losCounts[5]).toBeGreaterThanOrEqual(1);
    expect(st.vcrMax).toBeGreaterThanOrEqual(1.0);
    expect(st.odPairs).toBeGreaterThan(0);
    expect(st.unconnectedWorkers).toBe(0); // corridors connect every occupied chunk
    // (O-D cache hit-ratio evidence lives in path.test.ts + the perf bench's warm run.)
  });

  it('a parallel relief street routes the commute away → corridor v/c collapses (UJ-03)', () => {
    const sim = corridorTown();
    corridorEdge(sim).capacity = 200;
    runDays(sim, 45);
    const before = corridorEdge(sim).volume / corridorEdge(sim).capacity;
    expect(before).toBeGreaterThanOrEqual(1.0);

    // Relief street: y=28 through-crosses both verticals (+ east leg x=44 y=27..31 links it
    // onto the (44,32) junction). Slightly longer than the corridor — it only wins once BPR
    // congestion makes the old street uncompetitive (honest feedback, not geometry luck).
    place(sim, Array.from({ length: 29 }, (_, k) => 20 + k), Array.from({ length: 29 }, () => 28)); // y=28, x=20..48
    place(sim, Array.from({ length: 5 }, () => 44), Array.from({ length: 5 }, (_, k) => 27 + k)); // x=44, y=27..31
    runDays(sim, 1); // ONE day: BPR feedback makes the jammed corridor uncompetitive
    const after = corridorEdge(sim).volume / corridorEdge(sim).capacity;
    expect(after).toBeLessThan(before);
    expect(after).toBeLessThan(0.3); // all-or-nothing per O-D pair → near-total relief
    const reliefEdges = sim.roadGraph.allEdges().filter((e) => e.volume > 0 && e.id !== corridorEdge(sim).id);
    expect(reliefEdges.length).toBeGreaterThanOrEqual(1); // another street now carries the flow
  });

  it('over-commuting (>45 min) costs happiness with the frozen 1-day lag', () => {
    const sim = corridorTown();
    const cor = corridorEdge(sim);
    cor.capacity = 4000; // no congestion: isolate the commute-time term
    runDays(sim, 45);
    const h0 = sim.cohort.state().happiness;
    expect(sim.traffic.stats().overCommuteShare).toBe(0); // 40 kph streets: nobody over 45 min
    cor.speedKph = 0.2; // 192m at 0.2 kph = 57.6 min one-way — above the 45-min threshold
    runDays(sim, 1); // traffic now measures the crawl…
    expect(sim.traffic.stats().overCommuteShare).toBeGreaterThan(0.9);
    expect(sim.cohort.state().happiness).toBe(h0); // …but cohort already ran TODAY (frozen order)
    runDays(sim, 1); // day+1: cohort consumes yesterday's over-commute share
    const h2 = sim.cohort.state().happiness;
    expect(h2).toBeLessThan(h0);
    expect(h0 - h2).toBeGreaterThan(0.03); // commutePenaltyMax 5 pts × share≈1 (0–1 scale)±
  });

  it('deterministic: same seed → identical corridor volumes day over day', () => {
    const a = corridorTown();
    const b = corridorTown();
    runDays(a, 30);
    runDays(b, 30);
    const vols = (s: Sim) => JSON.stringify(s.roadGraph.allEdges().map((e) => e.volume));
    expect(vols(a)).toBe(vols(b));
  });

  it('empty city keeps volumes at zero and reports neutral stats', () => {
    const sim = new Sim({ seed: 7, size: 64, preset: 'plains' });
    runDays(sim, 3);
    const st = sim.traffic.stats();
    expect(st.odPairs).toBe(0);
    expect(st.avgCommuteMinutes).toBe(0);
    expect(sim.roadGraph.allEdges().every((e) => e.volume === 0)).toBe(true);
  });
});
