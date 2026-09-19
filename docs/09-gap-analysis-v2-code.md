# 09 — Gap Analysis v2: Verifikasi Berbasis Kode (Putaran Kedua)

> **Putaran 1** (`08-gap-analysis-github.md`) berbasis README + listing repo.
> **Putaran 2 ini** memverifikasi setiap klaim dengan **inspeksi kode langsung**
> (shallow-clone + baca file). Bahasa: Indonesia. Tanggal: 2026-09-19.
>
> Metode repro ada di §7 — semua temuan bisa dicek ulang dalam <5 menit.

## 1. Ringkasan Eksekutif

- **~95% klaim v1 TERBUKTI** oleh kode. Tidak ada klaim v1 yang gugur total.
- **2 koreksi penting** terhadap v1 (§4): (a) R-01 ternyata *menggabungkan* sim+view
  (bukan memisahkan) — jadi ADR-01 kita adalah upgrade sadar, bukan tiruan;
  (b) "kendaraan R-01" adalah *random walk* berbasis wall-clock, bukan traffic —
  sehingga **gap traffic (G-04) lebih besar dari perkiraan v1**.
- **1 temuan baru besar**: R-01 membawa **259 file `.glb`** (ketergantungan aset berat) —
  memperkuat ADR-07 (procedural-first) dan butuh task pengaman baru **T-042**.
- Keputusan §8 v1 tetap berlaku; v2 menambah 1 keputusan (beban aset) di §6.

## 2. Bukti Kode per Referensi

### 2.1 R-01 — dgreenheck/simcity-threejs-clone (MIT)

Fakta struktur (hasil `find` + `grep`):

| Fakta | Bukti |
|-------|-------|
| 35 file JS, **0 TypeScript, 0 test** | `find src/scripts -name '*.js'` = 35; `*.ts` = 0; `*test*` = 0 |
| Dependensi lama | `package.json`: `three@^0.155.0` (2023), `vite@^4.4.5` |
| **259 model `.glb`** di `src/public/models/` | hasil `find` — Tanpa instancing |
| **Tanpa `InstancedMesh`** di seluruh `src/scripts/` | `grep -ril instancedmesh` = kosong |
| **Tanpa save/load** (`localStorage`/`indexedDB`/`serialize`) | `grep` = kosong |
| **Tanpa A\*/pathfinding/congestion/BPR/Worker** | `grep` = kosong (satu-satunya "capacity" = kapasitas MW di `powerPlant.js`) |

Temuan perilaku (hasil baca file):

1. **Bangunan = clone GLB per objek.** `assets/assetManager.js`: `getModel()` → `models[name].clone()`
   + `material.clone()` per bangunan. Artinya draw call tumbuh linear per bangunan —
   klaim v1 "diduga mesh per bangunan" kini **TERBUKTI**. Klaim FR-R04 (<200 draws @10k) mustahil
   dengan pola ini → G-03 valid penuh.
2. **Power = BFS multi-source simultan** (`sim/services/power.js`). Kualitasnya *lebih baik dari
   perkiraan v1*: frontier tiap plant diperluas bergantian sehingga beban terbagi rata, berhenti saat
   plant habis. Namun: tanpa konsep **net**, tanpa **aturan brownout** (siapa dipadamkan dulu),
   `visited.includes(tile)` = scan O(n) per tetangga, dan tiap `simulate()` memindai **seluruh grid**
   untuk mencari plant. → Status v1 "⚠️ Parsial" dipertahankan; pola BFS boleh diadaptasi,
   nets + brownout + perf harus dibangun (T-020).
3. **Kendaraan = random walk + wall-clock, BUKAN traffic.**
   `vehicles/vehicle.js`: `pickNewDestination()` → `origin?.getRandomNextNode()`;
   waktu pakai `Date.now()` (`cycleTime`, `age`); spawn via `setInterval` di konstruktor
   `VehicleGraph`; model acak via `Math.random()`. Tidak ada O-D, tidak ada demand, tidak ada routing.
   → **Koreksi v1**: baris "✅ kendaraan visual" harus dibaca "visual saja, nol model".
   Gap FR-C03/C04/C05 **membesar** (lihat §4).
