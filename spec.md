---
id: spec
version: 1.0.0
status: draft-for-review
workflow: addy-osmani-spec
date: 2026-09-19
gates:
  - spec-approved-before-plan
  - plan-approved-before-tasks
  - tasks-approved-before-code
---

# SPEC.md — AAA Browser 3D City Builder

## 1. Objective / Vision

Build a **fully-featured, browser-based 3D city-builder inspired by SimCity** that runs at 60fps on a mid-range laptop, supports cities of **10,000+ buildings / 100,000+ citizens (simulated)**, and delivers AAA game feel: beautiful day/night rendering, living traffic, meaningful economy, disasters, and scenarios — with **zero install**.

**One-liner:** *SimCity in a tab: zone, build, power, commute, tax, grow — then survive the meteor.*

### Design Pillars

1. **Readable at a glance** — any city problem (power, traffic, money) visible in <3 seconds via color overlays + advisors.
2. **Simulation you can trust** — every number (population, jobs, $) traceable to a rule in `docs/03..05`.
3. **Build fast, fix faster** — drag roads, paint zones, bulldoze; all reversible, all 60fps.
4. **Beauty is a feature** — night windows, traffic headlights, water shimmer sell the fantasy.
5. **Never lose a city** — autosave + versioned saves + crash recovery.

## 2. Audience & Platform

- **Players:** casual builders (30-min sessions) + optimizers (10-hr cities). Ages 10+. No gamedev knowledge.
- **Platform:** Modern desktop browsers (Chrome/Edge/Firefox/Safari). Target: 1080p, mouse + keyboard. Touch = stretch.
- **Offline:** playable offline after first load (PWA stretch goal).

## 3. User Journeys (must all work E2E)

- **UJ-01 Greenfield → First Power:** New map → place coal plant → lay road → zone R → see houses spawn, population > 0, powered overlay green.
- **UJ-02 Live/Work Balance:** Zone R + C + I, connect roads → RCI demand bars move → shops/factories spawn → unemployment < 20%.
- **UJ-03 Rush Hour:** 2,000+ citizens commute → see cars on roads → congested segment turns red → upgrade road / add parallel → congestion clears.
- **UJ-04 Blackout:** Overload power (demand > capacity) → brownout warning → unpowered buildings stop growing, show icon → build 2nd plant → recovery.
- **UJ-05 Budget Crisis:** Set taxes 15% → income up, happiness down, abandonment starts → lower to 9% + cut service funding → stabilize.
- **UJ-06 Disaster:** Trigger earthquake/meteor → buildings rubbled, fires, population dip → bulldoze + rebuild → recovery event logged.
- **UJ-07 Save/Share:** Save 50k-pop city (<2s), reload page, load (<3s), state identical (hash match). Export share code.
- **UJ-08 Beauty Shot:** Orbit at night, zoom to street level, screenshot-worthy lighting + window glow + headlights.

## 4. Scope

### In Scope — MVP (must ship)

- Ortho + perspective cameras, raycast tile select/highlight
- Tools: Road, Residential, Commercial, Industrial, Power Line, Power Plant, Water Tower, Bulldoze, Inspect
- Game clock (pause/1x/2x/3x), day counter, date
- RCI zoning + growth/upgrade/abandon rules
- Statistical citizens + jobs matching + visual commuters
- A* road pathfinding + capacity-based traffic congestion
- Power + water distribution over connected networks
- Treasury: upkeep costs, RCI tax income, budget panel (tax sliders, service funding)
- Save/load (localStorage → IndexedDB), autosave, new/empty maps
- HUD: toolbar, RCI bars, population, $, date, speed, minimap, alerts, inspector
- Procedural low-poly buildings (no external art dependency) + GLTF loader for upgrades

### In Scope — AAA Stretch (phased after MVP)

- Day/night cycle, weather, seasons, disasters (fire, quake, meteor, flood)
- Services: police, fire, school, hospital, park (coverage + effects)
- Pollution (air/noise/ground), crime, health, happiness systems
- Public transit (bus), road hierarchy (street/avenue/highway, one-way)
- Scenarios + tutorial + advisors + achievements
- Audio: ambient + UI + music stems, mute/volume
- Modding: building JSON packs, map seeds

### Out of Scope (v1)

- Real multiplayer, mobile-native app, VR, full traffic microsim per-car physics, user-generated 3D model upload.

## 5. Functional Requirements

