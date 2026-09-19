# User Interface & Controls

> Corrects gap G-A13. Implements [state-management](../02-architecture/state-management.md) (React panels + vanilla loop-UI).

## 1. Layout (frozen skeleton)

Top bar ($, pop/jobs/unemp, date, speed, settings) · left toolbar (11 tools + hotkeys) · right inspector (tile/building + reasons) · bottom (RCI bars, overlay picker, alerts, minimap 128px, advisors). Minimap click-jumps; alert click-flies.

## 2. Controls

Mouse: left = apply tool, right/Esc = cancel, wheel = zoom, MMB/RMB-drag = orbit/pan, `O` camera toggle, `V/R/1/2/3/P/B` tools. Keyboard-only path: Tab→toolbar, arrows→cursor tile, Enter→apply (tested). Touch (VS-7): tap=apply, drag=paint/pan (mode switch), pinch=zoom; ≥40px targets.

## 3. Overlays & readability

8 overlays (power/water/traffic/value/pollution/crime/happiness/coverage), each with legend + colorblind-safe encoding (**color + icon + pattern**, never color-only). Critical states always carry icons (⚡💧🚗🔥). Traffic green→red + LOS letter on hover.

## 4. Feedback & guidance

Advisors: daily rule engine, top-3 persistent issues, one-click fix selects tool/area. Alerts: info/warn/critical queue (cap 5, history 50). Tutorial: 5-step checklist, dismissible, confetti at 500 pop. Monthly report toast (income − upkeep = net). Every modal pausable-game-safe.

## 5. Responsive & a11y

Desktop-first 1280px+; panels dock/collapse; focus outlines; remappable zoom keys; reduced-motion honors `prefers-reduced-motion` (disables shake/confetti/pulse). Settings: quality/FX/day-night speed/autosave/audio/keybinds/colorblind-boost/reset.

## 6. Verification

E2E per control; keyboard-only build script; overlay legend + colorblind-contrast checks; layout snapshots at 1280/1920/ultrawide; manual "obscured-view" inspection per [visual-quality-standards](visual-quality-standards.md).
