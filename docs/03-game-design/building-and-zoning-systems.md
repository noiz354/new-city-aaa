# Building & Zoning Systems

> Design contract for zones, buildings, construction, upgrades, abandonment. Implements [population-and-economy](../02-architecture/population-and-economy.md) §3.

## 1. Zones

R/C/I paint on empty buildable tiles; zones cost per tile, no upkeep vacant. Zone validity: terrain flat-ish, not water/road/occupied; drag-rect with live count+cost. De-zone free (bulldoze tool on vacant zone).

## 2. Building states (normative state machine)

`vacant → under-construction(3d) → occupied(L1→L2→L3) ⇄ abandoned → rubble → vacant(bulldozed)`.
Disaster adds `burning → rubble` and `damaged` (quake: −50% output until repaired/10d). Every state has: visual (scaffold/dark/rubble/fire), icon, inspector reason, event emission. Construction blocked while tile invalid (road removed mid-build → refund + cancel).

## 3. Levels & density

L1 single-tile house/shop/warehouse; L2–L3 denser visuals on same tile (documented simplification; 2×2 merge is rejected scope). Upgrades need sustained score + services (L3); downgrades never happen — decline goes through abandonment (clearer causality).

## 4. Placement UX rules

Ghost shows footprint + validity + cost + *reason on invalid* ("Too steep", "No funds ($120 short)", "Tile occupied"). Roads: drag-line with length+cost+LOS preview where computable; zones: rect paint; utilities/services: single + radius preview; bulldoze: marquee with refund/cost preview. Right-click/Esc cancels; Ctrl+Z undoes last command batch (command sourcing makes this exact).

## 5. Verification

State-machine tests (all transitions incl. disaster); ghost-reason table tests; E2E place→construct→occupy→abandon→rubble→clear per zone.
