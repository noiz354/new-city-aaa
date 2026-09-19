# AGENTS.md — City Builder AAA

> Project routing for coding agents. Stack: TypeScript + Three.js (vanilla, pinned r18x) + React (panels only) + Vite + Vitest + Playwright. Spec: `spec.md`. Architecture: `docs/02-architecture/`. Roadmap: `docs/05-execution/development-roadmap.md` (slices VS-0…VS-7). Skills live in `.agents/skills/` (open Agent Skills standard).

## Skill routing (load only what the task needs)

| Task | Skill(s) |
|------|----------|
| Three.js renderer/scene/shaders/perf | `three-best-practices` |
| React panels/menus/HUD + a11y | `vercel-react-best-practices`, `frontend-ui-engineering` |
| Browser E2E, screenshots, console logs | `webapp-testing` |
| Visual inspection / beauty gates | `city-builder-visual-qa` |
| Sim truth, determinism, balancing | `city-builder-simulation-audit` |
| Benchmarks + budget gates | `city-builder-performance-gate`, `performance-optimization` |
| Gameplay journeys UJ-01…08 | `city-builder-playability-test` |
| TDD loop / hard-bug diagnosis | `tdd`, `diagnosing-bugs` |
| Module/interface design (seams, deep modules) | `codebase-design` |
| Spec / plan / review | `spec-driven-development`, `planning-and-task-breakdown`, `code-review-and-quality` |
| Milestone implementation | `city-builder-roadmap-executor` (orchestrates the above) |
| Chrome DevTools MCP flows | `browser-testing-with-devtools` (only if MCP server configured) |

Full mapping: `docs/06-agent-skills/skill-task-mapping.md`.

## Hard constraints (from spec §9 + module boundaries)

- `sim/` and `workers/`: no `three`, no React, no `Date.now`/`Math.random`/`setInterval` (use sim clock + seeded RNG).
- `view/`: may import `three`, never React (except canvas mount). React only under `ui/react/`, never in the frame loop.
- All sim mutations via serializable commands; frozen interfaces (tick order, save schema, command set) need version bump + migration + tests.
- Clean-room: GPL/AGPL references (Micropolis, OpenTTD, OpenRCT2, Citybound) are read-only inspiration — never copy code.
- Server/SSR rules in `vercel-react-best-practices` do NOT apply (Vite SPA, no Next.js). R3F patterns do NOT apply (vanilla Three.js by ADR-U1).

## Verification (no proof = not done)

Every task: tests + evidence (log/screenshot/hash). Every slice: `docs/05-execution/definition-of-done.md`. Never report browser/visual/perf success without measured artifacts.