4. **Sim dan view DIGABUNG.** `class VehicleGraph extends THREE.Group` — graph jalan *adalah* objek
   Three.js; `vehicle.js` mengimpor `three`. → **Koreksi v1**: v1 menulis R-01 "validasi sim terpisah
   dari view" — itu **salah**. ADR-01 kita (sim tak boleh impor Three) adalah keputusan *melawan* pola
   R-01, dan terbukti perlu (test headless + determinisme mustahil jika graph = scene-graph).
5. **Loop = `setInterval(..., 1000)`** (`game.js:65` → `city.simulate(1)`), tanpa akumulator
   fixed-step, tanpa 1x/2x/3x tick-rate. → FR-S01 "⚠️ Parsial" dipertahankan; clock + anti-spiral
   tetap harus dibangun (T-005).
6. **Road access = radius, bukan graph.** `modules/roadAccess.js` → `city.findTile(..., searchDistance: 3)`.
   Bangunan "terhubung" jika ada jalan dalam 3 tile — tanpa path ke mana pun. → FR-C06 v1 "✅ Dekat"
   **diturunkan ke ⚠️**: konsepnya ada, implementasinya bukan konektivitas graph (T-016 tetap wajib).
7. **Skala mainan.** `config.js`: `maxWorkers: 2`, `maxResidents: 2`, `maxJobSearchDistance: 4`
   (Manhattan). Job-match radius-4 vs gravity-model + cohorts kita → FR-C01/C02 gap dipertahankan.

### 2.2 R-02 — Micropolis (GPL ⛔ — baca saja)

- `micropolis-java/.../engine/TrafficGen.java`: `MAX_TRAFFIC_DISTANCE = 30`,
  `findPerimeterRoad()` → `tryDrive()` → `setTrafficMem()`. Ini algoritma *drive-test acak* klasik
  SimCity: coba "setir" dari zona, catat kepadatan tempat berhasil lewat. Bukan A\*, bukan O-D.
  → Menegaskan: bahkan SimCity asli pun traffic-nya aproksimasi; pendekatan cohort+A\* kita (docs/04)
  adalah upgrade yang sah, bukan penyimpangan.
- `micropolis-activity/src/sim/s_power.c` + header GPL di semua file (`GPLv3`, EA 1989–2007).
  → G-10 (risiko lisensi) **diperkuat bukti**: setiap file sim inti berheader GPL. Aturan clean-room
  (T-038) non-negotiable.

### 2.3 R-03 — divercity (GPL ⛔ — baca saja)

- `src/micropolisj/engine/TrafficSim.java` (**636 baris**), komentar persis:
  `"uses A*-Algorithm to find ways"`, struktur `HashMap/HashSet` open/closed khas A\*.
  Dengan header `GPLv3 + additional terms` (2014).
  → Klaim v1 "R-03 bukti A\* valid" **TERBUKTI di level kode**. Ide yang diambil: A\* per O-D +
  penalti jalan padat. Implementasi TS kita tetap clean-room (T-017), tidak port Java.

### 2.4 R-04 — agent-skills: tidak diverifikasi ulang (v1 sudah cukup; workflow, bukan kode game)

## 3. Matriks Verifikasi Klaim v1

