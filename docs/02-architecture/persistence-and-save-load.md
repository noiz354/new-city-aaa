# Persistence & Save/Load

> Covers brief §5.5. Research: `S-09` (C), `S-10` (C), `S-16` (F). Corrects gap G-A2 (compat from VS-1, not M5).

## 1. What is saved (authoritative, not rendered)

Header + tile layers (canonical bytes) + entities (buildings, nets, cohorts-summary, treasury, rates, funding, stats ring, date/seed, tutorial flags, command-log tail for forensics). **Derived data (graph, paths, overlays) is rebuilt on load**, never trusted from disk — but the *inputs* to rebuild are preserved bit-exact.

## 2. Format v1 (frozen in VS-1)

```
u16 formatVersion (=1) | u16 sectionCount
per section: u8 id | u16 sectionVersion | u32 length | bytes | u32 crc
header.json (version, seed, size, date, playMin, counts, mods, saveHash)
layers: concatenated typed arrays, gzip
entities: compact JSON, gzip (binary upgrade path reserved)
FNV-1a saveHash over canonical bytes
```

## 3. Versioning (adopted from `S-09`)

- One enum entry **per schema change** with a human description; list never reordered; `MinVersion`…`CurrentVersion`.
- Migration chain `migrate(v→v+1)` with unit tests per step using checked-in corpus saves.
- Forward rule: loader rejects versions > current with a clear message (never silent misread).

## 4. Pipeline: validate → migrate → repair → verify

Borrowed from `S-10`'s `Fix*` philosophy: structural validation → migrations → repair pass (null tiles, orphan buildings, treasury NaN…) with a **repair log shown to the player** → rebuild derived → verify hash-invariants → toast summary. Any hard failure → slot fallback (manual → autosave → backup) + error screen with export-diagnostics button.

## 5. Stores & atomicity

- **OPFS primary** (`S-16`): persist worker, atomic temp+rename, slots `city0..2` + `auto` + `auto.bak`. **IndexedDB fallback** after feature-detect. Settings separate (never in saves).
- Autosave: every N min + every game-year; unload flush (best-effort `beforeunload`).
- Share strings: base64(gzip) for small cities + version tag; PNG screenshot via capture button.

## 6. Budgets & verification

Save <2s / load <3s @256²+10k (budgets, [performance-budgets](../04-performance/performance-budgets.md)); corpus tests (every version loads); fuzz (bit-flip → graceful failure, never crash); hash-roundtrip (save→load→hash equal) in CI from VS-1.
