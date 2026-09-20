// RoadGraph (T-401, FR-C03 foundation): node/edge extraction from the road layer.
// transportation-and-pathfinding §1 + 04-agents-pathfinding-traffic §3:
//   Nodes  = road tiles whose 4-neighbour road count ≠ 2 (endpoints/stubs count 0/1, junctions 3/4).
//            A pure ring of count-2 tiles has no natural node → the scan-first tile becomes a
//            pseudo-node so every component is representable (the `loop` fixture).
//   Edges  = maximal runs of count-2 tiles between two nodes (or a node back to itself), carrying
//            {lengthM, lanes:2, speedKph:40, capacity, volume} for the T-402 BPR traffic model.
//
// Incremental rebuild is COMPONENT-scoped: maximal-run edges span chunk boundaries, so the correct
// cheap unit is the 4-connected road COMPONENT. On dirty chunks we rebuild only the components that
// touch the edited region (whole components, so runs stay intact; covers merges/splits) and reuse
// untouched ones. `graphVersion` bumps so the T-402 path cache (keyed by graphVersionBucket)
// invalidates on change. Deterministic: fixed tile-major scan order; node/edge/component ids are
// monotonically allocated and `rebuildAll()` yields the canonical graph after load. Derived state
// only — never persisted; rebuilt from world.road on edit + after load.
import { CHUNK, TILE_M } from '../shared/types.js';
import type { World } from './world.js';

export interface RoadNode {
  id: number;
  x: number;
  y: number;
  /** Incident edge ids; self-loop edges appear twice (once per traversal direction). */
  edgeIds: number[];
}

export interface RoadEdge {
  id: number;
  /** Endpoint node ids; a === b for a self-loop (closed ring). */
  a: number;
  b: number;
  /** Tile run from A to B inclusive (indices into world arrays), in travel order. */
  tiles: Int32Array;
  lengthM: number;
  lanes: number;
  speedKph: number;
  /** Abstract vehicle throughput for BPR (T-403); §6 tuning: 2-lane street ≈ 1,600 trips/day. */
  capacity: number;
  /** Assigned daily volume (T-403); 0 until traffic assignment lands. */
  volume: number;
}

export const ROAD_LANES = 2;
export const ROAD_SPEED_KPH = 40;
export const ROAD_CAPACITY = 1600;

const DIRS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

interface Component {
  nodeIds: number[];
  edgeIds: number[];
  tiles: number[];
}

export class RoadGraph {
  readonly world: World;
  /** Monotonic version; bumps whenever the graph changes (T-402 path-cache key). */
  graphVersion = 0;
  private readonly nodes = new Map<number, RoadNode>();
  private readonly edges = new Map<number, RoadEdge>();
  private readonly tileToComp: Int32Array;
  private readonly nodeAtTile: Int32Array; // nodeId per tile, or -1
  private readonly comps = new Map<number, Component>();
  private readonly dirty = new Set<number>(); // chunk indexes pending an incremental rebuild
  private nextNodeId = 1;
  private nextEdgeId = 1;
  private nextCompId = 0;
  private built = false;

  constructor(world: World) {
    this.world = world;
    const n = world.size * world.size;
    this.tileToComp = new Int32Array(n).fill(-1);
    this.nodeAtTile = new Int32Array(n).fill(-1);
  }

  // ── Read surface ──────────────────────────────────────────────────────────────

  get nodeCount(): number {
    return this.nodes.size;
  }

  get edgeCount(): number {
    return this.edges.size;
  }

  get componentCount(): number {
    return this.comps.size;
  }

  componentAt(x: number, y: number): number {
    return this.tileToComp[this.world.idx(x, y)] as number;
  }

  nodeAt(x: number, y: number): number {
    return this.nodeAtTile[this.world.idx(x, y)] as number;
  }

  node(id: number): RoadNode | undefined {
    return this.nodes.get(id);
  }

  edge(id: number): RoadEdge | undefined {
    return this.edges.get(id);
  }

  allNodes(): RoadNode[] {
    return [...this.nodes.values()];
  }

  allEdges(): RoadEdge[] {
    return [...this.edges.values()];
  }

  allComponents(): ReadonlyMap<number, Component> {
    return this.comps;
  }

  edgesFrom(nodeId: number): number[] {
    return this.nodes.get(nodeId)?.edgeIds ?? [];
  }

  /** Number of graph nodes inside one connected component. */
  nodesInComponent(compId: number): number {
    return this.comps.get(compId)?.nodeIds.length ?? 0;
  }

  edgesInComponent(compId: number): number {
    return this.comps.get(compId)?.edgeIds.length ?? 0;
  }

  /** Edits are queued but not yet applied via {@link flush}. */
  hasPending(): boolean {
    return this.dirty.size > 0;
  }

  // ── Edit surface ──────────────────────────────────────────────────────────────

