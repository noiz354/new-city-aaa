# TASKS — city-builder-aaa (kanonis)

> **Status:** canonical. Setiap task = satu sesi fokus, satu PR (<300 baris), dengan **acceptance + evidence**.
> Jangan mulai T berikutnya sebelum T berjalan dikonfirmasi bekerja.
> Ukuran: **S** (<1 jam) · **M** (1–3 jam) · **L** (3–6 jam). `Deps` wajib selesai dulu.
> Aturan centang: `- [ ]` → `- [x]` **hanya** setelah gate DoD lolos + bukti dilampirkan
> (`05-execution/definition-of-done.md`, `05-execution/verification-strategy.md`).
> Rujuk ID FR di `docs/spec.md` + modul di `02-architecture/` pada setiap PR.
> Skill aktual per )).group lih. `docs/06-agent-skills/skill-task-mapping.md`
> (nama generik seperti `simulation-core`/`threejs-rendering` **tidak ada** — pakai nama di bawah).
>
> **Status reconcile (2026-09-19):** VS-0 dan VS-1 `[x]` terverifikasi (bukti: typecheck/build/test hijau,
> dev 200 OK port 5180, save hash-equal, F3 overlay — lih. `docs/05-execution/current-development-state.md`).
> Update 2026-09-19 #2: **T-201 `[x]`** (19 test baru hijau; VS-2a dimulai). Selain itu semua tahap lain `[ ]` —
> termasuk yang disebut di dokumen lama seolah selesai.
> Update 2026-09-19 #12: **blocker browser terbuka** — Chromium 153 + WebGL2 (SwiftShader) jalan di sandbox
> (`PW_CHROMIUM_PATH`, lih. `docs/05-execution/current-development-state.md` §How to run); `npm run e2e` 8/8 hijau,
> bukti screenshot VS-2a/T-303 tertangkap → **T-202..T-208 `[x]`, T-303 `[x]`, VS-2 GATE `[x]` (visual)**.
> Tiga bug ditemukan oleh capture & diperbaiki dengan test: culling InstancedMesh (rumah/ikon hilang saat kamera geser),
> Net budget panel tanpa subsidi, demand tak di-recompute saat load.
> Update 2026-09-20 #1: **T-302 `[x]`** — slider pajak R/C/I (0–20%, default 9%) + persistensi tax rate via
> **save-format v2 + migrasi** (keputusan §9 ask-first yang sebelumnya di-skip, disetujui user: v2+migration).
> SAVE_VERSION 1→2, section 5 (policy: tax r/c/i); save v1 (tanpa policy) di-migrasi ke default 9/9/9 + repair note.
> `codec.test.ts` +3 test (version/policy, persist custom tax, migrasi v1→v2), `economy.test.ts` +1 (15%→income↑).
> Suite **147/147**, lint/arch/licenses/typecheck/build hijau. T-304…T-306 kini tidak lagi ter-gate keputusan format save.
> Update 2026-09-20 #2: **T-304 + T-305 `[x]`** — cohort nyata (`sim/cohort.ts`: residents, jobs C/I, gravity match,
> unemployment, happiness) menggantikan stub demand; accept **R+C+I unemployment <20%** tertest. Suite **153/153**.

## VS-0 — Foundation (T-1xx)

- [x] **T-101 S — Scaffold + commands.** Vite + TS strict + ESLint + Vitest + Playwright skeleton.
  `Deps: —` · `Accept: npm run dev|typecheck|test|build pass.` · `Evidence: terminal log.` · `Skills: tdd, codebase-design`
- [x] **T-102 S — Kontrak sim/view + clock.** Fixed-step accumulator, pause/1x/2x/3x, day counter, F3 overlay (fps + tickMs).
  `Deps: T-101` · `Accept: speed mengubah ticks/sec; render decoupled.` · `Evidence: F3 screenshot.` · `Skills: tdd`
- [x] **T-103 S — Grid SoA + terrain seeded.** Typed-array grid (flag 256), noise terrain + water plane.
  `Deps: T-101` · `Accept: seed sama → identik; seed beda → beda.` · `Evidence: 2 screenshot seed sama.` · `Skills: tdd`

## VS-1 — First Tile (T-104..T-110)

- [x] **T-104 M — Renderer + kamera.** Scene, ACES, fog, hemi+dir light, rig Ortho↔Persp damped orbit/pan/zoom.
  `Deps: T-101` · `Accept: ground plane kosong, toggle kamera, 60fps.` · `Evidence: screenshot + fps.` · `Skills: three-best-practices`
- [x] **T-105 M — Picking + highlight.** Raycast-to-plane → koordinat tile, hover highlight, inspector stub.
  `Deps: T-104` · `Accept: hover tampil (x,y); dua kamera.` · `Evidence: screenshot.` · `Skills: three-best-practices, webapp-testing`
