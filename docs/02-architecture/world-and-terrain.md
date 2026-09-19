# World & Terrain

> Covers brief §5.1 (terrain) + world audit. Prior: `../02-world-grid-terrain.md` (retained; this doc freezes contracts).

## 1. Frozen contracts (v1)

- `SIZE ∈ {128, 256}` (default 256), `TILE_M = 8`, `CHUNK = 16`, map ≈ 2km². `SIZE=512` experimental, never default.
- **SoA typed arrays**, `SIZE×SIZE` each: `terrain u8, height f32, zone u8, road u8(+mask), building i32, powerNet i16, powered u8, waterNet i16, watered u8, pressure f32, landValue f32, pollution/crime/happiness f32 (late systems, allocated from VS-2 to freeze layout)`.
- Coordinates: tile `(x,y)` in sim; `world = (tile+0.5)*TILE_M − MAP_M/2` in view. No floating origin needed at 2km (float precision fine — R, no evidence of jitter at this scale).
- Chunks own dirty flags: `mesh, graph, overlay, minimap, save`. All mutations set flags; no full-grid scans in frame or tick hot paths (R-01 violated this — C).

## 2. Terrain generation

Seeded value-noise (2 octaves) + radial falloff + water level; presets Plains/River/Bay/Hills; slope rule blocks roads/buildings over max gradient with ghost reason. Deterministic: same seed → identical bytes (tested). `TerraGenesis Perlin` precedent exists in OpenTTD saves (`S-09`, v30) — genre-standard approach.

## 3. Road tiles & graph derivation

Road tile stores 4-bit neighbor mask for meshing (straight/corner/T/cross atlas). Graph nodes = tiles with ≠2 road-neighbors (+ zone stubs); edges = runs with tile lists. Rebuild is incremental (dirty chunks + 1-ring) and bumps `graphVersion` → path-cache invalidation (see [transportation](transportation-and-pathfinding.md)).

## 4. Fields & diffusion

`landValue, pollution, crime, happiness, trafficNoise` computed by: local sources/sinks → 2-pass separable 3×3 blur in field worker → cached arrays. Daily cadence. Weights live in one tunable constants file (`tuning/fields.ts`) owned by balancing tests.

## 5. Budgets & verification

Grid memory ≈ 2MB @256² (computed, F-arithmetic). Terrain gen <200ms (budget). Seed-determinism test + slope-rule tests + chunk-dirty unit tests in VS-1.
