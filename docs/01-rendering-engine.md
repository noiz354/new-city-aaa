# 01 — AAA Rendering Engine (Three.js)

> Covers FR-R01..07. Read after `plan.md §3.7`.

## 1. Goals & Budgets

- **60fps @1080p Medium** (M1/GTX1660, 5k buildings); 30fps min @10k. **Draw calls <200** @10k buildings. Frame CPU <8ms view-side.
- Cameras: **Orthographic** (default, SimCity tilt ~50°) + **Perspective** (street-level beauty). Toggle preserves target; both share damped rig.
- Look: clean low-poly PBR + soft shadows + day/night glow. No photorealism — readability first.

## 2. Scene Graph & Quality Presets

```
Scene
├── TerrainMesh (1 draw, vertex colors)
├── WaterMesh (1 draw, custom shader)
├── RoadMesh per chunk (≤16 draws, merged BufferGeometry)
├── Buildings: InstancedMesh per (zone × level × archetype) (~12–24 draws)
├── Props: trees/lamps (2 draws instanced)
├── Agents: cars (1 instanced), peds (1 instanced/points)
├── Overlays: 1 transparent plane (shader-switched) + highlight/ghost
├── Sky: large sphere w/ gradient shader + sun sprite + moon sprite
└── Lights: 1 Directional (sun/moon, shadow) + 1 Hemisphere. NOTHING else real.
```

| Preset | Shadows | Post | PixelRatio | LOD dist | Trees |
|--------|---------|------|------------|----------|-------|
| Low | off | off | 1.0 | aggressive | 50% |
| Medium | 1024 CSM-lite | AA only | min(dpr,1.5) | normal | 80% |
| High | 2048 | AA+bloom | min(dpr,2) | far | 100% |
| Ultra | 2048 + contact-ish AO bake | full | 2 | far+ | 100% |

Low-FX toggle forces Low post/lights regardless of preset (NFR-01 fallback).

## 3. Camera Rig (shared)

```ts
interface CameraRig {
  mode: 'ortho' | 'persp';
  target: Vector3; yaw: number; pitch: number; dist: number;
  toggle(): void; pan(dx,dy): void; orbit(dx,dy): void; zoom(f: number): void;
  update(dt: number): void; // damping: target/yaw/pitch/dist lerp
}
```

- Ortho: `frustumHeight = dist × 2 × tan(fov/2)` trick so zoom feels identical across modes.
- Clamp: pitch 15–85°, dist 20–600m, target inside map bounds. WASD + edge-pan + middle-drag orbit + wheel zoom. `O` toggles mode.
- Picking: intersect ray with `y=0` plane mathematically (no mesh raycast) → `tile = floor(world/TILE)`. 10× faster + robust.

## 4. Lighting & Day/Night

- **Sun:** single DirectionalLight orbiting (game-time driven; full cycle = configurable, default 1 day = 6 real-min at 1x… visual only, sim days independent). Shadow: single 2048 cascade covering view target (CSM-lite: follow target, snap texels to avoid shimmer). Night: intensity →0.05, color → moon blue.
- **Hemi:** sky/ground colors lerped by sun elevation.
- **Night windows:** buildings use atlas texture with window grid; shader mixes `dayColor → emissiveWindow × nightFactor × litRatio`. `litRatio` per-instance (residential high at night, commercial midday). Zero extra lights.
- **Streetlamps/headlights:** additive sprite planes, opacity = nightFactor. Cars get 2-px headlight quads — cheap, huge payoff.
- **Fog:** exp2, density lerped day/night; hides far LOD pop.
- **ToneMapping:** ACESFilmic, exposure 1.0–1.2.

## 5. Terrain & Water

- Terrain: PlaneGeometry 256×256 segments max (chunked 16×16 for culling), displaced by heightmap, vertex colors (grass/sand/rock/snow by height+slope), 1 material (MeshStandardMaterial vertexColors, flatShading optional).
- Water: separate plane at waterLevel, custom ShaderMaterial: fresnel + moving normals (2 sine waves) + sun specular. Transparent, depthWrite false.
- Trees: InstancedMesh cones+trunks merged (1 geometry, 2 materials → 2 draws), scattered by seeded RNG where grass + slope low; scale jitter per instance.

## 6. Roads (merged per chunk)

- Each road tile stamps a quad strip; per-chunk merge into one BufferGeometry (positions+uv+color). Lane markings via texture atlas (asphalt + dashes + crosswalk at intersections).
- Intersections: detect neighbor mask (4-bit) → pick atlas tile (straight/corner/T/cross). Rebuild only dirty chunks.
- Congestion tint: per-vertex color lerp green→red by v/c (updated 1Hz, not per frame).

## 7. Buildings (instancing — the critical path)

- Archetypes: R: house/suburb/apt; C: shop/mall/office; I: warehouse/factory. ×3 levels = ~12 geometries. Each = merged low-poly BufferGeometry (<500 tris) with window atlas UVs.
- `InstancedMesh` per archetype; per-instance matrix (pos+rot+scale) + `instanceColor` for tint variety + custom attribute `aLit` for night ratio.
- Placement: on growth event, allocate instance slot (free-list pool); on bulldoze/abandon → swap-with-last + count--. Never re-alloc per frame.
- LOD: dist > LOD_far → hide detail InstancedMesh, show `BoxInstancedMesh` (1 draw, colored boxes). Hysteresis band avoids flicker.
- Shadows: buildings castShadow=true, receive=true; instancing + shadows is fine in Three. Props cast=false (perf).

## 8. Overlays & Highlight (readability = pillar #1)

- One overlay plane (map-sized, transparent, depthWrite false) with DataTexture (R8 per mode) updated from grid layers at 1–4Hz. Shader colormaps: power (green/gray), water (blue/gray), traffic (green→red), value (purple→gold), pollution (clear→brown). Colorblind-safe: add icon sprites + pattern hatch for critical states.
- Hover highlight: yellow outline plane; drag ghost: green/red translucent boxes (instanced quads for rect tools).

## 9. Post-Processing

- Chain: RenderPass → UnrealBloomPass (strength 0.25, threshold 0.85 — only night glow blooms) → Vignette/OutputPass. MSAA via renderer AA (WebGL2) instead of SMAA pass when possible.
- Low-FX: skip composer entirely, direct render.

## 10. Frame Update (view-side, per rAF)

```
1. rig.update(dt) → cameras
2. consume sim events queue (growth/bulldoze/road) → update instancing (budget: ≤2ms, spill to next frame)
3. agents: advance along paths (lerp), wrap
4. overlays: if dirty && 250ms elapsed → re-upload DataTexture region
5. sun/sky/fog lerp by visual-time
6. render (composer or direct)
7. F3: fps EMA, draws (renderer.info), tickMs (from sim)
```

## 11. Failure Modes & Guards

- Context loss → show "GPU reset — reloading view (sim safe)" + re-init renderer, sim untouched.
- Shader compile fail (old GPU) → auto-drop to Low preset + toast.
- `⚠️ Ask first` (spec §9): adding any real PointLight/SpotLight — must prove draw+perf budget.

## 12. Acceptance (maps to tasks)

- T-002: both cameras orbit/pan/zoom damped, no jitter. T-009: <100 draws @2k zones. T-026/27: night shot + <200 draws @10k, 30fps+.
