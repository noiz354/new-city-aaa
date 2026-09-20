# PLAN T-403 — Traffic assignment + viz (size M)

> Untuk coding agent: kerjakan langkah 1–7 berurutan. Setiap langkah selesai
> = kode + test hijau sebelum lanjut. Jangan commit/push tanpa diminta.

## Deps / Accept / Evidence

- **Deps:** T-402 (wajib hijau dulu).
- **Accept:** 1 jalan macet (merah); jalan paralel melegakan (UJ-03).
- **Evidence:** 2 screenshot overlay (macet + lega).

## Spec anchor

`docs/02-architecture/transportation-and-pathfinding.md` §Daily:

- nol-kan volume → tiap employed cohort tambah
  `count × 2 trips × 0.8 car-share` sepanjang path → v/c per edge → LOS A–F →
  feedback BPR ke bobot hari berikut + penalti happiness untuk komute >45 mnt.
- Truth = cohorts (cap ~2k + overflow bucket tergabung).

## Bearing awal (sudah diverifikasi, jangan riset ulang)

- Field `edge.volume` **sudah ada** dari T-401
  (`{lengthM, lanes:2, speedKph:40, capacity:1600, volume:0}`).
- `src/sim/cohort.ts:82` iterasi `buildings.forEachLive`; `recompute`
  membangun `wChunks/jChunks` (chunk key → residents/job openings).
- Tiru pola overlay `PowerOverlay`/`WaterOverlay` (`src/view/power.ts`,
  `src/view/watergrid.ts`) untuk `TrafficOverlay` (DataTexture tint by LOS).
- Volume derived → **tanpa persist, tanpa bump codec** (spec §9).

## Urutan build

1. **Bearing wajib pertama:** apakah `cohort.recompute` match job secara
   chunk-pairwise? Jika ya, matriks aliran O-D chunk→chunk gratis. Jika hanya
   agregat → tambah matriks flow chunk-pair derived (cap + overflow bucket).
2. `src/sim/traffic.ts` (baru) — class Traffic, pass harian: nol-kan volume,
   untuk tiap aliran O-D cari path via T-402 (pakai cache!), akumulasi
   `volume = count×2×0.8`, hitung v/c + LOS (threshold di
   `tuning/traffic.ts`), umpan BPR ke hari berikut, komute menit → input
   penalti happiness cohort (>45 mnt).
3. `src/sim/sim.ts` — urutan daily: cohort → traffic → demand (happiness
   mengumpan demand; jangan terbalik). Lihat pola wiring power/water
   (`power.recompute()` di daily pass + immediate di `execute` bila perlu).
4. Test `src/sim/traffic.test.ts` — skenario UJ-03 deterministik: koridor satu
   jalan → LOS F (assert angka v/c + warna); tambah jalan paralel → v/c turun.
5. View: `TrafficOverlay` + indikator congestion TopBar (minimal badge; cek
   spec alert dulu sebelum desain besar).
6. Gates: tsc, vitest, build, lint, arch, licenses.
7. Evidence: 2 screenshot via `window.__game` (pola T-405/T-406: skenario
   `execute` + `sim.update`, `take_screenshot`): macet (merah) + lega.

## Jebakan (pelajaran T-405/T-406)

- Stabilitas feedback BPR: pertimbangkan damping; catat keputusan di kode.
- `paths/day × cache` = penentu perf — profil via `npm run perf`.
- View overlay: pakai helper `instancing.ts` (bounds basi = layer ter-cull
  tak terlihat — bug nyata T-406).
- `store` di `__game` adalah class `UiStore` → baca via
  `store.getState()`, bukan akses properti langsung.