> IDs are stable. `plan.md` and `tasks.md` MUST reference these.

### Rendering & Camera (FR-R)

- **FR-R01:** Three.js scene, dynamic sun + hemisphere lights, fog, ACES tone mapping.
- **FR-R02:** Toggleable Orthographic (SimCity-style) + Perspective cameras; pan/rotate/zoom with damping, screen-edge + WASD.
- **FR-R03:** Tile hover highlight + placement validity coloring (green/red) + drag preview ghost.
- **FR-R04:** Instanced rendering: ≤200 draw calls @ 10k buildings on M-series/GTX1660 class.
- **FR-R05:** Day/night cycle with emissive night windows + streetlamp/headlight glow (no per-light real lights — shader trick).
- **FR-R06:** LOD: full mesh near, billboard/box far; frustum + chunk culling.
- **FR-R07:** Post: antialias + subtle bloom/vignette; Low-FX mode disables post.

### Grid & World (FR-W)

- **FR-W01:** Matrix grid min 128×128, target 256×256 tiles; tile = 8m. Chunked 16×16 for culling/serialization.
- **FR-W02:** Terrain: heightmap (flat + gentle hills v1), water table, trees, fertile/ore decoration.
- **FR-W03:** Per-tile fields: terrain, zone (R/C/I/none), buildingId, road (type/dir), power (net, powered), water (pressure), landValue, pollution, desirability cache.
- **FR-W04:** Road graph derived from road tiles; supports intersections, bridges/tunnels = stretch.

### Tools & Interaction (FR-T)

- **FR-T01:** Toolbar: Select/Inspect, Road, Residential, Commercial, Industrial, Power Line, Power Plant, Water Tower/Pipe, Park, Bulldoze.
- **FR-T02:** Drag-line roads with cost preview + validity; paint/drag zones; marquee bulldoze.
- **FR-T03:** Every placement shows cost; insufficient funds blocks + shakes treasury.
- **FR-T04:** Right-click/Esc cancels; Ctrl+Z undo for last placement batch (stretch: full history).

### Simulation Core (FR-S)

- **FR-S01:** Central game clock: fixed sim timestep (1 tick = 1 game-hour, 24 ticks = 1 day), speeds pause/1x/2x/3x, decoupled from render FPS.
- **FR-S02:** RCI demand model (−100..+100 per zone) from unemployment, happiness, land value, taxes.
- **FR-S03:** Growth: each day, N highest-scored zoned tiles spawn/upgrade if powered + watered + road-connected + funded; low score → abandon → rubble.
- **FR-S04:** Building levels 1–3 (density); upgrade increases pop/jobs, upkeep, tax.
- **FR-S05:** Land value diffusion: base (water/view/park) − pollution/crime + wealth halo, smoothed over neighbors.
- **FR-S06:** Deterministic sim seed; same inputs → same outputs (for save-hash test).

### Citizens, Jobs, Traffic (FR-C)

- **FR-C01:** Population model: residents live in R, work in C/I; track employment, happiness.
- **FR-C02:** Job matching via gravity model (jobs filled ∝ openings × residents / distance²).
- **FR-C03:** Commute pathfinding: A* on road graph with congestion weights; recompute on graph change, cached per O-D district pair.
- **FR-C04:** Traffic: per-segment volume/capacity → level-of-service A–F + BPR travel-time multiplier; viz overlay green→red.
- **FR-C05:** Visual agents: pool of ~500 car meshes + ~300 pedestrian dots sampled from flows (not 1:1 with population).
- **FR-C06:** No-path buildings show "No road connection" icon, halt growth.

### Utilities (FR-U)

- **FR-U01:** Power: plants produce MW; buildings consume; power lines + roads conduct; connected-component flood fill; overload → brownout priority (I sheds first? or distance-based — decide in plan).
- **FR-U02:** Water: towers/pumps produce kL; pipes/roads conduct; pressure falls with distance/load; unwatered halts growth.
- **FR-U03:** Overlays: power grid, water, traffic, land value, pollution, crime, happiness, coverage.
- **FR-U04:** Services (stretch order): fire, police, school, clinic, park — coverage by road-distance radius, affect happiness/growth.

### Economy (FR-E)