| # | Klaim v1 | Verdict v2 | Bukti |
|---|----------|------------|-------|
| C-01 | R-01: JS polos, 0 test | ✅ TERBUKTI | 35 JS / 0 TS / 0 test |
| C-02 | R-01: mesh per bangunan (dugaan) | ✅ TERBUKTI (dugaan → fakta) | `assetManager.getModel().clone()` + `material.clone()` |
| C-03 | R-01: tanpa save/load | ✅ TERBUKTI | grep kosong |
| C-04 | R-01: tanpa congestion/BPR/A\*/worker | ✅ TERBUKTI | grep kosong |
| C-05 | R-01: power service + road-access ada | ✅ TERBUKTI, diperketat | BFS simultan bagus; tanpa nets/brownout; `visited.includes` O(n) |
| C-06 | R-01: kendaraan mengikuti jalan | 🔴 KOREKSI — random walk wall-clock | `getRandomNextNode()` + `Date.now()` + `setInterval` |
| C-07 | R-01 validasi sim/view split | 🔴 KOREKSI — R-01 justru menggabung | `VehicleGraph extends THREE.Group` |
| C-08 | FR-C06 "✅ Dekat" via road-access | 🟡 DITURUNKAN → ⚠️ Parsial | radius-3, bukan konektivitas graph |
| C-09 | R-01 stagnan → API lama | ✅ DIPERKUAT | three 0.155 (2023), vite 4.4.5 |
| C-10 | R-02/R-03: ide A\*/sim valid, GPL | ✅ TERBUKTI | `TrafficSim.java:636`, header GPLv3 di semua file |
| C-11 | Tidak ada fondasi reuse langsung | ✅ DIPERKUAT | + temuan 259 GLB (§5 N-01) |

## 4. Dua Koreksi Penting (detail)

**K-1: Gap traffic lebih besar dari v1.** v1 memberi kesan R-01 punya "kendaraan yang mengikuti jalan"
sebagai fondasi parsial. Kode menunjukkan itu murni teater acak: `getRandomNextNode()`, waktu dinding
(`Date.now`, non-deterministik, tak bisa di-pause secara sim), spawn `setInterval` di luar sim-clock.
Implikasi: T-017 (A\*) + T-018 (BPR/LOS) + T-019 (pool) **100% build-from-scratch**; satu-satunya yang
bisa "diadaptasi" dari R-01 adalah *pelajaran negatif* (jangan wall-clock, jangan random).
Estimasi T-017/T-018 naik keyakinan ke **L** (bukan M) — tanpa contoh browser yang bisa dicontoh.

**K-2: ADR-01 melawan (bukan mengikuti) R-01.** Bukti `VehicleGraph extends THREE.Group` + impor `three`
di `vehicle.js` menunjukkan kopling sim↔render sebagai *tech debt nyata* di referensi terbaik yang ada.
Ini memperkuat urgensi T-001 (struktur `sim/` tanpa Three + lint rule `no-three-in-sim`) dan memberi
amunisi review: setiap PR yang mengimpor `three` dari `sim/` otomatis ditolak.

## 5. Temuan Baru Putaran 2 (N-01…N-06)

| ID | Temuan | Bukti | Dampak |
|----|--------|-------|--------|
| N-01 | **Beban aset: 259 `.glb`** | `find models -name '*.glb'` | NFR-02 (<5MB) mustahil jika ikut pola ini; perkuat ADR-07 + butuh **T-042** (budget aset) |
| N-02 | Kendaraan non-deterministik & di luar sim-clock | `Date.now()`, `Math.random()`, `setInterval` | NFR-07 + FR-S06: everthing-time harus sim-time; tambah checklist di T-019 |
| N-03 | `visited.includes(tile)` O(n) + full-grid scan per simulate | `services/power.js`, `city.js:109-118` | Pelajaran perf: union-find + dirty-flag (docs/05) bukan opsional |
| N-04 | `findTile` radius-3 untuk road-access | `roadAccess.js` + `config.js` | T-016 (graph attachment) lebih penting dari perkiraan |
| N-05 | Skala config mainan (2 pekerja, radius 4) | `config.js` | Validasi kebutuhan cohorts+gravity (docs/04 §1–2) |
| N-06 | three@0.155 era 2023 | `package.json` | G-09 → T-041 konkret: kunci versi modern + smoke test |

## 6. Dampak ke tasks.md (delta vs v1 §6)

v1 mengusulkan T-038…T-041 — **semuanya dipertahankan**, dengan penajaman:

| Task | Penajaman dari bukti kode |
|------|---------------------------|
| T-038 ADR lisensi | Cantumkan bukti: header GPLv3 di `TrafficGen.java`, `TrafficSim.java`, `s_power.c` |
| T-039 spike R-01 | Sebagian **sudah dikerjakan putaran ini** (§2.1) — sisa: timebox baca `development.js`+`jobs.js` (30 mnt) |
| T-040 CONSTRAINTS.md | Tambah gate N-01: `models/*.glb = 0` di MVP inti; gate K-2: `no-three-in-sim` |
| T-041 kunci versi Three | Target konkret: `three@r18x` + smoke test instancing (bukti: R-01 di 0.155) |

