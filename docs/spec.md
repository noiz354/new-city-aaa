# SPEC — city-builder-aaa (kanonis)

> **Status:** canonical. File ini adalah spesifikasi otoritatif.
> `spec.md` (root, lama) hanyalah shim pointer ke sini.
> Workflow: Addy-style spec → plan → tasks → code. Tidak ada kode tanpa task `[ ]→[x]` yang terverifikasi.
> Terkait: `../roadmap.md` (VS-0..VS-9) · `../tasks.md` (T-1xx..T-9xx) ·
> `05-execution/definition-of-done.md` · `05-execution/dependency-graph.md` ·
> `06-agent-skills/skill-task-mapping.md` · `02-architecture/*` · `03-game-design/*` · `04-performance/*`.

## 1. Objective / Vision

Bangun **city-builder 3D di browser, terinspirasi SimCity**, yang berjalan **60fps di laptop mid-range**,
mendukung kota **10.000+ bangunan / 100.000+ warga (simulasi statistik)**, dengan game-feel AAA:
rendering siang/malam yang indah, traffic yang hidup, ekonomi yang bermakna, bencana, dan skenario —
**tanpa install**.

**One-liner:** *SimCity dalam tab: zone, build, power, commute, tax, grow — lalu selamat dari meteor.*

### Design Pillars

1. **Readable at a glance** — masalah kota (listrik, macet, uang) terlihat <3 detik via overlay warna + advisor.
2. **Simulation you can trust** — setiap angka (populasi, jobs, $) tertelusur ke aturan di `03-game-design/`–`05-execution/`.
3. **Build fast, fix faster** — drag road, paint zone, bulldoze; semua reversible, semua 60fps.
4. **Beauty is a feature** — jendela malam, headlight traffic, kilau air menjual fantasi.
5. **Never lose a city** — autosave + versioned saves + crash recovery.

> Catatan kehati-hatian kata "AAA": klaim setara skala komersial dilarang; yang dimaksud adalah
> kualitas feel dalam batas browser (visual, feedback, robustness) — bukan budget/studio sebanding.

## 2. Audience & Platform

- **Pemain:** casual builder (sesi 30 mnt) + optimizer (kota 10 jam). Usia 10+. Tanpa pengetahuan gamedev.
- **Platform:** browser desktop modern (Chrome/Edge/Firefox/Safari). Target 1080p, mouse + keyboard. Touch = stretch.
- **Offline:** dapat dimainkan offline setelah load pertama (PWA = stretch goal, VS-9).

## 3. Sistem yang dibangun (11 sistem, ringkas)

Setiap sistem di bawah dijabarkan penuh di `03-game-design/` + `02-architecture/`; di sini hanya kontrak perilaku.

### 3.1 Dunia & grid

- Grid matrix min 128×128, target 256×256 tile; 1 tile = 8m. Chunk 16×16 untuk culling/serialisasi.
- Terrain: heightmap seeded (flat + bukit landai v1), water table, pohon, dekorasi fertile/ore.
- Per-tile: terrain, zone (R/C/I/none), buildingId, road (type/dir), power (net, powered),
  water (pressure), landValue, pollution, desirability cache.
- Road graph diturunkan dari road tile; intersection didukung; bridge/tunnel = stretch.

### 3.2 Jalan & zoning (tools)

- Toolbar: Select/Inspect, Road, Residential, Commercial, Industrial, Power Line, Power Plant,
  Water Tower/Pipe, Park, Bulldoze.
- Drag-line road dengan preview biaya + validitas; paint/drag zone; marquee bulldoze.
- Setiap placement menampilkan biaya; dana kurang → blokir + treasury shake.
- Right-click/Esc batal; Ctrl+Z undo batch terakhir (stretch: full history).

### 3.3 Simulasi inti

- Clock: fixed timestep, 1 tick = 1 game-hour, 24 tick = 1 hari. Speed pause/1x/2x/3x, decoupled dari render FPS.
- Urutan update per tick (frozen interface, lih. `dependency-graph.md`):
  `utilities → jobs/agents → traffic → growth → economy(monthly) → fields diffusion (worker)`.
- **Sim tidak boleh import Three.js.** View adalah proyeksi murni state sim (`renderSnapshot`).
- Deterministik: seeded RNG di semua tempat; tidak ada `Date.now` di sim.

### 3.4 Bangunan & pertumbuhan (RCI)