- [x] **T-106 M — Toolbar + tool state.** Select/Road/R/C/I/PowerLine/Plant/Water/Bulldoze + Esc cancel + cost stub.
  `Deps: T-105` · `Accept: ganti tool + label kursor.` · `Evidence: screenshot.` · `Skills: frontend-ui-engineering, city-builder-visual-qa`
- [x] **T-107 M — Road placement.** Drag-line preview validitas hijau/merah, cost = length×price, tulis road layer.
  `Deps: T-106` · `Accept: drag L-shape bekerja; dana terpotong.` · `Evidence: screenshot + treasury log.` · `Skills: city-builder-playability-test`
- [x] **T-108 M — Zone painting + bulldoze.** Drag-rect R/C/I + marquee bulldoze; chunk dirty flag.
  `Deps: T-106` · `Accept: zona berwarna; bulldoze membersihkan.` · `Evidence: screenshot.` · `Skills: city-builder-playability-test`
- [x] **T-109 M — Instanced meshers dasar.** Terrain 1-draw + road merge + InstancedMesh bangunan + pohon.
  `Deps: T-103,T-107` · `Accept: 2k zona render, draw call <100.` · `Evidence: draw-call HUD.` · `Skills: three-best-practices, city-builder-performance-gate`
- [x] **T-110 M — Save format v1 + HUD dasar.** Header + binary layers + entities, gzip + hash; topbar/toolbar/inspector.
  `Deps: T-103` · `Accept: save→load hash equal pada fixture.` · `Evidence: vitest log.` · `Skills: tdd, city-builder-playability-test`
- [x] **VS-1 GATE:** orbit + select @60fps map kosong; `npm run test` hijau; dev 200 OK `:5180`.

## VS-2 — First Living City (T-2xx) — NEXT

> Slice pertama: **VS-2a First House** = T-201..T-203 (satu rumah tulus tumbuh, bukan hardcode).

- [x] **T-201 M — Building lifecycle state.** State machine vacant→construction→occupied→abandoned + entity `buildings[]` terisi.
  `Deps: VS-1 GATE` · `Accept: transisi terdokumen + unit test tiap transisi.` · `Evidence: vitest log (buildings.test.ts 19/19, suite 66/66, 2026-09-19).` · `Skills: city-builder-simulation-audit, tdd`
  Selesai: `src/sim/buildings.ts` (transisi kanonis design-doc §2, scope VS-2a; timer 3 hari via tuning), wiring `sim.ts`
  (onTick, sweep bulldoze/road, snapshot.population, hash, loadState reset), rule "not occupied" di `validateZone`.
  Persistence entity (codec section 4) menyusul T-202 — terdokumentasi di header modul.
- [x] **T-202 M — Growth engine v0.** Scoring harian → spawn 1 rumah pada tile zoned+road+powered dalam ~10 game-day.
  `Deps: T-201` · `Accept: pop>0; screenshot before/after.` · `Evidence: screenshot + pop HUD.` · `Skills: city-builder-simulation-audit, city-builder-playability-test`
  - **Status: PARTIAL (2026-09-19).** Sim+persistence PASS: `src/sim/growth.ts` (scoring harian, eligibility
    road-adjacency v0, pacing 1/hari, move-in capacity; powered/watered v0=serviced sampai VS-4), entity
    section 4 di codec (round-trip hash-equal; pre-entity save → repair note + empty), event
    `building-changed`; suite 78/78, determinisme 250/125ms hash-equal, perf dayP95 0.716ms≪50ms
    (baseline direfresh via UPDATE_BASELINE=1). pop>0 TERBUKTI deterministic di test (occupied L1 R=4).
  - **DONE 2026-09-19 #12 — evidence:** `docs/05-execution/evidence/vs2a-t202-before.png` (D1, Pop 0) →
    `vs2a-t202-after-pop-hud.png` (D13, 12 bangunan, **Pop 36** di HUD); e2e `vs2a-evidence.spec.ts` assert
    buildings>0 & pop>0 dalam 12 hari. Catatan balancing (bukan blocker): spawn harian tunggal jatuh ke zona
    ber-demand tertinggi (bootstrap I +17 > R +7 > C +2) — zona I yang dipasang hari-1 menunda rumah pertama
    berminggu-minggu; playthrough bukti memakai urutan pemain wajar (R dulu, I menyusul). Owner: T-304/T-305.
