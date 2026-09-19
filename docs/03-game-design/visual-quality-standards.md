# Visual Quality Standards

> "Automated test passing ≠ visually correct." This doc makes beauty inspectable.

## 1. Art direction (one paragraph)

Clean low-poly diorama: saturated day, warm window-glow night, readable silhouettes at max zoom-out, gentle fog depth. No photorealism; **readability beats realism** in every tie-break.

## 2. Standards per milestone (gates, not wishes)

- VS-1: flat-shaded terrain + water + zone colors distinguishable at all zooms; no z-fighting; hover highlight pixel-accurate.
- VS-2: roads read as network (markings + intersection atlas correct on all 16 masks); day sky + fog gradient smooth.
- VS-4: traffic visible and direction-correct; congestion tint matches overlay; no agent tunneling through buildings (spot-check).
- VS-5: night shot worthy: window emissive + lamps + headlights, bloom restrained (no white blowout); LOD swaps invisible in motion (hysteresis verified on video).
- VS-6+: disasters read clearly (fire glow/smoke, crater, rubble); weather (if any) never hides placement ghosts.

## 3. Mandatory manual inspections (checklist per slice)

1. Max-zoom-out legibility (zones/roads/city shape). 2. Street-level clipping (camera never inside buildings; ground clamp). 3. Ghost visibility on all terrains + overlays. 4. UI overlap: no panel covers the placement cursor area at 1280px. 5. Overlay-vs-night conflicts (overlay readable at nightFactor=1). 6. construction/abandon/rubble/fire states distinguishable. 7. 10-minute soak: no visual glitches accumulate (leaked meshes, stuck agents, ghost leftovers).

## 4. Screenshot suite (CI-assisted, human-judged)

Fixed seeds + camera bookmarks (day/night/overlay/traffic/disaster); pixel-diff with generous threshold flags *changes* for human review — never auto-pass/fail on aesthetics.

## 5. Ownership

Slice author attaches inspection checklist + screenshots to the milestone review; reviewer must confirm on a second machine/GPU where feasible (Intel iGPU notes required from VS-5).