- Model demand RCI −100..+100 per zona dari unemployment, happiness, land value, pajak.
- Tiap hari: N tile zonasi skor tertinggi spawn/upgrade bila powered + watered + road-connected + funded;
  skor rendah → abandon → rubble.
- Level bangunan 1–3 (density); upgrade menaikkan pop/jobs, upkeep, pajak.
- Land value diffusion: base (air/view/park) − pollution/crime + wealth halo, dihaluskan ke tetangga.
- Abandon bila unpowered 30 hari ATAU happiness < 25 selama 20 hari ATAU pajak > 15% selama 30 hari.

### 3.5 Warga, jobs, traffic

- Warga statistik (cohort per homeChunk → workChunk, cap ~2k cohort) + visual agent sampling
  (~500 mobil + ~300 pejalan dari flow teratas, bukan 1:1 populasi).
- Job matching gravity model (jobs filled ∝ openings × residents / distance²).
- Commute pathfinding A* pada road graph dengan bobot congestion; recompute saat graph berubah,
  cache per pasangan O-D.
- Traffic: volume/capacity per segmen → LOS A–F + pengali waktu BPR; overlay hijau→merah.
- Bangunan tanpa path menampilkan ikon "No road connection", pertumbuhan berhenti.

### 3.6 Utilitas (power & water)

- Power: plant memproduksi MW; bangunan mengonsumsi; line + road menghantar; flood-fill komponen terhubung.
  Overload → brownout: shed Industrial terjauh-dari-plant lebih dulu, lalu C, lalu R (OQ-02 resolved).
- Water: tower/pump memproduksi kL; pipe/road menghantar; pressure turun dengan jarak/beban;
  unwatered menghentikan growth.
- Overlay: power, water, traffic, land value, pollution, crime, happiness, coverage.

### 3.7 Ekonomi

- Treasury: mulai $20.000; tick bulanan (tiap 30 hari) memungut pajak, memotong upkeep;
  negatif → peringatan bankrupt → forced cuts.
- Pajak: slider per zona 0–20% (default 9%); income = Σ bangunan(level, zona) × rate × happiness factor.
- Biaya: per-tile road/zone/utility + upkeep bulanan per bangunan/service.
- Budget panel: breakdown income/expense, sparkline 12 bulan, slider funding per service (50/100/150%).
- RCI bar + populasi + jobs + unemployment selalu terlihat.

### 3.8 Layanan & lingkungan (VS-6)

- Services (urutan stretch): fire, police, school, clinic, park — coverage radius jarak-jalan,
  memengaruhi happiness/growth; ada upkeep.
- Pollution (air/noise/ground), crime, health, happiness: field + diffusion + overlay + efek growth.

### 3.9 Bencana & progresi (VS-6)

- Minimal: fire spread + earthquake + meteor di v1; trigger eksplisit + toggle random.
- Disaster tidak pernah fire saat pause. Alur: rubble → bulldoze + rebuild → recovery event tercatat.
- Skenario + tutorial + advisor + achievement (VS-6/7).

### 3.10 Render & kamera

- Three.js scene, dynamic sun + hemisphere, fog, ACES tone mapping.
- Toggle Orthographic (gaya SimCity) + Perspective; pan/rotate/zoom dengan damping; WASD + screen-edge.
- Hover highlight + validitas hijau/merah + ghost preview drag.
- Instancing: ≤200 draw call @ 10k bangunan (kelas M-series/GTX1660).
- Day/night: emissive night windows + glow lampu/jalan (shader trick, tanpa real light per lampu).
- LOD: mesh penuh dekat, billboard/box jauh; frustum + chunk culling.
- Post: antialias + bloom subtle/vignette; mode Low-FX mematikan post.

### 3.11 UI/UX, audio, persistence

- HUD: top bar ($, pop, date, speed), toolbar kiri, inspector kanan, bawah RCI + minimap + alert.
- Advisor: 3 tips bergilir bila masalah >30 hari. Tutorial checklist 5 langkah. Notifikasi info/warn/critical + click-to-locate.
- Settings: quality (Low/Med/High/Ultra), FX toggle, interval autosave, daftar keybind.
- Audio: ambient prosedural (angin/traffic hum skala populasi), UI clicks, build/error stinger, disaster boom; mute/volume.
- Save: header JSON (version, seed, date, mods) + binary tile layers + entity list; gzip; slot IndexedDB (3) + autosave.
  Load: cek versi + migrasi; save korup → pesan recovery, tidak pernah hard-crash.
- Export share string (base64) kota kecil; tombol screenshot PNG.

