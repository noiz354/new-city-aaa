# ROADMAP — city-builder-aaa (kanonis, VS-0..VS-9)

> **Status:** canonical. `docs/05-execution/development-roadmap.md` adalah dokumen subordinat
> (detail historis VS-0..VS-7); bila bertentangan, file ini yang menang.
> Setiap milestone: goal, player outcome, dependencies, systems, skills, tasks, verification,
> perf budget, exit criteria, risks. Task ID lih. `tasks.md`.

## VS-0 — Foundation (scaffold + kontrak) — DONE ✅

- **Goal:** toolchain + kontrak arsitektur terkunci sebelum ada gameplay.
- **Player outcome:** (internal) `npm run dev|typecheck|test|build` hijau; CodeGraph terindex.
- **Dependencies:** — (root).
- **Systems:** Vite+TS strict, ESLint, Vitest, Playwright skeleton, sim/view split, typed-array grid kontrak.
- **Skills:** `spec-driven-development`, `planning-and-task-breakdown`, `tdd`, `codebase-design`, `code-review-and-quality`, `diagnosing-bugs`.
- **Tasks:** T-101..T-103.
- **Verification:** terminal log semua command pass.
- **Perf budget:** n/a (belum ada beban).
- **Exit:** scaffold + command ada; `plan.md` shim menunjuk `docs/spec.md`.
- **Risks:** scope creep tooling — mitigasi: kunci stack MVP.

## VS-1 — First Tile (grid + kamera + pick + clock + save) — DONE ✅

- **Goal:** peta kosong bisa di-orbit/select; fondasi tick & save terbukti.
- **Player outcome:** orbit map, hover tile (x,y), ganti kecepatan clock, save/load hash-equal.
- **Dependencies:** VS-0.
- **Systems:** terrain seeded, grid SoA 256², road/zone paint + bulldoze + cost, clock fixed-step,
  save v1 gzip+CRC, view terrain/water/road/zone, toolbar/topbar/inspector.
- **Skills:** `three-best-practices`, `webapp-testing`, `city-builder-roadmap-executor`.
- **Tasks:** T-104..T-110.
- **Verification:** 2 screenshot seed-identik, F3 overlay, save→load hash equal, dev 200 OK port 5180.
- **Perf budget:** empty-map 60fps; tick ≈ idle.
- **Exit:** orbit + select @60fps; test hijau.
- **Risks:** — (terlewati; bukti di `docs/05-execution/current-development-state.md`).

## VS-2 — First Living City (growth pertama, bangunan, populasi) — NEXT

- **Goal:** kota pertama yang hidup: rumah spawn, populasi > 0, RCI bar bergerak.
- **Player outcome (UJ-01, UJ-02 partial):** road → power → zone R → rumah spawn → pop naik;
  tambah C/I → shop/factory spawn, unemployment < 50%.
- **Dependencies:** VS-1 (grid, tools, clock, save).
- **Systems:** building lifecycle (vacant→construction→occupied→abandoned), growth scoring harian,
  road-access rule, upkeep tick, demand RCI v0, land value v0, procedural house mesh + instancing,
  HUD pop/RCI(p4).
- **Skills:** `city-builder-simulation-audit` (lifecycle + determinism), `city-builder-playability-test`
  (UJ first-house), `city-builder-performance-gate` (instancing budget), `city-builder-visual-qa`
  (screenshot before/after), `city-builder-roadmap-executor` (orkestrasi), `tdd`, `three-best-practices`.
- **Tasks:** T-201..T-208. Slice pertama: **VS-2a First House** (tumbuh 1 rumah tulus, bukan hardcode).
- **Verification:** before/after screenshot + pop>0; vitest growth/determinism; F3 + draw-call HUD.
- **Perf budget:** 2k zona render, draw call <100; tick harian <50ms p95.
- **Exit:** zoned+road tile tumbuh dalam ~10 game-day; RCI bar merespons.
- **Risks:** growth terasa magis (tanpa feedback) — mitigasi: skor terlihat di inspector; tuning di VS-3.

## VS-3 — Economy That Bites (treasury penuh, pajak, upkeep, RCI matang) — QUEUED

- **Goal:** uang bermakna: pajak, upkeep, krisis anggaran dapat terjadi dan dapat diperbaiki.
- **Player outcome (UJ-02 full, UJ-05):** R+C+I → unemployment < 20%; pajak 15% → income↑ happiness↓ abandonment → turunkan 9% + potong funding → stabil.
- **Dependencies:** VS-2 (growth, populasi).
- **Systems:** treasury monthly tick penuh (tax income − upkeep − service funding), slider pajak R/C/I 0–20%,
  budget panel + sparkline 12 bulan, RCI demand matang (unemployment/happiness/land/tax), balancing suite,
  tuning lock.
