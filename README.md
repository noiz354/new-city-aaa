# 🏙️ City Builder AAA — Spec-Driven Project

> Browser-based 3D city builder (SimCity-like) built with **Three.js + TypeScript**.
> This repo does **not** start with code. It starts with specs — following the **Addy Osmani workflow**.

## The Addy Osmani Workflow Used Here

```
Specify  →  Plan  →  Tasks  →  Implement
   ↓         ↓        ↓           ↓
spec.md   plan.md  tasks.md     code/
```

**Rules (gated — do not skip):**

1. **Specify first.** `spec.md` defines WHAT + WHY: vision, user journeys, functional/non-functional requirements, success criteria. No tech decisions here beyond constraints.
2. **Plan second.** `plan.md` defines HOW: architecture, modules, data models, rendering + simulation strategies, risks. Must reference `spec.md` IDs (FR-xxx, NFR-xxx).
3. **Tasks third.** `tasks.md` breaks plan into small, verifiable, single-session tasks (T-001...). Each task has acceptance criteria + evidence required.
4. **Implement last.** Only after spec + plan + tasks are reviewed. Each task = one focused AI/human session, one PR (~100-200 lines), tests must pass.

Slash-command mapping (from `addyosmani/agent-skills`):

| Command | Artifact | Purpose |
|---------|----------|---------|
| `/spec` | `spec.md` | Turn vague idea → clear PRD |
| `/plan` | `plan.md` | Architecture + design decisions |
| `/build` | `code/` | Implement in vertical slices |
| `/test` | tests + logs | Prove it works |
| `/review` | review notes | Quality gates |
| `/ship` | release | Safe deploy |

## 📁 File Map

```
city-builder-aaa/
├── README.md              ← you are here
├── spec.md                ← MASTER SPEC (AAA vision, requirements)
├── plan.md                ← MASTER PLAN (architecture, stack, modules)
├── tasks.md               ← MASTER TASKS (atomic, ordered, gated)
└── docs/
    ├── 01-rendering-engine.md       ← AAA Three.js rendering
    ├── 02-world-grid-terrain.md     ← grid, terrain, land value fields
    ├── 03-simulation-core.md        ← game clock, RCI, growth
    ├── 04-agents-pathfinding-traffic.md ← A*, flow fields, traffic, jobs
    ├── 05-utilities-economy.md      ← power/water + treasury/tax
    ├── 06-ui-ux-save-polish.md      ← UI, persistence, disasters, audio
    ├── 07-performance-testing.md    ← budgets, optimization, QA gates
    ├── 08-gap-analysis-github.md    ← grounding GitHub + gap vs spec (ID)
    └── 09-gap-analysis-v2-code.md   ← verifikasi berbasis kode putaran 2 (ID)
```

**Reading order for a new agent:** `README.md` → `spec.md` → `plan.md` → `tasks.md` → `docs/01` → `docs/02` …

> **Research-grounded audit (2026-09-19):** start at [`docs/README.md`](docs/README.md) — `docs/00-research/` (evidence + source registry) → `docs/01-audit/` (verdicts) → `docs/02-architecture/` (target) → `docs/03-game-design/` → `docs/04-performance/` → `docs/05-execution/` (VS-0…VS-7 roadmap). Where the old and new trees conflict, the audited tree wins.

## 🎯 AAA Bar (vs Prototype)

Your original 5-phase prompt builds a **prototype**. This spec upgrades it to **AAA**:

| System | Prototype | AAA Target (this spec) |
|--------|-----------|------------------------|
| Rendering | Basic meshes + lights | Instanced PBR, CSM shadows, day/night, night windows, LOD, post-FX, <200 draw calls @ 10k buildings |
| Grid | Simple matrix | Chunked typed-array grid 256×256, spatial hash, diffusion fields |
| Agents | Count numbers | Cohort sim + visual agents, gravity job-match, A*/flow-field commute |
| Traffic | None / fake | Road graph + capacity + BPR congestion + viz + transit roadmap |
| Utilities | Boolean powered | Flood-fill grids, capacity/priority, brownouts, water pressure |
| Economy | Simple treasury | RCI demand, land value, tax curves, upkeep, loans, budget panel |
| Persistence | None | Versioned binary+JSON saves, IndexedDB, autosave, share codes |
| Polish | None | Disasters, scenarios, tutorial, advisors, minimap, audio, mods |

## 🚦 How To Use With An AI Agent

Copy-paste this to your agent:

> Read `city-builder-aaa/spec.md`, `plan.md`, `tasks.md`. Implement **T-001** only. Do not move to T-002 until I confirm. Show evidence: passing checks + screenshot/log. Follow Boundaries in spec.md.

Then confirm each task one-by-one — exactly like your original prompt requested ("Do not move on until I confirm").

## 🛠️ Planned Stack (details in plan.md)

- **Render:** Three.js (WebGL2, WebGPU-ready), TypeScript, Vite
- **Sim:** Fixed-timestep engine, typed arrays, Web Workers for pathfinding
- **State:** Event-sourced sim state + UI store (Zustand-style)
- **Persist:** IndexedDB + compressed binary saves
- **Test:** Vitest (sim) + Playwright (interaction) + perf budgets in CI

---
*Generated 2026-09-19. Workflow: Addy Osmani Spec → Plan → Tasks → Implement.*
