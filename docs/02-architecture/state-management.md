# State Management (incl. React boundary decision)

> Corrects gap G-A5. The brief requires React evaluation — this doc is the decision record.

## 1. Decision: React for panels, never for loop/sim (ADR-U1)

- **React 18 + TypeScript + Vite** owns: toolbar/menus, inspector, budget panel, advisors, tutorial, settings, dialogs, minimap canvas wrapper.
- **React must NOT:** hold sim truth, run in the frame loop, re-render at 60fps, or own canvas/WebGL objects.
- HUD subscribes to sim snapshots at **4Hz + on-event** (command receipts, alerts). Frame-rate UI (tooltip, ghost, F3) is vanilla TS outside React.
- Rationale: form-heavy panels + a11y benefit from React; R-01 proves vanilla works but doesn't scale to settings/budget complexity (R); Citybound's Rust/WASM UI (C-structure) proves the opposite extreme is heavyweight; 4Hz subscription bounds React's cost regardless of sim/render rates.

## 2. Stores & data flow

```
sim (truth) ─snapshot@4Hz─▶ uiStore (zustand-style, framework-agnostic)
uiStore ─selectors─▶ React components (memoized, panel granularity)
React ─commands─▶ sim inbox (validated at tick boundary)
view (transient: camera, hover, ghost) ─events─▶ uiStore (non-authoritative slice)
```

`uiStore` is plain TS (no React import) so E2E/tests and a future UI rewrite stay decoupled. Persisted UI prefs (quality, keybinds, mute) live in IndexedDB via the settings slice — never in saves.

## 3. Enforcement

- Lint: `sim/` and `view/loop` may not import `react`/`react-dom`; React files may not import `three` (except the canvas-mount wrapper).
- Arch test: import-graph check in CI ([module-boundaries](module-boundaries.md)).
- Perf rule: React commit count <10/sec during normal play (measured in E2E perf run; violations fail the slice).

## 4. Alternatives rejected

Vanilla-only UI (higher long-term cost for budget/settings/a11y), React-in-loop (60fps re-render risk), full ECS-store sync per frame (serialization cost). All reversible: uiStore seam allows UI rewrite without touching sim.