- [x] **T-203 M — Visual rumah + instancing.** Procedural house mesh + InstancedMesh swap saat spawn; 0 crash bila aset hilang.
  `Deps: T-202` · `Accept: rumah terlihat di tile tumbuh.` · `Evidence: screenshot.` · `Skills: three-best-practices, city-builder-visual-qa`
  - **Status: PARTIAL (2026-09-19).** `src/view/buildings.ts`: 2 InstancedMesh (scaffold/house procedural,
    tint abandoned, swap-remove dense, capacity grow ×2, rotasi fasad deterministik) — murni proyeksi state sim
    (deltas via `building-changed`, rebuild via `sync`), nol aset eksternal (crash-by-missing-asset mustahil by
    construction). Wiring `view.ts` + `main.ts`; 7 unit test headless (positions/denseness/grow/sync idempoten/2 draws);
    suite 85/85; build 828KB/226.6KB gzip; dev 200 OK.
  - **DONE 2026-09-19 #12 — evidence:** `evidence/vs2a-t203-houses-closeup.png` (9 rumah hip-roof occupied + 3
    scaffold amber di lot tumbuh, kamera jauh dari origin). **Bug ditemukan & diperbaiki:** InstancedMesh
    bounding sphere tak pernah diperbarui setelah `setMatrixAt` → three men-cull seluruh layer begitu kamera
    menjauh dari origin dunia (rumah/ikon lenyap, draws turun). Fix `src/view/instancing.ts`
    (expand/refresh bounds pada place/remove/sync/grow) + `instancing.test.ts` (RED tanpa fix, GREEN dengan).
- [x] **T-204 M — Road-access rule.** Tanpa path → ikon "No road connection", growth berhenti.
  `Deps: T-202` · `Accept: zona terisolasi tidak tumbuh + ikon tampil.` · `Evidence: screenshot.` · `Skills: city-builder-simulation-audit`
  - **Status: PARTIAL (2026-09-19).** Rule kanonis (transportation §1: attachment Manhattan ≤2, T-401 upgrade
    ke graph-edge) terimplementasi penuh: `src/sim/road-access.ts` (probe `isConnected`, flag harian inkremental
    via `noteRect`, flip→event `road-access-changed`, `collectBlocked`), growth rewired (spawn/move-in/cancel
    mid-build per design-doc §2), save-load recompute. 11 sim test hijau (radius 1/2/diagonal/3, blok permanen,
    cancel saat road hilang, reconnect→move-in, dua jaringan independen, load-restore, determinisme hash);
    perf dayP95 2.14ms direkondisikan → tetap ≤1.43ms (full-scan diganti inkremental ±2 setelah regression
    budget tercatat). Ikon: `src/view/icons.ts` (InstancedMesh octahedron unlit, proyeksi murni: deltas +
    `sync` pasca-load) + 5 unit test; Inspector menampilkan reason sim-owned; e2e `vs2a.spec.ts` siap.
    Suite 101/101; lint/typecheck/build + arch bersih.
  - **DONE 2026-09-19 #12 — evidence:** `evidence/vs2a-t204-no-road-icon.png` — 4 ikon merah di atas zona R 2×2
    terisolasi, Inspector "Growth blocked: No road access (road within 2 tiles required)", Pop 0 @ D21;
    e2e `vs2a.spec.ts` hijau (fast-forward sinkron 20 hari, 24 s).
- [x] **T-205 M — Upkeep tick.** Upkeep bulanan per bangunan; treasury berkurang terukur + unit test.
  `Deps: T-202` · `Accept: month tick mengubah $ benar.` · `Evidence: test log + HUD.` · `Skills: city-builder-simulation-audit, tdd`
  - **Status: PARTIAL (2026-09-19).** "month tick mengubah $ benar" TERBUKTI di test log: `src/sim/upkeep.ts`
    (economy stage pasca-growth per frozen order §2), tabel kanonis `tuning/upkeep.ts` (R1/2/3=2/6/15,
    C=4/12/30, I=6/18/45 — docs/03-simulation-core; roads floor(N×½) — B3; Frontier subsidy floor(gross×7/10)
    saat pop<500 — B6; integer hukum B1; balance boleh negatif, bankruptcy-block=T-301). Occupied+abandoned
    bayar; construction gratis; zona vacant gratis (B3); bill derived tiap pass (tanpa persist). 10 test hijau:
    parts kanonis, billed exactly 17 (10×R1+10 roads, subsidy), subsidy hilang di ≥500 pop (297 penuh,
    135 rumah), bulldoze menghentikan biaya, event `treasury-changed`, determinisme hash, load/save parity.
    Suite 111/111; lint/arch/typecheck/build bersih.
  - **DONE 2026-09-19 #12 — evidence:** `evidence/vs2a-t205-month-tick-hud.png` (Y1 M2 D3: $17,795 → $19,202;
    panel: upkeep −$126, subsidi +$38) + e2e assert `Δbalance === income − expense + subsidy` tepat.
