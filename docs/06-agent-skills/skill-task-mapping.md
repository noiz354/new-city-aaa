# Skill → Task Mapping

> Load only what the task needs. Unlisted skills stay unloaded (progressive disclosure).

## 1. Development task → skill

| Development task | Required skill(s) |
|------------------|-------------------|
| Three.js renderer/scene/cameras | `three-best-practices` |
| Large-city rendering (instancing, LOD, culling, dispose) | `three-best-practices` + `city-builder-performance-gate` |
| Custom shaders (GLSL/TSL), post-processing | `three-best-practices` (shader/tsl/postpro rules) |
| Road graph + A\* pathfinding | `tdd` (seams) + `city-builder-simulation-audit` |
| Traffic volumes/congestion | `city-builder-simulation-audit` + `city-builder-playability-test` (UJ-03) |
| Population/jobs/economy/balancing | `city-builder-simulation-audit` + `tdd` |
| Power/water networks, brownouts | `city-builder-simulation-audit` + `city-builder-playability-test` (UJ-04) |
| Building placement/zoning UX | `city-builder-playability-test` + `city-builder-visual-qa` |
| React HUD (toolbar/inspector/budget) | `vercel-react-best-practices` + `vercel-composition-patterns` + `frontend-ui-engineering` |
| Overlays, minimap, readability | `frontend-ui-engineering` + `city-builder-visual-qa` |
| Save/load + migrations | `tdd` + `city-builder-playability-test` (UJ-07) |
| Browser E2E + screenshots + console triage | `webapp-testing` |
| DevTools deep-dive (DOM/network/perf) | `browser-testing-with-devtools` (needs MCP server) |
| Benchmarks + budget gates | `city-builder-performance-gate` + `performance-optimization` |
| Hard bugs / regressions / flakes | `diagnosing-bugs` |
| Module/interface design | `codebase-design` + `spec-driven-development` |
| Slice planning + review | `planning-and-task-breakdown` + `code-review-and-quality` |
| Milestone execution (orchestrator) | `city-builder-roadmap-executor` |

## 2. Roadmap slice → skills

| Slice | Skills (cumulative new in bold) |
|-------|----------------------------------|
| VS-0 scaffold | `spec-driven-development`, `planning-and-task-breakdown`, **`tdd`**, **`codebase-design`**, `code-review-and-quality`, `diagnosing-bugs` |
| VS-1 first tile | **`three-best-practices`**, **`webapp-testing`**, **`city-builder-roadmap-executor`** |
| VS-2 skeleton | **`city-builder-visual-qa`**, **`city-builder-performance-gate`** |
| VS-3 economy | **`city-builder-simulation-audit`**, **`city-builder-playability-test`**, **`vercel-react-best-practices`**, **`vercel-composition-patterns`**, **`frontend-ui-engineering`** |
| VS-4 traffic/utilities | (verification via simulation-audit + playability-test + performance-gate) |
| VS-5 render tier | **`performance-optimization`**, **`browser-testing-with-devtools`** (if MCP ready) |
| VS-6/7 crisis + ship | all verifier customs; `code-review-and-quality` pre-merge every slice |

## 3. Trigger phrases (for the router)

- "looks wrong / can't see / screenshot" → `city-builder-visual-qa`
- "population/economy/determinism wrong" → `city-builder-simulation-audit`
- "too slow / budget / benchmark" → `city-builder-performance-gate`
- "can a player… / UJ / E2E" → `city-builder-playability-test`
- "next task / implement the slice" → `city-builder-roadmap-executor`
- "red-green / seam / flaky test" → `tdd`
- "diagnose / bisects / replay" → `diagnosing-bugs`