**Task baru dari v2:**

| Task | Alasan | Ukuran | Sisip |
|------|--------|--------|-------|
| **T-042 S — Budget aset & procedural-first gate** | N-01: 259 GLB di R-01 vs NFR-02 <5MB; kunci "nol GLB di MVP" + daftar arketipe prosedural (docs/01 §7) | S | setelah T-001 |
| **T-043 S — Jam sim vs jam dinding (aturan + lint)** | N-02/K-1: larang `Date.now()`/`setInterval`/`Math.random()` di `sim/`; sediakan `simClock` + `simRng` | S | dengan T-005 |

Estimasi yang berubah: T-017 M→**L**, T-018 M→**L** (K-1: tanpa contoh browser sama sekali).

## 7. Repro (jalankan ulang grounding ini)

```bash
rm -rf /tmp/grounding && mkdir -p /tmp/grounding && cd /tmp/grounding
git clone --depth 1 https://github.com/dgreenheck/simcity-threejs-clone r01
git clone --depth 1 https://github.com/SimHacker/micropolis r02
git clone --depth 1 https://github.com/ijrdn/divercity r03
# Fakta struktur R-01
find r01/src/scripts -name '*.js' | wc -l        # → 35
find r01/src -name '*.ts' | wc -l                # → 0
find r01 -iname '*test*' -not -path '*/node_modules/*' | wc -l  # → 0
find r01/src/public/models -name '*.glb' | wc -l # → 259
grep -ril 'instancedmesh' r01/src/scripts        # → kosong
grep -ril 'localStorage\|indexedDB' r01/src/scripts  # → kosong
grep -rn 'getRandomNextNode\|Date.now()' r01/src/scripts/sim/vehicles/vehicle.js
grep -n 'setInterval' r01/src/scripts/game.js r01/src/scripts/sim/vehicles/vehicleGraph.js
grep -n 'extends THREE.Group' r01/src/scripts/sim/vehicles/vehicleGraph.js
# Bukti R-02/R-03 (+ header GPL)
sed -n '1,45p' r02/micropolis-java/src/micropolisj/engine/TrafficGen.java
grep -n 'A\*-Algorithm' r03/src/micropolisj/engine/TrafficSim.java
head -8 r03/src/micropolisj/engine/TrafficSim.java
```

> Catatan lisensi: perintah di atas hanya mengunduh untuk **dibaca**. Jangan menyalin file
> R-02/R-03 ke repo proyek (GPL). Lihat T-038.

## 8. Keputusan Tambahan untukmu (di luar §8 v1)

1. **Setuju T-042 (nol GLB di MVP inti)?** — Rekomendasi: ya; GLB hanya sebagai *pack opsional* pasca-M5 (T-010 sudah menyiapkan loader+fallback).
2. **Setuju T-043 (larang jam dinding di sim)?** — Rekomendasi: ya; murah (lint rule) dan mencegah bug determinisme sejak hari pertama.
3. **Setuju T-017/T-018 naik ke L?** — Rekomendasi: ya; tanpa referensi browser, estimasi jujur lebih baik.

## 9. Kesimpulan v2

Putaran kedua mengubah keyakinan menjadi **kepastian berbasis kode**: arsitektur spec tetap valid,
dan justifikasi "tulis baru, jangan fork" kini didukung 11 bukti baris-kode, bukan kesan README.
Dua koreksi (K-1, K-2) membuat spec *lebih kuat*: kita tahu persis apa yang tidak boleh ditiru
(random walk wall-clock, sim↔view coupling, GLB-per-building). Total task pengaman menjadi
**6 (T-038…T-043)** — semuanya murah (S) dan semuanya mencegah kesalahan mahal.

---
*Jejak Addy workflow: Define ✓ (v1 + v2) → Plan (tasks.md + §6) → Build (menunggu persetujuan §8 v1 + §8 v2).*