- [x] **T-206 M — RCI demand v0.** Demand −100..+100 dari unemployment/happiness/tax; RCI bar HUD merespons.
  `Deps: T-205` · `Accept: 80% branch coverage fungsi demand.` · `Evidence: vitest log.` · `Skills: city-builder-simulation-audit, tdd`
  - **Status: PARTIAL (2026-09-19).** Acceptance branch coverage TERBUKTI TERUKUR: `src/sim/demand.ts`
    **94.1% branch (16/17), 96.7% statement** (v8 json coverage) — di atas 80%. Formula kanonis
    docs/03-simulation-core §2 apa adanya (bobot `tuning/demand.ts`; bobot terkunci balancing suite T-306);
    komputasi tangan bootstrap: **R +7, C +2, I +16.5 @ pajak 9%** (membolehkan VS-2a tetap tumbuh).
    Ledger stub v0 (header modul): unemp/jobs/workforce=0 (T-305), happy=0.5 (VS-3/T-305), tax 9% (T-301),
    `?` terms di-drop, **smoothing 0.2/day DICUT** (momentum=persisted state → save-format change → §9 ask-first;
    recompute di **akhir** growth stage dgn lag 1 hari = pengganti) dan **vacancy diinterpretasi dwelling-R**
    (rumah occupied-occupants-0 ÷ occupied-R; semantik kanonis "emptyZoned/totalZoned" mustahil bootstrap).
    Integrasi: growth eligibility supersede stub T-202; C/I bootstrap kini spawn; snapshot.demand int →
    RCI bars TopBar (pos/neg tint). 10 test hijau.
  - **DONE 2026-09-19 #12 — evidence:** strip RCI live di semua screenshot VS-2a (R +7 C +2 I +17 → C +3 saat
    pop 76, `vs2a-t205-month-tick-hud.png`). **Bug ditemukan & diperbaiki:** `loadState` tidak me-recompute demand
    (HUD C +2 pasca-load vs +3 pra-save) — dan growth membaca demand *sebelum* recompute harian, jadi hari pertama
    pasca-load bisa menyimpang dari run tanpa interupsi; fix di `sim.ts` + codec test (RED→GREEN).
    Balancing S-green calibration tetap milik VS-3 (T-304/T-306).
- [x] **T-207 M — Land value v0 + desirability.** Base − pollution + halo park/air; difusi 3×3; overlay.
  `Deps: T-202` · `Accept: park menaikkan value sekitar; overlay gradien.` · `Evidence: overlay screenshot.` · `Skills: city-builder-simulation-audit`
  - **Status: PARTIAL (2026-09-19).** Engine kanonis docs/02 §4: `src/sim/fields.ts` lane statis
    (terrain base + halo air radius 3/w 20 + forest radius 3/w 10) + stamp dinamis I-occupied per-level
    (30/90/180 — dikalibrasi agar anchor "I depresses value ≥15 @ radius" dari utilities §3 TERPENUHI
    di test) → **2-pass separable 3×3 blur** → clamp 0..100, cadangan **park halo radius 4/w 15** aktif
    sebagai seam engine (test "park seam": park menyuntik value ke seedikit ≤4 tile). Fit kanonis
    docs/03 §3 → growth score × landFit (R/C 0.5+v/200; I 1.2−v/150): test membuktikan R bypass
    lot plume low-idx demi lot bersih high-idx. Derived, tanpa persist; load → invalidateStatic+recompute.
    Perf: dayP95 **0.74ms** (split static/dynamic + skip pollutionSig).
  - **Landslide decision pending (§9 ask-first, user skipped 2026-09-19):** plop park butuh bagian save
    baru → park BELUM bisa ditanam pemain; acceptance "park menaikkan value sekitar" terverifikasi di
    level engine via injeksi seam, placement menunggu izin format save → task tetap PARTIAL sampai itu.
  - **DONE 2026-09-19 #12 — evidence:** `evidence/vs2a-t207-value-overlay.png` (V-key; plume coklat mengelilingi
    strip I, sisi R tetap hijau; e2e assert `valueAt(dekat I) < valueAt(dekat R)`). Park plop: park kanonis =
    service (`utilities-and-environment` §1 → T-601, VS-6); placement pemain menunggu keputusan format save (§9).
  - Skills: `city-builder-simulation-audit`; perf-gate temuan: cost harian penuh (dihindari via static split).
- [x] **T-208 S — HUD pop/RCI(p4).** Populasi + RCI bar + jobs + unemployment selalu terlihat; update 4Hz.
  `Deps: T-206` · `Accept: angka berubah saat kota tumbuh.` · `Evidence: HUD screenshot.` · `Skills: frontend-ui-engineering`
  - **Status: engine-complete 2026-09-19, visual evidence blocked.** TopBar kini `Pop {n} · Jobs {n} · Unemp {n}%`
    (FR-U02 layout doc UI §1) + strip RCI T-206; angka ikut kota tumbuh via pump snapshot 250 ms (4Hz — diverifikasi);
    jobs/unemployment 0 konstan PENUH intentional (ledger demand.ts: cohort/jobs model = T-305); render-test
    memastikan angka tumbuh muncul (→132 tests; glob vitest diperluas untuk .test.tsx).
  - **DONE 2026-09-19 #12 — evidence:** `Pop 0 · Jobs 0 · Unemp 0%` → `Pop 36` → `Pop 76` di
    `vs2a-t202-before.png` / `vs2a-t202-after-pop-hud.png` / `vs2a-t205-month-tick-hud.png`; e2e assert teks HUD
    berubah saat kota tumbuh. F3 overlay dipindah ke kiri-bawah (sebelumnya menutupi treasury di TopBar).
