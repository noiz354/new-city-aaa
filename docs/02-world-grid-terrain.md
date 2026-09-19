# 02 — World: Grid, Terrain & Field Layers

> Covers FR-W01..04. The sim's memory layout — get this right and everything is fast.

## 1. Grid Spec

- `SIZE = 256` (config 128/256; 512 experimental). `TILE_M = 8`. Map = 2048m ≈ 2km². Feels like a SimCity region tile.
- `CHUNK = 16` → 16×16 chunks @256². Each chunk: dirty flags (mesh, graph, overlay, save).
- Storage: **parallel typed arrays** (structure-of-arrays, cache-friendly):

```ts
// lengths = SIZE*SIZE (65,536 @256² — tiny)
terrain:  Uint8Array   // 0 water,1 grass,2 sand,3 rock,4 forest
height:   Float32Array // meters (mostly visual + slope rules)
zone:     Uint8Array   // 0 none,1 R,2 C,3 I
road:     Uint8Array   // 0 none,1 street (+bits for planned hierarchy)
building: Int32Array   // building id or -1
powerNet: Int16Array   // flood net id or -1
powered:  Uint8Array   // 0/1 (computed)
waterNet: Int16Array; watered: Uint8Array; pressure: Float32Array
landValue: Float32Array // 0..100 cached
pollution: Float32Array; crime: Float32Array; happiness: Float32Array // M7
```

Total ≈ 65k × ~30B ≈ **2MB**. Trivial. Entities (buildings/cohorts/edges) are the real memory — cap and pool them.

## 2. Coordinates & Helpers

```ts
const idx = (x:number,y:number)=> y*SIZE+x;
const inBounds = (x:number,y:number)=> x>=0&&y>=0&&x<SIZE&&y<SIZE;
// neighbor iteration (4-way for roads/nets, 8-way for diffusion)
const D4=[[1,0],[-1,0],[0,1],[0,-1]], D8=[...D4,[1,1],[1,-1],[-1,1],[-1,-1]];
```

All sim code uses tile coords; view converts `world = (tile+0.5)*TILE_M - MAP_M/2`.

## 3. Terrain Generation (seeded, deterministic)

1. Value-noise (seeded PRNG `mulberry32`) 2 octaves → base height 0..1.
2. Radial falloff (island bias, tunable) → edges dip to water.
3. Water level `wl=0.32`: below → water/sand; slope>k → rock; else grass; noise patches → forest.
4. Flatten option: "Plains" preset (`flatness=1`) for tutorial/first city.
5. Props: trees where forest/grass + RNG; decorations (rocks) sparse.

Map presets: **Plains** (flat, easy), **River** (carved water band), **Bay** (water corner), **Hills** (harder slopes). Slope rule: roads/buildings blocked if slope > max (show red ghost + tooltip).

## 4. Zones, Roads, Buildings on Grid

- Zones paint rects (R/C/I) on empty grass tiles; roads carve through zones (road wins, splits lots).
- Buildings occupy 1 tile (L1) → visually scale; L2–L3 optionally merge 2×2 visually but logically stay 1 tile (keeps code simple; note as intentional simplification).
- Road tiles store direction mask for meshing: `mask = N|E|S|W` from road neighbors.

## 5. Road Graph Derivation (detail in docs/04)

- Nodes: road tiles with ≠2 road-neighbors (intersections/dead-ends) + zone-adjacent stubs. Edges: runs between nodes with tile lists.
- Incremental: on road edit, mark affected chunks dirty; rebuild nodes/edges touching dirty chunks + 1-ring; bump `graphVersion` → invalidate path cache entries.

## 6. Fields: Land Value, Pollution, Desirability

**Land value** (0..100, recomputed daily + on park/industry change):

```
base = 30 + waterView*15 + parkNear*20 + slopeView*5
minus = pollution*0.5 + crime*0.4 + industryNear*10 + trafficNoise*0.2
value = clamp(base - minus, 0, 100), then 2 passes of 3×3 box blur (diffusion)
```

- `parkNear`: 1/(1+dist) to nearest park ≤8 tiles. `industryNear` similar ≤6. `waterView` if water within 4.
- Diffusion via separable blur in worker (65k cells ×2 passes = trivial).
- **Desirability per zone:**
  - R: `0.5*value + 0.3*happiness - 0.2*traffic - 0.3*pollution`
  - C: `0.4*traffic(footfall!) + 0.3*value + 0.2*popDensity - 0.2*crime`
  - I: `0.4*flatAndCheap(low value good!) + 0.3*roadAccess - 0.2*pollutionConcern(less) + 0.2*powerWater`
- Note C *likes* traffic (customers) while R hates it — creates natural downtown vs suburb separation. This is the SimCity magic; tune weights in `docs/03` tables.

## 7. Spatial Queries

- `nearestService(x,y,type,maxDist)`: BFS on road graph (road-distance, not euclid) for coverage; fallback euclid for perf in M3, road-dist in M7.
- `tilesInRect`, `tilesInRadius` iterators reuse preallocated arrays (no GC churn in hot loops).
- Spatial hash for buildings by chunk for inspector/minimap/overlay queries.

## 8. Dirty-Flag Protocol (perf-critical)

Every mutation sets flags; systems consume lazily:

```
setRoad() → chunk.meshDirty, chunk.graphDirty, overlays.trafficDirty, minimapDirty
setZone() → chunk.meshDirty, growth.dirty, minimapDirty
growth event → view event queue, econ.dirty, overlay dirty
```

View never polls full grid per frame — only consumes event queue + 1–4Hz overlay refresh.

## 9. Acceptance

- T-003: seeded terrain deterministic. T-008: paint/bulldoze updates chunks. T-014: park raises value (test asserts Δ>5 within radius).
