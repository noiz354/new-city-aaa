# PLAN T-402 — A* + cache + worker (size L)

> Untuk coding agent: kerjakan langkah 1–7 berurutan. Setiap langkah selesai
> = kode + test hijau sebelum lanjut. Jangan commit/push tanpa diminta.

## Goal / Accept / Evidence

- Binary-heap A* di atas `RoadGraph` (T-401).
- **Accept:** 500 path < 100ms; deterministik (seed sama → path identik).
- **Evidence:** perf log (`npm run perf`).

## Spec anchor

`docs/02-architecture/transportation-and-pathfinding.md` §Pathfinding:

- bobot `w = length/speed × BPR(v/c)`; heuristik `euclid/maxSpeed` (admissible);
- budgeted A* (YAPF controls); contingency drive-test sampling (S-06).

## Bearing awal (sudah diverifikasi, jangan riset ulang)

- `src/sim/roadGraph.ts` — API: `allNodes/allEdges/edgesFrom/node/edge`,
  `nodeAt/componentAt`, `graphVersion` monotonic (`:63`, kunci invalidasi cache),
  edge `{lengthM, lanes:2, speedKph:40, capacity:1600, volume:0}`.
- `npm run perf` = `vitest run perf/run.test.ts`; budget
  `build<3000ms, day p95<50ms`; spec minta catat
  `paths/day, p95 latency, cache hit ratio` di output perf.
- Belum ada file worker (`*.worker.ts` tidak ada); test pakai core sync.

## Urutan build

1. `src/sim/tuning/traffic.ts` (baru) — konstanta BPR (alpha/beta), budget
   ekspansi max, ukuran cache. Reuse `TILE_M` dari `shared/types.ts`.
2. `src/sim/path.ts` (baru) — core A* murni sync (tanpa worker): heap biner
   sendiri; tie-break deterministik by node id; budget habis → fallback
   greedy + flag `fallback:true`. Cache: key =
   `graphVersion + origin + dest`; counter hit-ratio.
3. `src/sim/path.worker.ts` (baru) — wrapper tipis `?worker` Vite atas core
   yang sama. Protokol `{reqId, origin, dest, versionBucket}` →
   `{path, cost, fallback}`; hasil diurut by reqId. Fallback sync saat worker
   unavailable (wajib untuk vitest).
4. `src/sim/sim.ts` — field pathfinder (derived, **jangan persist — spec §9,
   tanpa bump codec**); flush cache saat `noteRect/flush` jalan.
5. Test `src/sim/path.test.ts` — mirror `roadGraph.test.ts`: fixture
   straight/T/loop/disconnected exact; budget-exhaustion → fallback;
   seed sama → path identik; cache hit; satu round-trip worker.
6. Perf: tambah bench path ke `perf/`; pastikan `500 path <100ms`.
7. Gates: `npx tsc --noEmit`, `npx vitest run`, `npm run build`,
   `npm run lint`, `npm run arch`, `npm run licenses`.

## Jebakan (pelajaran T-405/T-406)

- Iterasi `Map` = insertion order → bangun adjacency terurut.
- Budget counter di dalam loop utama A*.
- Worker di vitest: pakai core sync, bukan worker sungguhan.
- `perf/run.test.ts` flaky di bawah beban suite (terbukti pre-existing via
  eksperimen stash di T-405) — jika gagal, ulangi solo sebelum panik.
- Output `bash`/`read` bisa kena dedup headroom: pakai `sed -n ... | cat -A`
  atau `python3 -c` + `repr()` untuk teks eksak; edit via skrip python
  assert-once.