  /** Mark a rect of tiles changed; the affected components are rebuilt on {@link flush}. */
  noteRect(rect: { x0: number; y0: number; x1: number; y1: number }, dilateTiles = 2): void {
    const w = this.world;
    const x0 = Math.max(0, Math.min(rect.x0, rect.x1) - dilateTiles);
    const y0 = Math.max(0, Math.min(rect.y0, rect.y1) - dilateTiles);
    const x1 = Math.min(w.size - 1, Math.max(rect.x0, rect.x1) + dilateTiles);
    const y1 = Math.min(w.size - 1, Math.max(rect.y0, rect.y1) + dilateTiles);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.dirty.add(w.chunkIndexFor(x, y));
  }

  /** Snapshot the structural signature (used by determinism + fixture tests). */
  signature(): string {
    this.ensureBuilt();
    const comps = [...this.comps.values()]
      .map((c) => `n${c.nodeIds.length}e${c.edgeIds.length}t${c.tiles.length}`)
      .sort();
    return `v${this.graphVersion}|${comps.join(',')}`;
  }

  /** Full canonical rebuild (load path); resets allocation so ids reproduce identically after load. */
  rebuildAll(): void {
    this.nodes.clear();
    this.edges.clear();
    this.tileToComp.fill(-1);
    this.nodeAtTile.fill(-1);
    this.comps.clear();
    this.nextNodeId = 1;
    this.nextEdgeId = 1;
    this.nextCompId = 0;
    this.dirty.clear();
    const visited = new Uint8Array(this.world.size * this.world.size);
    for (let i = 0; i < visited.length; i++) {
      if ((this.world.road[i] as number) !== 1 || visited[i] === 1) continue;
      const tiles = this.flood(i, visited);
      this.buildComponent(tiles);
    }
    this.graphVersion++;
    this.built = true;
  }

  /**
   * Component-scoped incremental rebuild: reconstruct only the road components that intersect the
   * edited region (covers merges/splits), reuse untouched components. Cheap for localized edits.
   */
  flush(): void {
    if (this.dirty.size === 0) return;
    this.ensureBuilt();
    const w = this.world;
    // 1) Region = tiles of dirty chunks. Collect affected comps: any comp owning a tile in the
    //    region, or adjacent (4-conn) to a region tile that is now a road (covers road-extension
    //    onto an existing comp, and a new road joining two comps).
    const affected = new Set<number>();
    const regionRoadSeeds: number[] = [];
    for (const chunkIdx of this.dirty) {
      const cxs = chunkIdx % (w.size / CHUNK);
      const cy = Math.floor(chunkIdx / (w.size / CHUNK));
      for (let y = cy * CHUNK; y < Math.min((cy + 1) * CHUNK, w.size); y++) {
        for (let x = cxs * CHUNK; x < Math.min((cxs + 1) * CHUNK, w.size); x++) {
          const i = w.idx(x, y);
          const comp = this.tileToComp[i] as number;
          const isRoad = (w.road[i] as number) === 1;
          if (comp >= 0) affected.add(comp);
          if (isRoad) regionRoadSeeds.push(i);
          // A region road adjacent to another comp's tile → that comp is in the rebuild region too.
          if (isRoad) {
            for (const [dx, dy] of DIRS) {
              const nx = x + dx;
              const ny = y + dy;
              if (!w.inBounds(nx, ny)) continue;
              const ncomp = this.tileToComp[w.idx(nx, ny)] as number;
              if (ncomp >= 0) affected.add(ncomp);
            }
          }
        }
      }
    }
    // 2) Region tiles = union of the region's road seeds + every tile of each affected component
    //    (components are rebuilt WHOLE, so maximal runs crossing chunk boundaries stay intact — no
    //    ring expansion needed here; an unedited component keeps its graph instead of being doubled).
    const regionTiles = new Set<number>(regionRoadSeeds);
    for (const compId of affected) {
      const comp = this.comps.get(compId);
      if (!comp) continue;
      for (const t of comp.tiles) regionTiles.add(t);
    }
    // 3) Delete affected components (nodes/edges + per-tile lookups for region tiles).
    for (const compId of affected) {
      const comp = this.comps.get(compId);
      if (!comp) continue;
      for (const nid of comp.nodeIds) {
        const n = this.nodes.get(nid);
        if (n) this.nodeAtTile[w.idx(n.x, n.y)] = -1;
        this.nodes.delete(nid);
      }
      for (const eid of comp.edgeIds) this.edges.delete(eid);
      this.comps.delete(compId);
    }
    for (const t of regionTiles) {
      this.tileToComp[t] = -1;
      this.nodeAtTile[t] = -1;
    }
    // 4) Re-flood the region's road tiles into fresh components.
    const visited = new Uint8Array(w.size * w.size);
    for (const t of regionTiles) {
      if ((w.road[t] as number) !== 1 || visited[t] === 1) continue;
      const sub = this.floodLocal(t, regionTiles, visited);
      this.buildComponent(sub);
    }
    this.dirty.clear();
    this.graphVersion++;
  }