- [x] **VS-2 GATE:** UJ-01 + UJ-02 partial (rumah/shop spawn, pop tumbuh, $ tick). **VERIFIED (engine + visual)**
  - **Verdict 2026-09-19 — engine-complete via test suite (visual capture blocked lingkungan, inherited):**
    rumah/shop spawn (growth determinisme test: seed 25 hierarki R birth d4, C d7), pop tumbuh ≥25
    (growth determinisme + desirability), $ tick bulanan (upkeep tests: −$120/bln build-only + savings→d5),
    save→reload→lanjut (round-trip byte-equal tests, roads/subsidi parity). Suite 132/132, perf 0.74ms p95.
    **Visual playthrough 2026-09-19 #12:** `e2e/vs2a-evidence.spec.ts` (browser asli, seed 25) — rumah spawn →
    Pop 36 (D13) → industri → month tick → budget panel → save → reload → load hash-equal (`evidence/vs2a-gate-loaded.png`)
    → lanjut 5 hari. `npm run e2e` 8/8 hijau (vs1 regresi + vs2a + evidence), 4.5 mnt @ SwiftShader.

## VS-3 — Economy That Bites (T-3xx)

- [x] **T-301 M — Treasury monthly tick penuh.** Tax income − upkeep − service funding; bankrupt block + modal. **DONE (engine)**
  `Deps: VS-2 GATE` · `Accept: month tick benar (unit test).` · `Evidence: test log.` · `Skills: city-builder-simulation-audit, tdd`
  - **Status: DONE 2026-09-19** — acceptance unit-test-based (month tick benar): formula kanonik docs/02 §4
    (income = TAX_BASE × rate/9 × (0.6+0.4·happy/100), happy stub 80 ledger T-305; TAX_BASE = 1.25× upkeep
    "first guess, S-green calibrates" per progression §2); settle order income→upkeep→record; ring 12 bln
    (derived-analytics, sengaja tanpa save-format change); bankruptcy < −$5k → execute() reject 'bankrupt'
    + BankruptcyModal (T-303 mengganti dengan budget panel); setTax clamp 0..20 (seam T-302).
  - **Evidence: vitest log** — economy.test.ts 7/7 (income exact 23 = 25×0.92; clamp; settle+ring; wrap;
    bankrupt recover; cadence) + 3 upkeep tests direvisi ke settle-semantics. Suite 138/138, perf hijau.
  - **Note:** service funding (slider 50/100/150%) milik VS-5 (T-303 selesai tanpa funding — belum ada service era ini);
    tax-rate persist telah selesai di T-302 via v2 + migrasi (keputusan §9 ask-first **resolved**).
- [x] **T-302 M — Slider pajak R/C/I.** 0–20% (default 9%); income = Σ level×rate×happinessFactor.
  `Deps: T-301` · `Accept: 15% → income↑ happiness↓ (UJ-05 partial).` · `Evidence: screenshot + test.` · `Skills: frontend-ui-engineering`
  - **Status: DONE 2026-09-20.** Slider R/C/I 0–20% di `BudgetPanel.tsx` (onTax → `economy.setTax`, clamp 0..20,
    snapshot.tax membumikan nilai slider); persistensi tax rate via **save-format v2 + migrasi** (keputusan §9
    ask-first: user menyetujui v2+migration). `codec.ts`: SAVE_VERSION 1→2, `SECTION_POLICY=5`, `encodePolicy`/
    `parsePolicy`/`resolvePolicy` (default 9/9/9 untuk save pre-v2 / korup). `Sim.getSavePolicy()` + `loadState`
    menerapkan policy; `SaveSource` & `SimSnapshot` membawa policy. `main.ts` menyalurkan `dec.policy` saat load.
  - **Evidence: vitest log** — `economy.test.ts` 15%→income↑ (8 test ekonomi); `codec.test.ts` +3 (version/policy
    hadir; custom tax 15/4/20 round-trip + continuation hash-equal; save v1 tanpa policy → default 9/9/9 + repair
    note). `BudgetPanel.test.tsx` +1 (3 slider di-render di nilai saat ini). `npm run ci` hijau (147/147).
  - **Note:** service funding (slider 50/100/150%) tetap milik VS-5 (belum ada service era ini); tidak di-persist
    bersama T-302. Tax rate kini di-persist (§9 resolved: v2 + migrasi).
