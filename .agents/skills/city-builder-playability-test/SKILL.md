---
name: city-builder-playability-test
description: Executes end-to-end gameplay journeys in a real browser and verifies observable outcomes. Use when testing roads, zoning, utilities, population growth, budgets, disasters, saving, or reloading. Triggers on playability, user journey, UJ test, E2E gameplay, "can a player", tutorial, or milestone acceptance.
license: MIT
metadata:
  author: city-builder-aaa
  version: "1.0.0"
  depends-on: webapp-testing
---

# City Builder Playability Test

Drive the game like a player. Verify outcomes, not just clicks.

## Preconditions

1. Journeys UJ-01…UJ-08 from `spec.md` + slice acceptance from `docs/05-execution/vertical-slice-milestones.md`.
2. Playwright + Chromium (see `webapp-testing`); game served headless.

## Procedure

1. Pick the journey(s) for the slice under test. Translate each into browser steps (select tool → drag/click tiles → advance time → read HUD/inspector).
2. Assert **observable game outcomes**, e.g.: population counter > 0; powered overlay green on zoned tiles; congestion overlay red then clearing; treasury delta within expected band; save→reload preserves population and treasury exactly.
3. Assert **feedback quality**: every placement shows cost; invalid placement shows a reason; every alert/inspector state is reachable within 2 clicks.
4. On failure, capture: screenshot, console errors, sim snapshot/hash if exposed, and the exact step that diverged. Distinguish "UI action failed" from "action succeeded but game state wrong".
5. Report: journey → PASS/FAIL with outcome values and artifacts. A journey passes only if a new player could complete it unaided at normal speed.

## Rules

- Never assert on implementation details (selectors may change; outcomes may not).
- Keyboard-only path must be exercised for at least one journey per slice.
- Flaky runs are re-run 3×; persistent flakes become issues, not skips.