- **Skills:** `city-builder-simulation-audit`, `city-builder-playability-test` (UJ-05), `tdd`,
  `vercel-react-best-practices`, `vercel-composition-patterns`, `frontend-ui-engineering`.
- **Tasks:** T-301..T-306.
- **Verification:** unit test month-tick; HUD screenshot UJ-05; balancing suite hijau.
- **Perf budget:** month tick <50ms p95.
- **Exit:** UJ-01 + UJ-02 lolos; treasury tick benar via test.
- **Risks:** death spiral ekonomi (pajak tinggi → abandon → income drop) — mitigasi: balancing suite + advisor warning.

## VS-4 — Traffic & Utilities (graph, A*, congestion, power/water) — QUEUED

- **Goal:** komute terlihat dan listrik/air menjadi jaringan yang bisa gagal.
- **Player outcome (UJ-03, UJ-04):** 2.000+ commuter → mobil di jalan → segmen merah → jalan paralel melegakan;
  overload → brownout + ikon unpowered → plant ke-2 memulihkan; tower jauh unwatered sampai tower ke-2.
- **Dependencies:** VS-3 (pop/jobs, ekonomi).
- **Systems:** road graph builder (incremental, dirty chunk), A* + BPR + O-D cache + worker,
  traffic assignment + overlay LOS, visual agent pool (500 mobil + 300 pejalan),
  power flood fill + brownout I-first, water + pressure falloff, overlay utilitas.
- **Skills:** `tdd` (seams A*), `city-builder-simulation-audit`, `city-builder-playability-test` (UJ-03/UJ-04),
  `city-builder-performance-gate` (`npm run perf` harness).
- **Tasks:** T-401..T-407.
- **Verification:** vitest fixture graph (T-junction, loop); 500 path <100ms deterministik;
  2 screenshot overlay congestion; screenshot brownout before/after.
- **Perf budget:** path batch <100ms; day-tick <50ms p95.
- **Exit:** UJ-03 + UJ-04 lolos.
- **Risks:** A* lambat di 256² — mitigasi: cache + worker + fallback HPA*/distrik.

## VS-5 — Render Tier & Feel (day/night, LOD, post, audio, 256²) — QUEUED

- **Goal:** cantik + cepat: malam menyala, kota besar tetap 60fps.
- **Player outcome (UJ-08):** orbit malam + zoom street-level layak screenshot; preset quality; audio ambient.
- **Dependencies:** VS-4 (kota hidup yang pantas dipercantik).
- **Systems:** day/night sun orbit + emissive windows + lamp glow (0 real light tambahan),
  LOD + chunk culling + preset Low/Med/High/Ultra + Low-FX, post AA/bloom/vignette,
  audio engine WebAudio, default map 256² + object pool + HUD 4Hz throttle.
- **Skills:** `three-best-practices`, `performance-optimization`, `city-builder-performance-gate`,
  `city-builder-visual-qa`, `browser-testing-with-devtools` (bila MCP siap), `webapp-testing`.
- **Tasks:** T-501..T-505.
- **Verification:** screenshot day/night; F3 + draw HUD (<200 draws @10k); fps compare post on/off (<8% delta Med);
  `npm run perf` gate CI.
- **Perf budget:** NFR-01/03 (60fps Medium 5k; 30fps min 10k; heap <1.5GB).
- **Exit:** UJ-08 + NFR-01 lolos.
- **Risks:** draw call meledak — mitigasi: instancing + chunk merge + LOD.

## VS-6 — Crisis & Depth (services, lingkungan, disaster, advisor, tutorial) — QUEUED

- **Goal:** kota punya masalah bermakna dan pemain dibimbing menyelesaikannya.
- **Player outcome (UJ-05 full, UJ-06):** service coverage memengaruhi happiness; polusi industri mengusir R;
  meteor → rubble + api → rebuild → recovery; tutorial 5 langkah → 1k pop <15 mnt.
- **Dependencies:** VS-5.
- **Systems:** services (fire/police/school/clinic/park) coverage jarak-jalan + upkeep,
  pollution/crime/health/happiness field + diffusion + overlay,
  disaster (fire spread + earthquake + meteor) + rubble loop, advisor 3 tips, tutorial checklist,
  notifikasi + minimap + settings.