## 4. Interaction chains (wajib lolos E2E)

Setiap rantai di bawah adalah kontrak perilaku sim — bukan flavor text.

1. **Residential growth:** road connect + power + water + zone R → skor desirability naik → spawn dalam ~10 hari → populasi > 0 → RCI bar merespons.
2. **Live/work balance:** zone R + C + I terhubung → demand bergerak → shop/factory spawn → unemployment < 20%.
3. **Rush hour:** 2.000+ commuter → mobil terlihat di jalan → segmen congested merah → tambah jalan paralel/upgrade → congestion reda.
4. **Brownout:** demand > capacity → warning → bangunan unpowered berhenti tumbuh + ikon → bangun plant ke-2 → recovery.
5. **Budget crisis:** pajak 15% → income naik, happiness turun, abandonment mulai → turunkan 9% + potong funding → stabil.
6. **Disaster:** trigger quake/meteor → rubble + api + pop turun → bulldoze + rebuild → recovery event tercatat.
7. **Save/share:** save kota 50k pop (<2s), reload, load (<3s), state identik (hash match).
8. **Beauty shot:** orbit malam, zoom street-level, lighting + window glow + headlight layak screenshot.

## 5. Functional Requirements (ID stabil — dirujuk plan/tasks/komentar kode)

### Rendering & kamera (FR-R)

- **FR-R01:** Three.js scene, dynamic sun + hemisphere, fog, ACES tone mapping.
- **FR-R02:** Toggle Ortho + Perspective; pan/rotate/zoom dengan damping, screen-edge + WASD.
- **FR-R03:** Hover highlight + validitas hijau/merah + ghost preview drag.
- **FR-R04:** Instanced rendering: ≤200 draw call @ 10k bangunan (M-series/GTX1660).
- **FR-R05:** Day/night dengan emissive night windows + glow (tanpa real light per lampu).
- **FR-R06:** LOD + frustum + chunk culling.
- **FR-R07:** Post AA + bloom subtle/vignette; mode Low-FX mematikan post.

### Grid & world (FR-W)

- **FR-W01:** Grid min 128×128, target 256×256; tile 8m; chunk 16×16.
- **FR-W02:** Terrain heightmap seeded + water + pohon + dekorasi fertile/ore.
- **FR-W03:** Field per-tile: terrain, zone, buildingId, road, power, water, landValue, pollution, desirability.
- **FR-W04:** Road graph dari road tile; intersection; bridge/tunnel = stretch.

### Tools & interaksi (FR-T)

- **FR-T01:** Toolbar lengkap (Select/Inspect, Road, R/C/I, Power Line/Plant, Water, Park, Bulldoze).
- **FR-T02:** Drag road + cost preview + validitas; paint zone; marquee bulldoze.
- **FR-T03:** Semua placement tampilkan biaya; dana kurang → blokir.
- **FR-T04:** Right-click/Esc batal; Ctrl+Z undo batch terakhir (stretch: full history).

### Simulasi inti (FR-S)

- **FR-S01:** Clock fixed-step (1 tick = 1 game-hour), pause/1x/2x/3x, decoupled dari FPS.
- **FR-S02:** Demand RCI −100..+100 dari unemployment, happiness, land value, pajak.
- **FR-S03:** Growth harian: spawn/upgrade/abandon berbasis skor + serviced.
- **FR-S04:** Level bangunan 1–3.
- **FR-S05:** Land value diffusion.
- **FR-S06:** Deterministik seed; input sama → output sama.

### Warga, jobs, traffic (FR-C)

- **FR-C01:** Populasi: tinggal di R, kerja di C/I; employment + happiness.
- **FR-C02:** Job matching gravity model.
- **FR-C03:** A* road graph + bobot congestion; cache per O-D.
- **FR-C04:** Traffic v/c → LOS A–F + BPR; overlay hijau→merah.
- **FR-C05:** Visual agent pool (~500 mobil + ~300 pejalan, sampling).
- **FR-C06:** Ikon "No road connection", growth berhenti.

### Utilitas (FR-U)

- **FR-U01:** Power MW + flood fill; overload → brownout (I terjauh dulu).
- **FR-U02:** Water kL + pressure falloff; unwatered hentikan growth.
- **FR-U03:** Overlay power/water/traffic/value/pollution/crime/happiness/coverage.
- **FR-U04:** Services (fire/police/school/clinic/park) coverage jarak-jalan.

### Ekonomi (FR-E)

