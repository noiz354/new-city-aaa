# 08 — Gap Analysis: Spec vs Referensi GitHub

> **Tujuan:** memvalidasi `spec.md` / `plan.md` / `tasks.md` terhadap implementasi nyata di GitHub —
> apa yang bisa di-*reuse* (pola/ide), apa yang belum ada di mana pun (harus dibangun),
> dan risiko apa yang muncul. Bahasa: Indonesia. Tanggal: 2026-09-19.

## 1. Metodologi

1. Cari repo GitHub paling relevan untuk dua sisi: **rendering Three.js** + **algoritma simulasi SimCity klasik**.
2. Petakan setiap domain spec (FR-xxx) ke status: ✅ ada & matang · ⚠️ ada parsial / perlu upgrade · ❌ gap (tidak ada referensi).
3. Hasilkan rekomendasi **Reuse / Adapt / Build** + dampak ke `tasks.md`.

Legenda effort menutup gap: **S** <1 hari · **M** 1–3 hari · **L** 3–6 hari · **XL** >1 minggu.

---

## 2. Referensi yang Di-grounding

| ID | Repo | Relevansi | Bintang/Fork* | Lisensi | Status |
|----|------|-----------|---------------|---------|--------|
| **R-01** | [dgreenheck/simcity-threejs-clone](https://github.com/dgreenheck/simcity-threejs-clone) | Klon SimCity 3D dengan Three.js + Vite: zoning RCI, jalan, kendaraan warga, power plant + power line, road-access check, status bangunan | 274★ / 83 fork | MIT | ⚠️ Stagnan (komit terakhir Jan 2024) |
| **R-02** | [SimHacker/micropolis](https://github.com/johngrimmreaper/micropolis) + [MicropolisCore](https://github.com/deliciosodemente/micropoliscore) | Source code SimCity Classic asli (Will Wright): engine simulasi C/C++ — zoning, traffic, power, budget, disaster, save `.cty`; MicropolisCore = refactor C++ + WASM modern | historis / aktif-arsip | **GPL** ⛔ | Referensi algoritma saja |
| **R-03** | [ijrdn/divercity](https://github.com/ijrdn/divercity) | Fork Micropolis yang mengganti traffic klasik dengan **A\* pathfinding** + load-balancing jalan | kecil | turunan GPL ⛔ | Bukti pendekatan A\* valid |
| **R-04** | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills/blob/main/README.md) | Workflow yang dipakai spec ini: 25 skills + 9 slash commands (`/spec /plan /build /test /review /ship`…), spec-driven-development, anti-rationalization | 40k+★ | MIT | ✅ Aktif & selaras |

\* Angka saat grounding; bisa berubah.

### Ringkasan temuan per referensi

**R-01 — dgreenheck/simcity-threejs-clone** [3](https://github.com/dgreenheck/simcity-threejs-clone)
Repo paling dekat dengan target kita: browser + Three.js + Vite, struktur `src/scripts/` modular,
punya power service (plant + line, plant butuh road access), status bangunan + ikon UI berwarna,
kendaraan yang mengikuti jalan, dan kamera dengan elevation terkunci. Ini **prototipe yang bagus** —
validasi bahwa arsitektur "sim terpisah dari view" bisa jalan — tapi: JavaScript polos (tanpa TS),
**tanpa test, tanpa save/load, tanpa congestion/traffic model**, dan update terakhir 2 tahun lalu
(Three.js API sudah banyak berubah sejak itu). Cocok sebagai **referensi pola, bukan fondasi kode**.

**R-02 — Micropolis / MicropolisCore** [5](https://github.com/johngrimmreaper/micropolis) [3](https://github.com/deliciosodemente/micropoliscore)
Kitab suci algoritma: traffic drive-test R→C/I, power scan rekursif, fund transportasi
`(roads + rails×2)×coeff`, skenario `.cty`. Arsitektur MicropolisCore (engine C++ → WASM +
SvelteKit + tile-renderer Canvas/WebGL2/WebGPU) memvalidasi keputusan kita memisahkan sim dari view
(ADR-01). **Namun lisensinya GPL** — algoritma boleh dipelajari, **kode dilarang disalin** ke proyek ini.
Implementasi kita harus clean-room dalam TypeScript.

**R-03 — divercity** [4](https://github.com/ijrdn/divercity)
Bukti empiris bahwa mengganti traffic klasik Micropolis dengan **A\*** + penalti jalan padat
menghasilkan traffic yang seimbang dan kunjungan bangunan yang memengaruhi growth — persis arah
`docs/04` kita (A\* + BPR + cohorts). Memvalidasi FR-C03/C04. Juga turunan GPL → ide saja.

**R-04 — addyosmani/agent-skills** [5](https://github.com/addyosmani/agent-skills/blob/main/README.md)
Struktur skill (Overview → When to Use → Process → Rationalizations → Red Flags → Verification)
sudah kita ikuti (lihat tabel anti-rationalization di `tasks.md`). Selaras penuh; tidak ada gap workflow,
hanya peluang: adopsi `CONSTRAINTS.md` + skill `browser-testing-with-devtools` saat fase E2E.

---

## 3. Gap Analysis per Domain Spec

### 3.1 Rendering & Kamera (FR-R01..07)

| Req | Target spec | R-01 | R-02 | Status | Aksi |
|-----|-------------|------|------|--------|------|
| FR-R01 scene+lampu+fog+ACES | Standar AAA | ✅ ada dasar | n/a | ⚠️ Parsial | Adapt pola scene; tambah ACES+fog (S) |
| FR-R02 ortho+persp rig | Toggle 2 kamera + damping | ⚠️ 1 kamera, elevation lock | n/a | ⚠️ Parsial | Build rig ganda (M, T-002) |
| FR-R03 highlight/validity | Raycast→bidang + ghost | ✅ hover/select dasar | n/a | ⚠️ Parsial | Upgrade ghost+validity (S, T-004) |
| FR-R04 instancing <200 draws | InstancedMesh per arketipe | ❌ mesh per bangunan (diduga; skala kecil) | n/a | ❌ **Gap besar** | Build instancing+pool (M, T-009) |
| FR-R05 day/night + jendela emissive | Shader nightFactor, 0 real light tambahan | ❌ tidak ada | n/a | ❌ **Gap** | Build shader (M, T-026) |
| FR-R06 LOD + culling | LOD + chunk cull | ❌ tidak ada | n/a | ❌ **Gap** | Build (M, T-027) |
| FR-R07 post-FX + Low-FX | Bloom halus + mode hemat | ❌ tidak ada | n/a | ❌ Gap | Build composer (S, T-028) |

**Kesimpulan:** R-01 membuktikan Three.js cukup; seluruh lapisan *skala & keindahan AAA* adalah gap.

### 3.2 Grid & World (FR-W01..04)

| Req | Target spec | R-01 | R-02 | Status | Aksi |
|-----|-------------|------|------|--------|------|
| FR-W01 grid 256² typed-array + chunk | SoA, 16×16 chunk, dirty flag | ⚠️ grid objek JS kecil | ✅ pola tile klasik | ⚠️ Parsial | Adapt ide tile → tulis SoA TS (M, T-003) |
| FR-W02 terrain seed + preset | Noise + island + River/Bay/Hills | ⚠️ datar/hijau dasar | ⚠️ terrain klasik 2D | ⚠️ Parsial | Build gen + preset (M, T-003) |
| FR-W03 layer per-tile lengkap | 12+ layer (power/water/value/…) | ⚠️ sebagian (zone/road/power) | ✅ konsep tile flags | ⚠️ Parsial | Build layer penuh (M) |
| FR-W04 road graph | Node/edge inkremental | ❌ jalan visual + path kendaraan sederhana | ⚠️ traffic drive-test klasik | ❌ **Gap** | Build graph builder (M, T-016) |

### 3.3 Tools & Interaksi (FR-T01..04)

| Req | Target spec | R-01 | Status | Aksi |
|-----|-------------|------|--------|------|
| FR-T01 toolbar 10 tools | Select/road/RCI/power/plant/water/park/bulldoze | ✅ sebagian besar ada | ⚠️ Parsial | Adapt UX; tambah water/park (S-M, T-006) |
| FR-T02 drag road + zone + cost preview | Ghost + validitas + biaya | ⚠️ place/bulldoze dasar | ⚠️ Parsial | Build drag-preview (M, T-007/008) |
| FR-T03 biaya + dana tak cukup | Blok + indikasi | ⚠️ parsial | ⚠️ Parsial | Build guard ekonomi (S) |
| FR-T04 undo batch | Ctrl+Z batch terakhir | ❌ tidak ada | ❌ Gap | Build batch-undo (S, M5+) |

### 3.4 Sim Core: Clock, RCI, Growth (FR-S01..06)

| Req | Target spec | R-01 | R-02 | Status | Aksi |
|-----|-------------|------|------|--------|------|
| FR-S01 clock fixed-step decoupled | 1 tick=1 jam, 1x/2x/3x, anti-spiral | ⚠️ loop sederhana | ✅ konsep fasa sim | ⚠️ Parsial | Build clock+budget tick (S, T-005) |
| FR-S02 demand RCI −100..100 | Formula unemployment/happy/tax | ⚠️ growth sederhana | ✅ pola demand klasik | ⚠️ Parsial | Build formula+test (M, T-011) |
| FR-S03/S04 spawn/upgrade/abandon L1–3 | Skor + ambang + timer | ⚠️ level/growth dasar | ✅ pola zone develop | ⚠️ Parsial | Build rulebook+test (M, T-012) |
| FR-S05 land value difusi | Blur 3×3 + halo park/air | ❌ tidak ada | ⚠️ land value klasik | ❌ **Gap** | Build difusi+worker (M, T-014) |
| FR-S06 determinisme seed | Hash stabil, snapshot test | ❌ tidak ada | n/a | ❌ **Gap** | Build RNG seed + hash (S, T-011+) |

### 3.5 Warga, Job, Pathfinding, Traffic (FR-C01..06)

| Req | Target spec | R-01 | R-02/R-03 | Status | Aksi |
|-----|-------------|------|-----------|--------|------|
| FR-C01 populasi cohort | Chunk→chunk, cap 2k cohort | ⚠️ residents per bangunan | ✅ statistik klasik | ⚠️ Parsial | Build cohort (M, T-013) |
| FR-C02 gravity job-match | openings/dist² | ❌ sederhana/dekat | ⚠️ drive-test klasik | ❌ **Gap** | Build gravity (M, T-013) |
| FR-C03 A\* + cache + worker | Heap, weight BPR, O-D cache | ❌ path kendaraan sederhana | ✅ **R-03 bukti A\*** | ⚠️ Parsial (ide valid) | Build A\* TS + worker (L, T-017) |
| FR-C04 traffic BPR + LOS | v/c, LOS A–F, overlay | ❌ tidak ada | ⚠️ density klasik | ❌ **Gap besar** | Build assignment+viz (M, T-018) |
| FR-C05 agen visual pool | 500 mobil + 300 pejalan | ✅ kendaraan visual | n/a | ⚠️ Parsial | Adapt→pool instanced (M, T-019) |
| FR-C06 no-path icon | Bangunan terputus berhenti tumbuh | ✅ road-access check | n/a | ✅ Dekat | Adapt pola R-01 (S) |

### 3.6 Utilitas (FR-U01..04)

| Req | Target spec | R-01 | R-02 | Status | Aksi |
|-----|-------------|------|------|--------|------|
| FR-U01 power flood + brownout I-first | Union-find/BFS, supply/demand/net | ✅ power service + line + road-access | ✅ power scan klasik | ⚠️ Parsial | Adapt pola; tambah brownout rule (M, T-020) |
| FR-U02 water + pressure | BFS distance + loadFactor, ambang 0.30 | ❌ tidak ada | ❌ (air modern) | ❌ **Gap** | Build (M, T-021) |
| FR-U03 8 overlay | power/water/traffic/value/… | ⚠️ info panel dasar | n/a | ❌ **Gap** | Build DataTexture overlay (M, T-023) |
| FR-U04 services M7 | Coverage road-distance + capacity | ❌ tidak ada | ⚠️ polisi/api klasik | ❌ Gap | Build M7 (M, T-032) |

### 3.7 Ekonomi (FR-E01..05)

| Req | Target spec | R-01 | R-02 | Status | Aksi |
|-----|-------------|------|------|--------|------|
| FR-E01 treasury + monthly tick | Start $20k, upkeep, bangkrut −$5k | ⚠️ uang sederhana | ✅ budget klasik | ⚠️ Parsial | Build tick+guard (M, T-015) |
| FR-E02 pajak per-zona + happyFactor | Slider 0–20%, spiral guard | ❌/⚠️ minimal | ✅ pola pajak | ⚠️ Parsial | Build (M, T-015/022) |
| FR-E03 tabel biaya upkeep | 12+ item seimbang | ⚠️ biaya dasar | ✅ pola fund | ⚠️ Parsial | Build tabel+balance (S) |
| FR-E04 panel budget + sparkline | Breakdown + funding 50/100/150% | ❌ tidak ada | ⚠️ budget window klasik | ❌ **Gap** | Build panel (M, T-022) |
| FR-E05 strip RCI+pop+jobs | Selalu tampil + klik→advisor | ⚠️ parsial | n/a | ⚠️ Parsial | Build strip (S) |

### 3.8 Persistence (FR-P01..04) — ⛔ Gap total

| Req | Target spec | R-01 | R-02 | Status | Aksi |
|-----|-------------|------|------|--------|------|
| FR-P01 format v1 gzip+hash | Header+layer biner+entitas | ❌ tidak ada | ✅ `.cty` (ide format) | ❌ **Gap total** | Build (M, T-024) |
| FR-P02 migrasi + recovery | Chain migrasi, anti-crash | ❌ | ⚠️ versioning klasik | ❌ **Gap** | Build (S, T-024) |
| FR-P03 share string + PNG | base64 + screenshot | ❌ | n/a | ❌ Gap | Build (S, T-025) |
| FR-P04 <2s/<3s | Budget IO + fixture | ❌ | n/a | ❌ Gap | Ukur (S, T-025) |

Tidak satu pun referensi browser (R-01) punya save/load. Ini **risiko + diferensiasi terbesar**: wajib dibangun dari nol dan diuji hash-roundtrip.

### 3.9 UI/UX (FR-X01..05)

| Req | Target spec | R-01 | Status | Aksi |
|-----|-------------|------|--------|------|
| FR-X01 HUD lengkap | Topbar/toolbar/inspector/bottom | ✅ struktur mirip | ⚠️ Parsial | Adapt layout (S-M) |
| FR-X02 advisor + alert click-to-locate | Rule engine harian | ❌ tidak ada | ❌ Gap | Build rules (M, T-031) |
| FR-X03 tutorial 5 langkah | Checklist + confetti | ❌ tidak ada | ❌ Gap | Build (M, T-031) |
| FR-X04 notifikasi queue | info/warn/critical + history | ⚠️ pesan dasar | ⚠️ Parsial | Build queue (S, T-035) |
| FR-X05 settings | Quality/FX/autosave/audio/keybind | ❌ minimal | ❌ Gap | Build panel (S, T-035) |

### 3.10 Audio & Polish (FR-A01..03)

| Req | Target spec | Referensi | Status | Aksi |
|-----|-------------|-----------|--------|------|
| FR-A01 audio prosedural | WebAudio ambient+sfx+musik gen | ❌ tidak ada di R-01 | ❌ Gap | Build engine (M, T-029) |
| FR-A02 disaster | Api + gempa + meteor | ⚠️ R-02 punya disaster klasik (ide) | ❌ Gap (browser) | Build (M, T-034) |
| FR-A03 disaster-safe pause | Tak pernah saat pause + toggle | ❌ | ❌ Gap | Aturan + test (S) |

### 3.11 NFR: Perf, Test, Kode (NFR-01..07) — ⛔ Gap struktural

| Req | Target spec | R-01 | Status | Aksi |
|-----|-------------|------|--------|------|
| NFR-01 60fps/50ms tick | Budget + F3 overlay + `perf` | ❌ tanpa budget/ukur | ❌ **Gap** | Build harness (S-M, T-005/030) |
| NFR-02/03 bundle + heap | <5MB, <1.5GB | ❌ tak diukur | ❌ Gap | Build report (S, T-037) |
| NFR-07 TS strict + 80% coverage | Vitest sim, PR <300 baris | ❌ JS polos, 0 test | ❌ **Gap struktural** | Fondasi repo (S, T-001) |

Ini alasan utama **tidak fork R-01**: fondasi (TS + test + budget) tidak ada dan sulit di-retrofit. Pola diadaptasi, kode ditulis baru.

---

## 4. Temuan Kunci (Top 10 Gap)

| # | Gap | Dampak jika diabaikan | Rekomendasi | Task |
|---|-----|----------------------|-------------|------|
| G-01 | Save/load tidak ada di referensi browser | Kehilangan kota = kehilangan pemain | Build format v1 + hash test sejak M5, jangan ditunda | T-024/025 |
| G-02 | Tanpa TS + tanpa test (R-01) | Bug sim tak terdeteksi, refactor takut | Tulis baru TS strict + Vitest; jadikan T-001 blocker | T-001 |
| G-03 | Instancing/LOD tidak ada | FPS mati di >2k bangunan | InstancedMesh + pool sejak M2, bukan "optimasi nanti" | T-009/027 |
| G-04 | Traffic congestion (BPR/LOS) tak ada di mana pun (browser) | UJ-03 gagal, kota terasa mati | Build assignment + overlay; R-03 jadi bukti ide | T-018 |
| G-05 | Water + pressure tak ada | Setengah FR-U hilang | Build setelah power matang (pola flood reuse) | T-021 |
| G-06 | Budget panel + funding | Ekonomi tak terbaca (pilar #1) | Build panel + sparkline di M5 | T-022 |
| G-07 | Day/night shader | Kehilangan "beauty shot" (UJ-08) | Shader emissive + sprite, tanpa real light | T-026 |
| G-08 | Determinisme + hash | Tak bisa uji sim, save tak tepercaya | RNG seed + snapshot test dari T-011 | T-011+ |
| G-09 | R-01 stagnan 2 tahun | API Three/Vite kedaluwarsa jika di-copy | Adapt pola, kunci versi baru di `plan.md` | T-001 |
| G-10 | Risiko lisensi GPL (R-02/R-03) | Kontaminasi lisensi proyek | Clean-room: pelajari, jangan salin; catat di ADR | T-038 (baru) |

---

## 5. Matriks Reuse / Adapt / Build

**Reuse langsung (MIT/aman):**
- Pola struktur Vite + Three + modul sim terpisah (R-01) → `plan.md` §2 ✅ sudah tercermin.
- Workflow agent-skills R-04 (perintah, anatomi skill, anti-rationalization) ✅ sudah tercermin; tambah `CONSTRAINTS.md` saat implementasi.

**Adapt (ambil ide, tulis ulang):**
- Power service + road-access check + status bangunan (R-01) → T-020.
- Kendaraan visual mengikuti jalan (R-01) → T-019 (upgrade ke pool instanced).
- Demand/zone-develop/budget/disaster klasik (R-02) → T-011/012/015/034 (clean-room!).
- A\* + penalti kemacetan (R-03) → T-017/018 (tulis ulang TS + BPR formal).
- Layout HUD + info panel (R-01) → T-006/023.

**Build dari nol (tidak ada referensi memadai):**
- Instancing + LOD + culling, day/night shader, post-FX (G-03, G-07).
- Typed-array grid + road graph inkremental + worker.
- Gravity job-match, BPR/LOS, cohort (G-04).
- Water pressure, overlay DataTexture ×8, services coverage (G-05).
- Save format + migrasi + share string (G-01).
- Budget panel + funding + sparkline (G-06).
- Tutorial + advisor + audio prosedural + disaster browser.
- Harness perf + coverage + determinisme (G-02, G-08).

---

## 6. Dampak ke tasks.md (usulan task baru)

| Task baru | Alasan grounding | Ukuran | Sisip setelah |
|-----------|------------------|--------|---------------|
| **T-038 S — ADR lisensi & clean-room** | Mitigasi G-10: dokumen "GPL dipelajari, tak disalin" + checklist PR | S | T-001 |
| **T-039 S — Spike: bedah power service R-01** | Catat pola adaptasi sebelum T-020 (timebox 1 jam, tanpa copy kode) | S | T-019 |
| **T-040 S — CONSTRAINTS.md ala agent-skills** | Kunci budget (draws/fps/coverage) sebagai gate otomatis | S | T-005 |
| **T-041 S — Verifikasi API Three terbaru** | Mitigasi G-09: kunci versi + catat breaking change vs era R-01 | S | T-001 |

Urutan milestone tidak berubah (M1→M7 tetap valid); hanya fondasi (T-001+T-038+T-041) diperketat.

---

## 7. Risiko & Mitigasi (tambahan dari grounding)

| Risiko | Sumber | Mitigasi |
|--------|--------|----------|
| Godaan fork/copy R-01 lalu macet (JS, 0 test, API lama) | R-01 stagnan | Putuskan tegas: **referensi pola, bukan fork** (ADR) |
| Kontaminasi GPL dari Micropolis/divercity | R-02/R-03 | Clean-room + review lisensi di T-038; hanya formula/ide |
| Underestimate save/load & traffic (tak ada contoh browser) | G-01/G-04 | Naikkan ke L dan beri fixture + hash test sejak awal |
| Three.js breaking changes vs tutorial 2023–2024 | R-01 umur | T-041 kunci versi + smoke test kamera/instancing |

---

## 8. Keputusan yang Butuh Persetujuanmu

1. **Setuju "tidak fork R-01"** (adapt pola, tulis baru TS)? — Rekomendasi: ya.
2. **Setuju aturan clean-room GPL** (T-038)? — Rekomendasi: ya, non-negotiable.
3. Tambahkan **T-038…T-041** ke `tasks.md`? — Rekomendasi: ya.
4. Prioritas jika waktu mepet: **potong disaster (T-034) atau transit-stretch?** — Rekomendasi: potong stretch dulu, disaster inti (api saja) tetap.

---

## 9. Cara Verifikasi Ulang (repro)

```bash
# Referensi utama (pola) — MIT, aman dibaca
git clone https://github.com/dgreenheck/simcity-threejs-clone
# Referensi algoritma — GPL, BACA SAJA, jangan copy ke repo ini
git clone https://github.com/SimHacker/micropolis
git clone https://github.com/ijrdn/divercity
git clone https://github.com/addyosmani/agent-skills
```

## 10. Kesimpulan

Grounding GitHub **memvalidasi arsitektur spec** (sim/view split, A\* traffic, power flood) lewat tiga
bukti independen (R-01/R-02/R-03) dan **memvalidasi workflow** lewat R-04. Namun grounding juga
membuktikan **tidak ada fondasi yang bisa dipakai langsung**: semua yang membuat game ini "AAA"
(instancing, congestion, water, save/load, budget UI, day/night, test) adalah gap yang harus dibangun.
Keputusan terbesar: adaptasi pola R-01 + clean-room algoritma klasik + fondasi TS/test baru — dengan
tambahan 4 task pengaman (T-038…T-041).

---
*Lampiran Addy workflow: Define ✓ (spec ini) → Plan (tasks.md + §6) → Build (menunggu persetujuan §8).*