- **FR-E01:** Treasury: start $20,000; monthly tick collects tax, deducts upkeep; negative → bankruptcy warning → forced cuts.
- **FR-E02:** Tax: per-zone rate sliders 0–20% (default 9%); income = Σ buildings(level, zone) × rate × happiness factor.
- **FR-E03:** Costs: per-tile road/zone/utility placement + monthly upkeep per building/service.
- **FR-E04:** Budget panel: income/expense breakdown, 12-month sparkline, funding sliders per service (50/100/150%).
- **FR-E05:** RCI bars + population + jobs + unemployment always visible.

### Persistence (FR-P)

- **FR-P01:** Save: header JSON (version, seed, date, mods) + binary tile layers + entity lists; gzip; IndexedDB slots (3) + autosave slot.
- **FR-P02:** Load: version check + migration; corrupt-save recovery message, never hard-crash.
- **FR-P03:** Export/import share string (base64) for small cities; screenshot button (PNG).
- **FR-P04:** Save/load <2s/<3s @ 256×256 with 10k buildings (see NFR).

### UI/UX (FR-X)

- **FR-X01:** HUD: top bar ($, pop, date, speed), left toolbar, right inspector, bottom RCI + minimap + alerts.
- **FR-X02:** Advisors: 3 rotating tips when problem persists >30 days ("Power at 95% — build capacity").
- **FR-X03:** Tutorial: 5-step checklist overlay (road → power → zone R → zone C/I → 500 pop).
- **FR-X04:** Notifications queue (info/warn/critical) with click-to-locate.
- **FR-X05:** Settings: quality (Low/Med/High/Ultra), FX toggle, autosave interval, keybinds list.

### Audio & Polish (FR-A)

- **FR-A01:** Procedural ambient (wind/traffic hum scales with pop), UI clicks, build/error stingers, disaster boom.
- **FR-A02:** Disasters toggleable; at least Fire spread + Earthquake + Meteor in v1 AAA.
- **FR-A03:** Pause-safe: disasters never fire while paused; explicit trigger button + random toggle.

## 6. Non-Functional Requirements

- **NFR-01 Perf:** 60fps @ 1080p Medium on M1/GTX1660 with 5k buildings; 30fps min with 10k. Sim tick (1 game-day) <50ms p95.
- **NFR-02 Load:** First interactive <3s on broadband (async chunks, <5MB initial JS).
- **NFR-03 Memory:** <1.5GB heap @ 256×256 full city.
- **NFR-04 Reliability:** autosave never corrupts manual saves; crash → offer recovery.
- **NFR-05 Accessibility:** keyboard-only build possible; colorblind-safe overlays (pattern + color); remappable zoom keys.
- **NFR-06 Compatibility:** Chrome/Edge/Safari/Firefox latest; WebGL2 required, WebGPU optional boost.
- **NFR-07 Code health:** TypeScript strict, ≤300 lines/file soft cap, 80% sim-logic unit coverage.

## 7. Constraints & Assumptions

- Single-player, client-only (no backend). All sim in-browser.
- Art: procedural + primitive-based v1; GLTF optional packs later.
- Time: MVP in vertical slices; AAA systems behind feature flags.

## 8. Success Metrics (acceptance)

- [ ] UJ-01…UJ-07 pass on recorded playthrough script.
- [ ] NFR-01 measured via built-in FPS + tick-time HUD (F3 overlay).
- [ ] Save-hash test: save → load → hash equal.
- [ ] New player reaches 1,000 pop in <15 min without docs (tutorial only).

## 9. Boundaries (agent rules)

- ✅ **Always:** reference FR-/NFR- IDs in plan/tasks/code comments; run sim unit tests before marking done; keep PRs <300 lines.
- ⚠️ **Ask first:** new npm dependencies, changing tile size/grid size, touching save format, adding real-time lights.
- 🚫 **Never:** commit secrets; inline huge assets in JS; block render thread >50ms; break save backward-compat without migration.

## 10. Open Questions (resolve in plan.md)

1. Cohort vs full-agent citizens? (plan: cohorts + sampled visual agents)
2. Power brownout priority rule?
3. One-way / road hierarchy in MVP or stretch?
4. Undo depth: single-batch vs full stack?

## Glossary

- **RCI:** Residential / Commercial / Industrial.
- **Tick:** 1 game-hour sim step. **Day:** 24 ticks. **Month:** 30 days (economy tick).
- **LOS:** Level of Service (traffic A=free … F=jammed). **BPR:** Bureau of Public Roads delay function.
- **Cohort:** statistical group of citizens sharing home/work district (perf optimization).
