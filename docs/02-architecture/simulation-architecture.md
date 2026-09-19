# Simulation Architecture

> Covers brief §5.2. Research: `S-01` (F), `S-10` (C), `S-17` (F). Corrects gaps G-A1, G-A6.

## 1. Time model (adopted from `S-01`)

- `dt = 1 game-hour`; day = 24 ticks; month = 30 days. Rates: pause=0, 1x=2, 2x=6, 3x=12 ticks/sec.
- **Accumulator** consumes fixed `dt`; frame-time clamped (≤0.25s); **max 8 ticks/frame** (slow-motion under load instead of spiral of death); heavy systems run on day boundaries only.
- Render interpolation (`alpha`) applies to **visual agents only**; authoritative state is never interpolated.

## 2. Tick order (normative)

`commands → utilities → jobs/agents → traffic-commit → growth → fields-commit → economy(monthly) → events-out`. Worker results commit at the `*-commit` stages; late results wait one tick. Order is part of the determinism contract (change = save-version bump).

## 3. Commands (G-A1 correction, evidence `S-10`)

- All mutations (player + scripted + disaster) are serializable commands `{id, type, payload, tick, actor}` validated at the tick boundary, then applied.
- Enables: undo/redo (inverse or snapshot-diff), replay determinism tests, action logging, future multiplayer. Direct mutation of sim state from UI/view/workers is forbidden (lint + arch test).

## 4. Determinism contract

- Seeded RNG streams per system (`rng.growth`, `rng.traffic`, …); **no `Date.now`/`Math.random`/`setInterval` in `sim/`** (lint rule T-043; R-01 violated all three — C).
- Fixed iteration order (chunk-major); worker commits ordered; float ops in fixed sequence.
- Verified by: snapshot-hash tests (fixed script → exact hash), replay tests (command log → identical hash), fuzz runs (100 random-op days, no throw/NaN).

## 5. Workers & data ownership

| Worker | Owns computation of | Receives | Returns | On failure |
|--------|---------------------|----------|----------|------------|
| path | A\* batches | graph snapshot + O-D list (transferred) | paths + stats | sim reuses last paths, `routingDegraded` |
| field | diffusion/influence | layers (transferred) | blurred layers | sim reuses last fields, `fieldsStale` |
| persist | serialize/compress/write | canonical snapshot (transferred) | receipt + hash | retry queue, UI warning, never blocks tick |

Default transport: transferables + structured clone. SAB+Atomics only as a measured, header-gated optimization (`S-17`).

## 6. Pause/speed/save interplay

Pause stops tick production; commands queue (placement allowed, applies on resume — decided: **yes**, SimCity-like); autosave may run while paused; disasters never trigger while paused; speed is a view-rate control, invisible to determinism (hashes computed per-tick, not per-second).
