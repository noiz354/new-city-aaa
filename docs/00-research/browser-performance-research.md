# Browser Performance & Persistence Research

> Question: how do we keep the main thread responsive and saves trustworthy? Evidence: `S-16/17` (F), `S-02` (F), `S-09/10` (C).

## 1. Threading model (F + R)

- **Verified (MDN, `S-17`):** `SharedArrayBuffer` requires secure context + **cross-origin isolation** (COOP/COEP headers); without them, constructor hidden and `postMessage` throws. Implication: **SAB is opt-in**, not the default transport — it breaks plain static hosting and embeds.
- **Default worker protocol (R):** dedicated workers + `postMessage` with **transferable** `ArrayBuffer`s (zero-copy handoff) for pathfinding batches and field diffusion; structured clone for small messages. SAB + `Atomics` reserved as a measured optimization *after* profiling, requiring a documented hosting contract.
- **Scheduling (R):** sim owns the main thread in disambiguated slices (tick ≤8ms); pathfinding/diffusion/serialization run in workers; rendering never blocks on sim (event queue + snapshots, budget 2ms/frame drain). Feasibility: YES for path/diffusion/save; sim-core stays main-thread for v1 (avoids SAB requirement entirely).

## 2. Persistence endpoints (F)

- **OPFS (MDN, `S-16`, Baseline since Mar 2023, F):** origin-private, worker-accessible, **synchronous handles inside workers**, no permission prompts, quota-managed. → Primary save store: atomic write (temp + rename) from the persistence worker.
- **IndexedDB:** remains the compat fallback + settings/slot-metadata store (universally available, async).
- **Decision (R):** saves → OPFS (primary) with IndexedDB fallback after feature-detect; settings/keybinds → IndexedDB/localStorage; share strings → clipboard/base64; screenshots → download. Never `localStorage` for saves (sync, 5MB, main-thread).

## 3. Save format & versioning (C + R)

- **OpenTTD (C, `S-09`):** `SaveLoadVersion` enum, one entry per schema change, never reordered, 20 years of compatibility. **Adopted:** `u16` version + per-section versions + migration chain + `AfterLoad`-style repair pass.
- **OpenRCT2 (C, `S-10`):** post-load repair functions (`FixGuestCount`, `FixInvalidSurfaces`) prove production saves need *recovery*, not just parsing. **Adopted:** validate → migrate → repair → verify-hash pipeline.
- **Binary + gzip:** tile layers as concatenated typed arrays (checksum per layer); entities as compact JSON (v1) with a binary-upgrade path if size/time budgets fail. Hash (FNV-1a) over canonical bytes for roundtrip tests.

## 4. Budgets & measurement (F + R)

- **web.dev budgets 101 (`S-02`, F):** separate quantity metrics (bytes, requests) from milestone timings (FCP, TTI) from rule metrics (Lighthouse-style); put budgets **in the build**. Adapted to game metrics in [performance-budgets](../04-performance/performance-budgets.md): draw calls, tick p95, save/load latency, input-to-photon.
- **Memory (R):** 65k tiles × ~30B ≈ 2MB is trivial; the risks are JS entity objects, GPU buffers, and texture uploads. Strategy: pools, typed arrays, dispose discipline, heap snapshots in CI (target <1.5GB full city — budget, not measurement).
- **Mobile/thermal (R):** quality presets + Low-FX mode + pixel-ratio caps are the thermal strategy; no mobile-native target for v1 (documented scope cut, not a technical claim).

## 5. WASM/Rust: gated, not assumed (R)

MicropolisCore (secondary, `S-21`) proves a C++ sim core *can* run as browser WASM; Citybound (C-structure) proves Rust→WASM UI is possible but heavyweight. Neither proves we *need* it. **Rule:** WASM is admitted only after `npm run perf` shows JS p95 day-tick >50ms post-optimization, with a costed spike (build complexity, debugging, determinism across toolchains). Until then it stays in [scalability-strategy](../04-performance/scalability-strategy.md) as contingency W-1.
