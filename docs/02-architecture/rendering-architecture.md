# Rendering Architecture

> Covers brief §5.1. Research: [graphics-rendering-research](../00-research/graphics-rendering-research.md). Prior: `../01-rendering-engine.md` (retained unless contradicted here).

## 1. Renderer selection (ADR-R1)

- **Ship WebGL2-first** (`WebGLRenderer`, three.js pinned r18x — verify `S-13` at scaffold).
- **WebGPU** (`S-15`, unverified) via a `RendererBackend` seam: scene assembly code never touches backend APIs directly; a VS-2 spike verifies fallback + perf on Safari/Firefox before any WebGPU-only feature is scheduled.
- Tiers: Low (no composer, shadows off, DPR≤1), Medium (MSAA, 1k shadows), High (bloom-lite, 2k shadows), Ultra (High + distance). Auto-detect with manual override.

## 2. Scene organization

`SceneManager` owns: terrain mesh (1 draw), water (1), road chunks (≤16 merged), buildings (per-archetype `InstancedMesh`, ~12–24 draws — `S-14`), props (2), agents (2), overlays (1 `DataTexture` plane), sky+sun sprites, 2 real lights (dir + hemi).
Per-chunk `InstancedMesh` bounds recomputed on edit (required by `S-14`: bounds are manual).

## 3. Sim→render synchronization (no per-tick rebuilds)

- **Event-sourced mesh updates:** sim emits typed events (`RoadDirty(chunks)`, `BuildingSpawned`, `BuildingRemoved`, `OverlayDirty(kind)`); view drains ≤2ms/frame, spilling the rest — frame budget beats freshness.
- **Instance pooling:** free-list slots per archetype; swap-with-last removal; `instanceMatrix.needsUpdate` on change batches only.
- **Overlays:** `DataTexture` re-upload at 1–4Hz, dirty-region only.
- **Agents:** view-owned interpolation along sim-committed paths; pause freezes; no sim reads per frame.

## 4. Picking, cameras, day/night

- Picking: ray→`y=0` plane math → tile (O(1)); never `InstancedMesh.raycast` (O(n) per `S-14`).
- `CameraRig`: ortho↔persp toggle preserving target; damped pan/orbit/zoom; ground clamp; `O` toggles; WASD+edge-pan.
- Day/night: `nightFactor` uniform drives sun/hemi/fog/sky/emissive windows/lamp sprites; visual cycle decoupled from sim days.

## 5. GPU lifecycle & quality rules

- Every dynamic GPU resource has an owner + `dispose()` path; chunk rebuild disposes old geometry; RT targets fixed count.
- Forward renderer; single target-following shadow map; MSAA on WebGL2; bloom only on High+ with high threshold.
- Rejected for v1 (with triggers): deferred, SSAO/SSR/TAA, occlusion culling, KTX2 — see research doc §3.

## 6. Verification

Draw-call counter assert in dev; leak test (build+bulldoze 1k cycles, heap delta bounded); screenshot suite day/night/overlays; fallback test (force WebGL2 path).
