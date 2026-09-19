---
name: city-builder-visual-qa
description: Inspects the running city-builder game in a real headless browser with screenshots. Use when verifying visual quality, camera visibility, terrain alignment, placement feedback, object overlap, UI obstruction, lighting, or readability. Triggers on visual QA, screenshot review, "looks wrong", "can't see", visual regression, or milestone visual inspection.
license: MIT
metadata:
  author: city-builder-aaa
  version: "1.0.0"
  depends-on: webapp-testing
---

# City Builder Visual QA

Verify the game **looks and plays right** in a real browser. A passing unit test never implies visual correctness.

## Preconditions

1. The game builds and serves (`npm run dev`, default port 5173 — read port from repo config, never assume).
2. Python Playwright + Chromium available (see `webapp-testing` skill for setup).
3. Camera bookmarks + fixed seeds from `docs/03-game-design/visual-quality-standards.md`.

## Procedure

1. **Launch**: start the dev server and open the game headless (1024×768 minimum; also capture 1280×800 and 1920×1080 for UI-overlap checks).
2. **Capture the suite**: day view, night view, each overlay, max-zoom-out, street-level, placement-ghost on every terrain type, construction/abandon/rubble/fire states.
3. **Inspect every screenshot** (actually look at the pixels) against this checklist:
   - Camera: no clipping inside buildings, ground clamp holds, max-zoom-out legible.
   - Terrain: buildings sit on terrain (no floating/sinking), roads follow grade, no z-fighting.
   - Placement: ghost visible on all terrains and overlays, validity colors correct, reason text readable.
   - Overlap: roads/intersections join cleanly, no buildings intersecting roads, no agent tunneling.
   - UI: no panel covers the placement area at 1280px; overlay legends readable at night.
   - Lighting: night windows/lamps/headlights visible, bloom restrained (no white blowout).
4. **Diff** against checked-in reference screenshots; flag changes for human judgment — never auto-pass aesthetics.
5. **Report**: one finding per defect with screenshot path + location + expected-vs-actual. Verdict is PASS only with zero open findings.

## Anti-patterns

- Reporting "visually correct" without captured screenshots attached.
- Testing only one resolution, one camera, or day-only.
- Confusing "element exists in DOM" with "visible and readable to a player".
