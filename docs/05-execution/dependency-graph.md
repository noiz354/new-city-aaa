# Dependency Graph

> Text graph (single source; render to image at will). `A → B` = A must land before B.

```
VS-0 scaffold ─┬─▶ commands/sim-clock ─▶ VS-1 grid/camera/pick ─▶ VS-2 tools/meshers/fields
               │        │                        │                       │
               │        ▼                        ▼                       ▼
               │   save-format-v1 ─────────▶ corpus-tests ─────────▶ VS-1 gate
               │        │                                              │
               ├─▶ arch-tests/lint ─▶ enforced every slice ────────────┤
               │                                                       │
               └─▶ perf-harness ─▶ budgets ─▶ VS-2/VS-4/VS-5 reviews ──┘

VS-2 ─▶ economy/growth (VS-3) ─▶ balancing-suite ─▶ tuning-lock
VS-3 ─▶ graph/path/traffic (VS-4) ─▶ YAPF-controls ─▶ UJ-03/UJ-04
VS-3 ─▶ utilities/power/water (VS-4) ─▶ overlays ─▶ UJ-04
VS-4 ─▶ render-tier/audio (VS-5) ─▶ leak+soak ─▶ UJ-08
VS-5 ─▶ env/services/disasters (VS-6) ─▶ advisors/tutorial ─▶ UJ-05/UJ-06
VS-6 ─▶ hardening (VS-7) ─▶ ship

Cross-cutting (span all): tuning/ files, decision log, docs updates, a11y checks.
```

**Critical path:** VS-0 → commands → VS-1 → VS-2 → VS-3 → VS-4 → VS-5 → VS-6 → VS-7. No parallel-slice work may touch frozen interfaces (tick order, save schema, command set) without a version bump + migration.
