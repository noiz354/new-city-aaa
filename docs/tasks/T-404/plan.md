# PLAN T-404 — Visual agent pool (size M)

> Untuk coding agent: kerjakan langkah 1–5 berurutan. Theater murni — sim
> **tak tersentuh**. Jangan commit/push tanpa diminta.

## Deps / Accept / Evidence

- **Deps:** T-403 (butuh snapshot volume traffic).
- **Accept:** mobil di jalan sibuk, 0 saat pause.
- **Evidence:** screenshot (disarankan 2: sibuk + pause kosong).

## Spec anchor

`docs/02-architecture/transportation-and-pathfinding.md` §Theater:

- pool 500 mobil + 300 pejalan, sampling ∝ flow, interpolasi view,
  pulsing rush-hour. Truth tetap cohorts.

## Bearing awal (sudah diverifikasi, jangan riset ulang)

- Belum ada kode vehicle/agent di `src/view` (hanya kata insidental).
- Preseden test view: `src/view/buildings.test.ts`, `icons.test.ts`,
  `landvalue.test.ts` — logika sampling unit-testable.
- `clock.speed===0` = pause (pola ada di sim/clock).
- Helper instancing: `src/view/instancing.ts` (wajib dipakai — lihat Jebakan).

## Urutan build

1. `src/view/agents.ts` (baru) — AgentPool: InstancedMesh mobil (≤500) +
   pejalan (≤300); sampling edge top-flow dari snapshot traffic; posisi =
   interpolasi polyline edge; kecepatan ∝ speed edge × kemacetan;
   resample harian/perubahan volume; `clock.speed===0` → 0 visible;
   pulsing rush-hour dari tick→jam.
2. Headlight: accept menyebut "headlight malam" tapi day/night = T-501.
   Implement sebagai uniform faktor siap-toggle (emisif subtle); full night
   ikut T-501. Konfirmasi ke spec T-501 dan catat keputusan di kode.
3. Test: sampling + pause-visibility + rush-hour factor (seeded, lihat
   Jebakan). Ikuti preseden `view/*.test.ts`.
4. Gates: tsc, vitest, build, lint, arch, licenses.
5. Evidence: screenshot via `window.__game` (jalan sibuk + pause).

## Jebakan (pelajaran T-405/T-406)

- **Larangan `Math.random`** (aturan determinisme sim) — cek konvensi
  determinisme di view; pakai PRNG seeded.
- **WAJIB helper `instancing.ts`** (`expandInstanceBounds` dkk): bounds basi
  = layer ter-cull tak terlihat (bug nyata T-406, debug 45 pesan).
- Live map bisa 256² — jangan asumsikan 64 (pelajaran screenshot T-406).
- Perubahan sim = dilarang di task ini; data hanya via snapshot traffic.
