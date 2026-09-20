# PLAN T-407 — Overlay utilitas (size S)

> Untuk coding agent: kerjakan langkah 1–6 berurutan. Jangan commit/push
> tanpa diminta.

## Deps / Accept / Evidence

- **Deps:** T-403 + T-405 (T-405 ✅; T-403 harus hijau dulu).
- **Accept:** semua overlay render (power/water/traffic/value).
- **Evidence:** screenshots (satu per overlay, 4 shot).

## Bearing awal (sudah diverifikasi, jangan riset ulang)

- Tombol overlay ada: Value (`toggleValueOverlay`), Power
  (`togglePowerOverlay`, key P), Water (`toggleWaterOverlay`, key W) —
  pola di `src/ui/react/TopBar.tsx`, `src/ui/actions.ts`, `src/ui/store.ts`
  (`UiState` + init `false`), `src/main.ts` (implementasi toggle +
  `view.attach*/sync*`, pump 250ms `refresh*`).
- Overlay ada: `landvalue.ts` (value), `view/power.ts` (power),
  `view/watergrid.ts` (water); traffic overlay dari T-403.
- Inspector: cabang `no-power → powerReason`, `no-water → waterReason`
  (`src/ui/react/Inspector.tsx:44`) — tiru untuk traffic/value.
- `TOOL_KEYS` di `src/ui/tools.ts` — P/W terpakai; key traffic baru cek
  konflik dulu.
- `store` di `__game` = class → `store.getState()` (pelajaran T-406).

## Urutan build

1. Cek `docs/06-ui-ux-save-polish.md` untuk perilaku tab: radio
   single-active vs toggle independen. Usulan: radio + off.
2. UI: tab Power/Water/Traffic/Value di TopBar (atau komponen
   `UtilityTabs` baru bila TopBar penuh); reuse semua overlay yang ada.
3. Inspector akurat per klik tile: power (powered + reason), water
   (pressure kL — tambah `waterReason` setara `powerReason` bila belum ada),
   traffic (v/c + LOS edge), value (land value).
4. Keybind tab traffic (cek konflik `TOOL_KEYS`); dokumentasikan di bantuan
   keybind bila ada.
5. Test: render TopBar/toolbar + toggle tiap overlay + field inspector
   (mirror `TopBar.test.tsx` yang sudah ada — preseden fixture
   `+waterOverlay={false}`).
6. Gates: tsc, vitest, build, lint, arch, licenses. Evidence: 4 screenshot
   via `window.__game` + `take_screenshot`.

## Jebakan (pelajaran T-405/T-406)

- Interplay visibilitas mesh overlay (satu aktif vs banyak) — definisikan
  dan test.
- `TopBar.test.tsx` snapshot: tiap prop overlay baru harus ditambah ke
  fixture atau snapshot gagal.
- Struct `SimSnapshot` bertambah di tiap task utilitas — pastikan
  `toEqual(snapshot)` di test codec tetap hijau.