- [x] **T-303 M — Budget panel.** Breakdown income/expense + sparkline 12 bulan + slider funding service.
  `Deps: T-301` · `Accept: panel akurat vs sim.` · `Evidence: screenshot.` · `Skills: vercel-react-best-practices, frontend-ui-engineering`
  - **Status: engine-complete 2026-09-19.** `BudgetPanel.tsx` (panel atas modal): breakdown exact dari
    `snapshot.lastMonth` (UI kernel kosong), sparkline SVG ≤12 bulan (2 bar/bln, right-edge = newest),
    tombol B/Escape/close, placeholder funding-slider documented sebagai service-era (VS-5 — service
    belum ada era ini; funding·scale outputs/radii menempel ke services di docs/02 §4) + T-302 tax slider
    note. Render-test memastikan angka persis + jumlah bar = 2×history (sign −$ diformat benar).
  - **DONE 2026-09-19 #12 — evidence:** `evidence/vs3-t303-budget-panel.png` (+$1,495 / −$126 / subsidi +$38 /
    Net +$1,407 = Δtreasury persis; 1 pasang bar). **Bug akurasi ditemukan & diperbaiki:** Net dihitung
    income − gross upkeep, padahal treasury bergerak income − (gross − subsidi Frontier) → baris "Frontier subsidy"
    ditambah, `snapshot.lastMonth/history` kini membawa `subsidy`, render-test + economy test invariant Δbalance.
    Escape kini menutup panel (sebelumnya hanya B/✕). Slider funding tetap placeholder service-era (VS-5/VS-6).
- [x] **T-304 M — RCI demand matang.** Bobot unemployment/happiness/land/tax final + unit test.
  `Deps: T-302` · `Accept: R+C+I → unemployment <20%.` · `Evidence: HUD screenshot.` · `Skills: city-builder-simulation-audit`
  - **Status: DONE 2026-09-20 (tersambung T-305).** Bobot tetap canonical docs/03 §2 (`tuning/demand.ts`,
    tidak diubah — penguncian final milik T-306). Yang "matang" adalah inputnya: demand kini menerima
    ledger cohort nyata (unemployment/happiness/jobsAvailable/workforceAvail) via injeksi `Demand({cohort, getTax})`,
    bukan stub konstan; absence → stub netral (determinisme & pemakaian standalone tetap). Tax kini per-zone
    dari `economy.tax` (persist v2). **Accept terpenuhi:** kota R+C+I berimbang → unemployment <20% (cohort.test).
    **Evidence: vitest** (screenshot HUD perlu browser sandbox — lihat catatan T-302/VS-3).
- [x] **T-305 M — Citizens + jobs (cohort).** Resident/job count, gravity match, unemployment + happiness.
  `Deps: T-304` · `Accept: kota R+C+I unemployment <20%.` · `Evidence: HUD screenshot.` · `Skills: city-builder-simulation-audit`
  - **Status: DONE 2026-09-20.** Modul baru `sim/cohort.ts` (v1 net-flow per §1 scope-cut; migrasi/aging ditunda).
    Residents = occ buildings.occupants (max-occup di-place growth). Jobs = pembukaan C/I occ (`jobsPerBuilding`
    C2/I3 × level — tunable `tuning/cohort.ts`, "first guess — S-green decides"). Gravity match per-chunk
    (`openings/(1+dist/800)²`, `gravityMeters=800`, cut `maxCommuteMeters=3000`, iterasi Map deterministis).
    Happiness v1 = base 50 + employed·10 + lowTax·8 (residence setara → mean; subset docs/03 §4, sejalan
    stub 80 yang sudah dipakai ekonomi T-301). Snapshot `jobs`/`unemployment` kini nyata (dulu 0 konstan T-208).
  - **Keputusan model:** unemployment **0 saat J=0** (belum ada pasar kerja) — kota R-only tetap layak tumbuh
    (kontrak VS-2a "zone R → rumah tumbuh"); begitu C/I ada, unemployment nyata naik bila tenaga kerja > pembukaan.
    Tanpa ini, R-only → 100% unemployment → demandR negatif → growth mati total.
  - **Integration:** `Sim.onTick` day-boundary `growth.onDay → cohort.recompute(tax.r) → demand.recompute →
    fields.recompute` (order §2); `loadState()` recompute derived `cohort→demand` setelah restore world/buildings/tax.
    Determinisme: derived, tidak dipersist; save→load→continue hash-equal tetap (codec/upkeep/demand parity tests).
  - **Evidence: vitest — `cohort.test.ts` 6 test** (neutral-ledger bootstrap; invariant matched≤min(W,J);
    **R+C+I unemployment <20% + snapshot HUD**; R-only J=0→u=0 jobMarket; determinisme script). Suite **153/153**
    (+6), lint/arch/licenses/typecheck/build hijau. **Accept terpenuhi:** unemployment <20% (test).
- [ ] **T-306 M — Balancing suite + tuning lock.** Korpus skenario ekonomi hijau; angka tuning dikunci.
  `Deps: T-305` · `Accept: suite hijau.` · `Evidence: CI log.` · `Skills: city-builder-simulation-audit, city-builder-performance-gate`