  // ── Construction helpers ───────────────────────────────────────────────────────

  private ensureBuilt(): void {
    if (!this.built) this.rebuildAll();
  }

  /** BFS over all 4-connected road tiles (full rebuild). */
  private flood(start: number, visited: Uint8Array): number[] {
    return this.walk(start, visited, () => true);
  }

  /** BFS constrained to `scope` tiles (incremental rebuild of a region). */
  private floodLocal(start: number, scope: Set<number>, visited: Uint8Array): number[] {
    return this.walk(start, visited, (i) => scope.has(i));
  }

  private walk(start: number, visited: Uint8Array, inScope: (i: number) => boolean): number[] {
    const w = this.world;
    const queue: number[] = [];
    const seen = new Uint8Array(w.size * w.size);
    seen[start] = 1;
    visited[start] = 1;
    queue.push(start);
    const tiles: number[] = [];
    for (let qi = 0; qi < queue.length; qi++) {
      const i = queue[qi]!;
      tiles.push(i);
      const x = i % w.size;
      const y = Math.floor(i / w.size);
      for (const [dx, dy] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!w.inBounds(nx, ny)) continue;
        const ni = w.idx(nx, ny);
        if ((w.road[ni] as number) !== 1 || seen[ni] === 1 || !inScope(ni)) continue;
        seen[ni] = 1;
        visited[ni] = 1;
        queue.push(ni);
      }
    }
    return tiles;
  }

  private neighbourCount(i: number): number {
    const w = this.world;
    const x = i % w.size;
    const y = Math.floor(i / w.size);
    let n = 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (w.inBounds(nx, ny) && (w.road[w.idx(nx, ny)] as number) === 1) n++;
    }
    return n;
  }

  /** Extraction pass for one component: node marking + maximal-run edge tracing. */
  private buildComponent(tiles: number[]): void {
    const w = this.world;
    const compId = this.nextCompId++;
    const inComp = new Set(tiles);
    let nodeTiles = tiles.filter((i) => this.neighbourCount(i) !== 2);
    const pseudo = nodeTiles.length === 0;
    if (pseudo) nodeTiles = [tiles[0]!]; // pure ring: scan-first tile is the pseudo-node

    const comp: Component = { nodeIds: [], edgeIds: [], tiles };
    for (const t of nodeTiles) {
      const id = this.nextNodeId++;
      this.nodes.set(id, { id, x: t % w.size, y: Math.floor(t / w.size), edgeIds: [] });
      this.nodeAtTile[t] = id;
      comp.nodeIds.push(id);
    }

    if (nodeTiles.length > 0) {
      const consumed = new Set<number>();
      const BIG = w.size * w.size;
      const packed = (a: number, b: number): number => (a < b ? a * BIG + b : b * BIG + a);
      const nodeIdAt = (t: number): number => this.nodeAtTile[t] as number;
      for (const start of nodeTiles) {
        const startId = nodeIdAt(start);
        const sx = start % w.size;
        const sy = Math.floor(start / w.size);
        for (const [dx, dy] of DIRS) {
          const nb0x = sx + dx;
          const nb0y = sy + dy;
          if (!w.inBounds(nb0x, nb0y)) continue;
          const nb0 = w.idx(nb0x, nb0y);
          if (!inComp.has(nb0) || consumed.has(packed(start, nb0))) continue;
          const chain: number[] = [start];
          let prev = start;
          let cur = nb0;
          let endId = startId;
          for (;;) {
            consumed.add(packed(prev, cur));
            chain.push(cur);
            if ((this.nodeAtTile[cur] as number) >= 0) {
              endId = nodeIdAt(cur);
              break;
            }
            const cx = cur % w.size;
            const cy = Math.floor(cur / w.size);
            let advanced = false;
            for (const [ddx, ddy] of DIRS) {
              const px = cx + ddx;
              const py = cy + ddy;
              if (!w.inBounds(px, py)) continue;
              const pi = w.idx(px, py);
              if (pi !== prev && inComp.has(pi)) {
                prev = cur;
                cur = pi;
                advanced = true;
                break;
              }
            }
            if (!advanced) break; // defensive: stop if a run dead-ends without a node
          }
          const eid = this.nextEdgeId++;
          const edge: RoadEdge = {
            id: eid,
            a: startId,
            b: endId,
            tiles: Int32Array.from(chain),
            lengthM: (chain.length - 1) * TILE_M,
            lanes: ROAD_LANES,
            speedKph: ROAD_SPEED_KPH,
            capacity: ROAD_CAPACITY,
            volume: 0,
          };
          this.edges.set(eid, edge);
          this.nodes.get(startId)!.edgeIds.push(eid);
          // Self-loop contributes twice (both directions); distinct endpoints add once each.
          this.nodes.get(endId)!.edgeIds.push(eid);
          comp.edgeIds.push(eid);
        }
      }
    }
    this.comps.set(compId, comp);
    for (const t of tiles) this.tileToComp[t] = compId;
  }
}