- **Skills:** semua verifier custom (`simulation-audit`, `playability-test`, `visual-qa`, `performance-gate`),
  `code-review-and-quality` pre-merge.
- **Tasks:** T-601..T-606.
- **Verification:** screenshot overlay polusi/coverage; screenshot disaster before/after;
  skrip manual tutorial; checklist NFR-05.
- **Perf budget:** diffusion via worker; tick tetap <50ms p95.
- **Exit:** UJ-05 + UJ-06 lolos; MVP COMPLETE (UJ-01..07) bila digabung VS-2..VS-5.
- **Risks:** sistem terasa menghukum — mitigasi: playtest + tuning advisor lebih dulu.

## VS-7 — Hardening & Ship (E2E penuh, save migration, perf gate, rilis) — QUEUED

- **Goal:** kirim v1.0 yang tidak memalukan: semua gate hijau, save aman, bundle kecil.
- **Player outcome:** `npm run test+e2e+perf` hijau; bundle awal <5MB; migrasi save teruji; release notes.
- **Dependencies:** VS-6.
- **Systems:** full E2E (UJ-01..08 script), save-migration test, bundle audit, F3 perf gate CI,
  a11y checklist, player FAQ, release tag.
- **Skills:** `webapp-testing`, `city-builder-performance-gate`, `code-review-and-quality`, `diagnosing-bugs`.
- **Tasks:** T-701..T-704.
- **Verification:** CI log + release tag; UJ-01..08 lolos; NFR-01..07 checklist.
- **Perf budget:** semua NFR (01–07) terpenuhi atau waived dengan issue + owner sign-off.
- **Exit:** SHIPPED v1.0.
- **Risks:** scope creep pra-rilis — mitigasi: feature freeze; stretch ke VS-8.

## VS-8 — Large City & Depth Lanjutan (expansion, pasca-v1)

- **Goal:** kota besar tetap hidup: transit, hierarki jalan, cuaca/musim, skenario.
- **Player outcome:** bus line + stop + mode split; avenue/highway/one-way; flood/season/weather;
  skenario + achievement; mod pack JSON.
- **Dependencies:** v1.0 (VS-7).
- **Systems:** transit, road hierarchy, weather/season/flood, scenario engine, modding building JSON.
- **Skills:** `city-builder-simulation-audit`, `city-builder-playability-test`, `three-best-practices`,
  `city-builder-performance-gate`.
- **Tasks:** T-801..T-805.
- **Verification:** skenario E2E; perf kota 10k bangunan <200 draws.
- **Perf budget:** NFR-01 dipertahankan pada skala 2×.
- **Exit:** expansion playable di belakang flag/track terpisah.
- **Risks:** merusak save v1 — mitigasi: version bump + migrasi + corpus test.

## VS-9 — Production Readiness (PWA, a11y penuh, mobile dasar, ops)

- **Goal:** produksi: offline, aksesibel, terukur.
- **Player outcome:** PWA playable offline setelah load pertama; keyboard-only build path penuh;
  overlay aman colorblind; telemetri perf opt-in.
- **Dependencies:** VS-7 (VS-8 opsional).
- **Systems:** PWA/service worker, a11y penuh (NFR-05 checklist signed), keybind remap,
  crash recovery UX, bundle/observability.
- **Skills:** `webapp-testing`, `frontend-ui-engineering`, `city-builder-visual-qa`,
  `code-review-and-quality`.
- **Tasks:** T-901..T-904.
- **Verification:** uji offline; checklist a11y; NFR-02..06 final.
- **Perf budget:** <5MB initial JS; interaktif <3s broadband.
- **Exit:** production checklist hijau; siap publikasi.
- **Risks:** service-worker cache basi — mitigasi: versioned cache + update prompt.

---

## Anti-rationalization (berlaku semua VS)

| Alasan | Jawaban wajib |
|---|---|
| "Terlalu sepele untuk test" | Sim/formula selalu dapat table test |
| "Test/perf nanti" | Nanti = tracked issue + owner sign-off, tidak pernah diam-diam |
| "Satu file lagi di PR ini" | Split; rujuk task ID |
| "Di mesin saya ngebut" | Tunjukkan F3 + draws + `perf` pada workload referensi |
| "Compat boleh rusak" | Version bump + migrasi + corpus, selalu |
| "Skip worker, main thread cukup" | Tunjukkan angka `perf`, baru putuskan |
| "Copy snippet GPL kecil" | Tidak pernah; clean-room; CI grep menegakkan |