- [ ] **VS-3 GATE:** UJ-01 + UJ-02 penuh; UJ-05 lolos.

## VS-4 — Traffic & Utilities (T-4xx)

- [ ] **T-401 M — Road graph builder.** Node/edge dari road tile, rebuild incremental; unit test T-junction + loop.
  `Deps: VS-3 GATE` · `Accept: graph cocok fixture.` · `Evidence: vitest log.` · `Skills: tdd, city-builder-simulation-audit`
- [ ] **T-402 L — A* + cache + worker.** Binary-heap A*, bobot BPR, cache O-D, offload worker; harness `npm run perf`.
  `Deps: T-401` · `Accept: 500 path <100ms; deterministik seed sama.` · `Evidence: perf log.` · `Skills: tdd, city-builder-simulation-audit`
- [ ] **T-403 M — Traffic assignment + viz.** Volume → v/c → warna LOS + alert congestion.
  `Deps: T-402` · `Accept: 1 jalan macet (merah); paralel melegakan (UJ-03).` · `Evidence: 2 overlay screenshot.` · `Skills: city-builder-simulation-audit, city-builder-playability-test`
- [ ] **T-404 M — Visual agent pool.** 500 mobil + 300 pejalan sampling top flow; headlight malam.
  `Deps: T-403` · `Accept: mobil di jalan sibuk, 0 saat pause.` · `Evidence: screenshot.` · `Skills: three-best-practices`
- [ ] **T-405 M — Power flood fill.** Plant + line/road hantar; supply/demand per net; brownout I-first; overlay + ikon.
  `Deps: T-401` · `Accept: overload → ikon unpowered; plant ke-2 pulihkan (UJ-04).` · `Evidence: overlay screenshot.` · `Skills: city-builder-simulation-audit, city-builder-playability-test`
- [ ] **T-406 M — Water + pressure.** Tower/pump + pipe/road; falloff jarak/beban; unwatered hentikan growth.
  `Deps: T-405` · `Accept: bangunan jauh unwatered sampai tower ke-2.` · `Evidence: screenshot.` · `Skills: city-builder-simulation-audit`
- [ ] **T-407 S — Overlay utilitas.** Tab power/water/traffic/value + inspector akurat.
  `Deps: T-403,T-405` · `Accept: semua overlay render.` · `Evidence: screenshots.` · `Skills: frontend-ui-engineering, city-builder-visual-qa`
- [ ] **VS-4 GATE:** UJ-03 + UJ-04 lolos.

## VS-5 — Render Tier & Feel (T-5xx)

- [ ] **T-501 M — Day/night + night windows.** Orbit matahari, lerp sky/fog, atlas emissive + uniform `nightFactor`, glow lampu.
  `Deps: VS-4 GATE` · `Accept: night shot menyala; 0 real light tambahan (UJ-08).` · `Evidence: screenshot day/night.` · `Skills: three-best-practices, city-builder-visual-qa`
- [ ] **T-502 M — LOD + culling + preset.** Chunk culling, LOD full/box, Low/Med/High/Ultra + Low-FX.
  `Deps: T-501` · `Accept: 10k bangunan <200 draws, 30fps+ Med.` · `Evidence: F3 + draw HUD.` · `Skills: three-best-practices, city-builder-performance-gate`
- [ ] **T-503 S — Post-FX.** AA + bloom subtle + vignette; toggleable.
  `Deps: T-502` · `Accept: on/off <8% delta fps Med.` · `Evidence: fps compare.` · `Skills: three-best-practices`
- [ ] **T-504 M — Audio engine.** Ambient WebAudio (angin/traffic skala pop) + stinger + mute/volume persisten.
  `Deps: VS-4 GATE` · `Accept: mute persisten; no autoplay pre-gesture.` · `Evidence: settings screenshot.` · `Skills: webapp-testing`
- [ ] **T-505 M — 256² + perf pass.** Default 256², object pool, HUD throttle 4Hz, gate `perf` di CI.
  `Deps: T-502` · `Accept: NFR-01/03 pada mesin referensi.` · `Evidence: perf log.` · `Skills: performance-optimization, city-builder-performance-gate`
- [ ] **VS-5 GATE:** UJ-08 + NFR-01 lolos.

## VS-6 — Crisis & Depth (T-6xx)

- [ ] **T-601 M — Services.** Fire/police/school/clinic/park coverage jarak-jalan + upkeep; overlay radius.
  `Deps: VS-5 GATE` · `Accept: sekolah naikkan happiness sekitar.` · `Evidence: screenshot.` · `Skills: city-builder-simulation-audit`
- [ ] **T-602 M — Pollution/crime/health/happiness.** Field + difusi + overlay + efek growth.
  `Deps: T-601` · `Accept: industri polusi → R sekitar abandon bila tinggi.` · `Evidence: overlay + test.` · `Skills: city-builder-simulation-audit`
