# Game Engine Architecture

> System overview: processes, threads, data flow, and ownership. Detail docs: rendering, world, simulation, transportation, population, utilities, state, persistence, boundaries (same folder).

## 1. Big picture

```
┌──────────────┐  commands   ┌──────────────────┐  snapshots/events  ┌───────────────┐
│  UI (React   │ ──────────▶ │  SIM CORE        │ ─────────────────▶ │  VIEW         │
│  panels/menus│ ◀────────── │  (main thread,   │                    │  (three.js,   │
│  4Hz+T       │  snapshots  │  fixed-step)     │                    │  60fps)       │
└──────────────┘             └──────┬───────────┘                    └───────────────┘
                                    │ transferables (postMessage)
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              path worker     field worker    persist worker
              (A* batches)    (diffusion)     (OPFS/serialize)
```

- **Authoritative state:** sim core only. UI proposes (commands); view projects (snapshots). Neither mutates truth.
- **Threads:** main (sim slices + render) + 3 dedicated workers. No SAB by default (`S-17`); transferables for bulk data.
- **Determinism boundary:** everything inside sim core is seeded/ordered; workers return results that sim *commits* in tick order (late results apply next tick — never mid-tick).

## 2. Lifecycle

`boot → load-or-new → loop(tick*, render) → autosave → unload-flush`. Boot sequence: storage detect (OPFS? SAB?) → renderer init + tier select → sim create (seed) → UI mount → tutorial state. Pause halts tick production; render continues (camera, hover). Speed changes tick *rate*, never `dt`.

## 3. Data flow rules (normative)

1. UI → sim: **commands only** (serializable `{type, payload, tick}`), validated then applied at tick boundary.
2. Sim → view: **event queue** (growth, bulldoze, road-dirty) + **snapshot reads** (typed-array views, copy-on-read across boundary).
3. Sim → workers: immutable job descriptors + transferred buffers; workers → sim: result messages committed in order.
4. View → UI: viewport/pick state (transient, non-authoritative).
5. Sim → storage: canonical bytes via persist worker; storage → sim: validated+migrated+repaired state.

## 4. Failure semantics

Worker crash → job requeued, sim continues on last-known data with `degraded` flag. Renderer context loss → re-init view from snapshot, sim untouched. Save corruption → slot fallback chain (manual → autosave → backup) + repair log, never a blank crash.

## 5. Decision log

- D-E1: main-thread sim, workers for path/field/persist (evidence `S-16/17`, [browser-performance](../00-research/browser-performance-research.md)).
- D-E2: commands as the only mutation path (evidence `S-10`, gap G-A1).
- D-E3: React outside the loop (see [state-management](state-management.md)).