- **FR-E01:** Treasury mulai $20.000; monthly tick; bankrupt warning + forced cuts.
- **FR-E02:** Slider pajak per zona 0–20% (default 9%).
- **FR-E03:** Biaya per-tile + upkeep bulanan.
- **FR-E04:** Budget panel + sparkline 12 bulan + slider funding service.
- **FR-E05:** RCI + populasi + jobs + unemployment selalu terlihat.

### Persistence (FR-P)

- **FR-P01:** Save header + binary layers + entities; gzip; slot IndexedDB 3 + autosave.
- **FR-P02:** Load cek versi + migrasi; recovery pesan, tidak hard-crash.
- **FR-P03:** Export share string + screenshot PNG.
- **FR-P04:** Save <2s / load <3s @ 256×256 + 10k bangunan.

### UI/UX (FR-X)

- **FR-X01:** HUD lengkap (topbar/toolbar/inspector/RCI/minimap/alert).
- **FR-X02:** Advisor 3 tips bergilir (>30 hari masalah).
- **FR-X03:** Tutorial checklist 5 langkah.
- **FR-X04:** Notifikasi queue + click-to-locate.
- **FR-X05:** Settings quality/FX/autosave/keybind.

### Audio & polish (FR-A)

- **FR-A01:** Ambient prosedural + UI/build/error/disaster stinger + mute.
- **FR-A02:** Disaster toggleable; minimal Fire + Earthquake + Meteor di v1.
- **FR-A03:** Pause-safe: disaster tidak fire saat pause.

## 6. Non-Functional Requirements

- **NFR-01 Perf:** 60fps @ 1080p Medium (M1/GTX1660, 5k bangunan); min 30fps @ 10k. Tick 1 game-day <50ms p95.
- **NFR-02 Load:** interaktif pertama <3s broadband (<5MB JS awal).
- **NFR-03 Memory:** <1.5GB heap @ 256×256 kota penuh.
- **NFR-04 Reliability:** autosave tidak pernah merusak save manual; crash → tawarkan recovery.
- **NFR-05 Accessibility:** build keyboard-only memungkinkan; overlay aman colorblind (pola + warna); zoom remappable.
- **NFR-06 Compatibility:** Chrome/Edge/Safari/Firefox terbaru; WebGL2 wajib, WebGPU opsional.
- **NFR-07 Code health:** TypeScript strict, soft cap ≤300 baris/file, coverage sim-logic 80%.

## 7. Constraints & asumsi

- Single-player, client-only (tanpa backend). Seluruh sim di browser.
- Art v1 prosedural + primitive; pack GLTF opsional belakangan.
- MVP vertical slice; sistem AAA di belakang feature flag.
- Port unik workspace: dev `5180`, preview `4180` (tidak menabrak 5173/4173 atau 3000).

## 8. Metrik sukses (acceptance)

- [ ] Rantai §4 (UJ-01…UJ-08) lolos pada playthrough script terekam.
- [ ] NFR-01 terukur via FPS + tick-time HUD (overlay F3).
- [ ] Save-hash test: save → load → hash equal.
- [ ] Pemain baru mencapai 1.000 pop <15 mnt tanpa dokumen (tutorial saja).

## 9. Batasan agen (aturan main)

- ✅ **Selalu:** rujuk ID FR-/NFR- di plan/tasks/komentar kode; jalankan unit test sim sebelum tandai selesai; PR <300 baris.
- ⚠️ **Tanya dulu:** dependensi npm baru, ubah tile/grid size, sentuh format save, tambah real-time light.
- 🚫 **Jangan pernah:** commit secret; inline aset besar di JS; blokir render thread >50ms; rusak backward-compat save tanpa migrasi.

## 10. Open Questions → resolved

1. Cohort vs full-agent? **Cohort + sampled visual agent** (ADR-03).
2. Brownout priority? **Shed Industrial terjauh-dari-plant dulu**, lalu C, lalu R; UI tampilkan shed count.
3. One-way / hierarki jalan di MVP atau stretch? **MVP = street saja**; avenue/highway di belakang flag.
4. Undo depth? **MVP = single-batch undo**; full stack bila sempat.

## Glosarium

- **RCI:** Residential / Commercial / Industrial. **Tick:** 1 game-hour. **Hari:** 24 tick. **Bulan:** 30 hari (economy tick).
- **LOS:** Level of Service (A=lancar … F=macet). **BPR:** fungsi delay Bureau of Public Roads.
- **Cohort:** grup statistik warga dengan home/work district sama (optimasi perf).
