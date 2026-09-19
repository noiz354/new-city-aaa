# Module Boundaries & Dependency Rules

> Corrects gap G-A11. Single source of truth for "who may import whom". Enforced by lint + CI arch test from VS-0.

## 1. Modules

```
src/
├── sim/        # truth: clock, world, growth, agents, traffic, utils, economy, env, commands, rng, tuning
├── workers/    # path, field, persist (message protocols + codecs; no sim imports except shared types)
├── shared/     # command types, save schema, constants, math, serialization (no deps)
├── view/       # three.js: scene, cameras, picking, meshers, agents-visual, overlays, sky, post
├── ui/         # uiStore (plain TS) + react/ panels (React only under react/)
├── persistence/# slot manager, OPFS/IDB drivers, migrations, corpus (uses shared + worker client)
└── main.ts     # wiring only
```

## 2. Allowed imports (deny-by-default)

| From → To | shared | sim | workers | view | ui/plain | ui/react | persistence |
|-----------|--------|-----|---------|------|----------|----------|-------------|
| shared | — | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| sim | ✅ | — | ✗ (via protocol msgs) | ✗ | ✗ | ✗ | ✗ |
| workers | ✅ types | ✗ | — | ✗ | ✗ | ✗ | ✗ |
| view | ✅ | ✗ (snapshots/events only) | ✗ | — | ✗ | ✗ | ✗ |
| ui/plain | ✅ | ✗ (commands out, snapshots in) | ✗ | ✗ (view-state events in) | — | ✗ | ✗ |
| ui/react | ✅ | ✗ | ✗ | ✗ | ✅ store | — | ✗ |
| persistence | ✅ | ✗ | ✅ client | ✗ | ✗ | ✗ | — |
| main.ts | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Plus: `three` importable only from `view/` (+ canvas mount); `react` only from `ui/react/`; `Date.now/random/setInterval` banned in `sim/` + `workers/` (T-043).

## 3. Size & change rules

- Soft cap 300 lines/file; PRs ≤300 lines; any new module needs an ADR line in this doc's log.
- Tick order, save schema, command set, and tuning-file layout are **frozen interfaces** — changes require version bump + migration/test updates.

## 4. Decision log

- D-B1: workers share *types* with sim, never code (avoids SAB/shared-memory coupling).
- D-B2: uiStore is framework-agnostic (React replaceable).
- D-B3: tuning/ lives in sim but is data-only (hot-tunable, test-owned).
