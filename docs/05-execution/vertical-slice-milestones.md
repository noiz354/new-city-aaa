# Vertical Slice Milestones (acceptance detail)

> Each slice connects input → truth → sim → render → feedback. "Done" = [definition-of-done](definition-of-done.md) + the slice's criteria below.

## VS-0 — Scaffold & repo (playability: none; unlocks everything)

Scope: git+remote+CI, pinned deps, lint (incl. T-043 + import rules), Vitest+Playwright+`perf`+F3 skeletons, arch tests, ADR log, `tuning/` layout. DoD+: CI green on empty suites; `npm run perf` prints schema-valid JSON.

## VS-1 — First playable tile (playability: place road+zone, save/load)

Scope per roadmap; UJ-01 partial. Acceptance: (1) orbit/pan/zoom + pick accurate both cameras; (2) road+zone commands with cost/validity; (3) save→load hash-equal (E2E); (4) same-seed terrain identical; (5) corpus v1 green. Visual: §VS-1 standards ([visual-quality-standards](../03-game-design/visual-quality-standards.md)).

## VS-2 — City skeleton (playability: paint a town, read overlays)

Full tools + instanced rendering + overlays v1 + fields + minimap + SP-1/SP-4 decided. Acceptance: 2k-zone town <100 draws; save<2s/load<3s; overlay legends correct; store decision recorded (OPFS vs IDB with numbers).

## VS-3 — Living economy (playability: grow to 1k, balance budget)

RCI sim + budget + balancing S-green. Acceptance: houses/shops spawn; RCI bars respond; treasury math tested; S-green bands green; **15-minute 1k-pop manual playtest passes**; economy numbers lose HYPOTHESIS status.

## VS-4 — Traffic & utilities (playability: fix jams and blackouts)

Graph+A\*+traffic+agents+power+water. Acceptance: UJ-03 + UJ-04 E2E green; `perf` shows path budgets + cache stats; YAPF controls reviewed; SP-2/SP-3/SP-7 closed; benchmark review held.

## VS-5 — AAA render tier (playability: beauty + scale)

Day/night + LOD + post + audio + `metro` scale. Acceptance: UJ-08 screenshot suite; <200 draws + 30fps+ @`metro` Medium; leak test green; 2h soak green; SP-5 (WebGPU) recorded.

## VS-6 — Crisis & services (playability: survive and recover)

Environment + services + disasters + advisors/tutorial. Acceptance: UJ-05 + UJ-06 green; S-sprawl + S-crisis bands green; tutorial completable unaided; every penalty has surfaced fix (spot-audit).

## VS-7 — Ship hardening (playability: release)

Touch + a11y + settings + share + 8h soak + release notes with perf table. Acceptance: all UJ-01…08 + NFRs evidenced on REF-D (+REF-I notes); save-migration from VS-6 tag green; scope-freeze declared; tag `v1.0`.