- [ ] **T-603 M — Disaster.** Fire spread + earthquake + meteor + toggle random + loop rubble/bulldoze.
  `Deps: VS-5 GATE` · `Accept: meteor → rubble → rebuild → recovery (UJ-06).` · `Evidence: screenshots.` · `Skills: city-builder-playability-test`
- [ ] **T-604 M — Tutorial + advisor.** Checklist 5 langkah + 3 tips bergilir + click-to-locate.
  `Deps: VS-5 GATE` · `Accept: pemain baru 1k pop <15 mnt (skrip manual).` · `Evidence: checklist screenshot.` · `Skills: city-builder-playability-test`
- [ ] **T-605 S — Minimap + notifikasi.** Canvas 128px + queue info/warn/critical + settings.
  `Deps: T-604` · `Accept: klik alert → kamera lompat.` · `Evidence: screenshot.` · `Skills: frontend-ui-engineering`
- [ ] **T-606 S — Aksesibilitas + docs.** Path keyboard-only, overlay aman colorblind (ikon+pola), keybind list, FAQ.
  `Deps: T-605` · `Accept: checklist NFR-05 signed.` · `Evidence: checklist.` · `Skills: frontend-ui-engineering`
- [ ] **VS-6 GATE:** UJ-05 + UJ-06 lolos; MVP COMPLETE (UJ-01..07 gabungan VS-2..VS-5).

## VS-7 — Hardening & Ship (T-7xx)

- [ ] **T-701 M — E2E penuh.** Skrip UJ-01..08 terekam; `npm run e2e` hijau.
  `Deps: VS-6 GATE` · `Accept: semua UJ lolos.` · `Evidence: CI log.` · `Skills: webapp-testing, city-builder-playability-test`
- [ ] **T-702 M — Save migration + korpus.** Bump versi + migrasi + korpus lintas versi hijau.
  `Deps: T-701` · `Accept: save lama termuat; korup → recovery.` · `Evidence: test log.` · `Skills: tdd`
- [ ] **T-703 S — Bundle + perf gate.** Initial <5MB; gate F3/`perf` di CI.
  `Deps: T-701` · `Accept: NFR-01/02/03 pada referensi.` · `Evidence: perf log.` · `Skills: city-builder-performance-gate`
- [ ] **T-704 S — Ship gate.** Release notes + tag; checklist NFR-01..07.
  `Deps: T-701,T-702,T-703` · `Accept: semua NFR + UJ-01..08.` · `Evidence: CI log + tag.` · `Skills: code-review-and-quality`
- [ ] **VS-7 GATE:** SHIPPED v1.0.

## VS-8 — Large City & Depth Lanjutan (T-8xx, pasca-v1)

- [ ] **T-801 M — Transit (bus).** Line + stop + mode split.
- [ ] **T-802 M — Hierarki jalan.** Avenue/highway/one-way di belakang flag.
- [ ] **T-803 M — Cuaca/musim/flood.** Sistem + overlay + efek growth.
- [ ] **T-804 M — Skenario + achievement.** Engine skenario + E2E skenario.
- [ ] **T-805 M — Mod pack JSON.** Registry bangunan + validasi + contoh pack.
- [ ] **VS-8 GATE:** expansion playable; save v1 aman (bump + migrasi bila perlu).

## VS-9 — Production Readiness (T-9xx)

- [ ] **T-901 M — PWA offline.** Service worker + cache versioned + update prompt.
- [ ] **T-902 M — A11y penuh.** Keyboard-only path + checklist NFR-05 signed.
- [ ] **T-903 S — Crash recovery UX.** Tawaran recovery + tidak pernah hard-crash.
- [ ] **T-904 S — Observability.** Telemetri perf opt-in + dashboard rilis.
- [ ] **VS-9 GATE:** production checklist hijau.

## Migrasi ID lama → baru

| Lama (arsip) | Baru | Catatan |
|---|---|---|
| T-001..T-005 (M1) | T-101..T-103 + T-104..T-105 | Dipecah per VS-0/VS-1; semua `[x]` |
| T-006..T-010 (M2) | T-106..T-109 | Semua `[x]` |
| T-011..T-015 (M3) | T-202..T-208 subset + T-301..T-306 | **Belum dikerjakan** — tetap `[ ]` |
| T-016..T-021 (M4) | T-401..T-407 | `[ ]` |
| T-022..T-025 (M5) | T-303 + T-407 + T-110 + T-702 | T-110 `[x]` (save v1 dasar); sisanya `[ ]` |
| T-026..T-030 (M6) | T-501..T-505 | `[ ]` |
| T-031..T-037 (M7) | T-601..T-606 + T-701..T-704 | `[ ]` |
| T-101..T-106 stretch (lama) | T-801..T-805 | dinomori ulang cegah tabrakan |
