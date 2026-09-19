# Graphics & Rendering Research

> Question: which techniques can a Three.js browser city builder actually ship? Evidence: `S-13/14` (F/C), `S-15` (secondary), `S-05` (C, negative example).

## 1. Verified baseline facts (F/C)

- **three.js r186** is latest (released 2026-09-08, 116k★) with active `TSL`, `Backends`, `BatchedMesh` work (`S-13`, fetched releases page). Monthly cadence → **pin exact version** per milestone; budget migration cost.
- **`InstancedMesh`** (source-read, `S-14`): per-instance matrix buffer + optional `instanceColor`; **bounding volumes are NOT auto-maintained** (`computeBoundingBox/Sphere` must be called after `setMatrixAt`); **`raycast()` iterates every instance** (O(n) per pick). Consequences: (1) instancing is the correct large-count primitive; (2) picking must use math-plane projection, never mesh raycast (validates `docs/01` §3); (3) per-chunk `InstancedMesh` bounds must be recomputed on edit.
- **`BatchedMesh`** exists in three.js (seen in r186 changelog, `S-13`): single draw call for *different* geometries — candidate for varied-building rendering alongside per-archetype `InstancedMesh`. Marked **H**: needs a spike (throughput + per-instance color support) before adoption.
- **R-01 negative result** (`S-05`, C): cloned-GLB-per-building with no instancing cannot scale; 259 `.glb` files break any sane bundle budget. Supports procedural-first + atlas strategy.

## 2. WebGL2 vs WebGPU (2026-09 status)

| Aspect | WebGL2 (`WebGLRenderer`) | WebGPU (`WebGPURenderer`/TSL) | Grade |
|--------|--------------------------|-------------------------------|-------|
| Browser coverage | Universal on targets (NFR-06) | ~95% incl. Safari 26 (Sep 2025) per third-party report | F / secondary |
| three.js maturity | Stable, all features | Rapidly maturing; auto-fallback to WebGL2 reported since r171 | F (releases) / secondary |
| Instancing, shadows, post | Yes | Yes | F |
| Compute shaders (crowds, culling) | No | Yes | F (API fact) |
| Risk | Low | Medium (API churn, Safari recency) | R |

**Decision (R): ship WebGL2-first with a renderer-abstraction seam; add WebGPU as a quality-tier upgrade behind the same scene API once verified on Safari + Firefox.** Do NOT gate MVP on WebGPU. Candidates for WebGPU-only wins (compute crowd update, GPU culling) stay in [scalability-strategy](../04-performance/scalability-strategy.md) as hypotheses with spike tasks.

## 3. Technique-by-technique verdicts

| Technique | Verdict | Cost / trade-off / fallback |
|-----------|---------|------------------------------|
| Forward rendering (three default) | **Adopt** | Simplest, MSAA-friendly; fine for 1–2 real lights |
| Deferred rendering | **Reject for v1** | three support is WebGPU-oriented; overkill for low-poly; revisit post-ship (H) |
| PBR (`MeshStandardMaterial`) + vertex colors | **Adopt** | Negligible cost at our poly counts; atlas for windows |
| Single shadow map, target-following | **Adopt** | CSM-lite only; full CSM = cost without proven need (H) |
| SSAO / SSR / TAA | **Reject for v1** | Post chain cost + WebGL2 constraints; use baked-ish AO (vertex darkening) + MSAA |
| MSAA (WebGL2 default AA) + subtle bloom | **Adopt (High tier)** | Bloom threshold high so only emissive blooms; Low tier skips composer |
| Fog + gradient sky + night emissive shader | **Adopt** | Cheap, huge readability/beauty payoff; zero extra real lights |
| Frustum culling (per-chunk) | **Adopt** | three built-in per-object; chunk granularity keeps bounds tight |
| Occlusion culling | **Reject** | City views are mostly visible; cost > gain (H, measure later) |
| LOD (mesh swap + box impostors) | **Adopt (M6)** | Hysteresis band; boxes via 1 instanced draw |
| Texture atlas (windows, road markings) | **Adopt** | 1–2 textures for all buildings/roads; enables batching |
| KTX2/compressed textures | **Defer** | Payoff small with procedural art; revisit with GLTF packs |
| Day/night via uniform lerp | **Adopt** | `nightFactor` drives sun/hemi/fog/emissive; sim-days decoupled from visual cycle |
| Ortho+persp shared rig | **Adopt** | Preserves target on toggle; math-plane picking both modes |
| GPU resource disposal (`dispose()`) | **Adopt, enforced** | Every dynamic geometry/material/RT has an owner + dispose path; leak test in CI (H: needs harness) |

## 4. Open / unverified items

- Exact Safari WebGPU behavior for our scene (needs device test, not docs).
- `BatchedMesh` vs `N×InstancedMesh` throughput at 10k buildings (spike [benchmark-scenarios](../04-performance/benchmark-scenarios.md#spike-list)).
- Shadow-map size vs quality curve on Intel iGPUs (measure in VS-2).
