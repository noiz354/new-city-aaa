# 06 — UI/UX, Persistence, Disasters & Polish

> Covers FR-X01..05, FR-P01..04, FR-A01..03. Everything the player touches + everything that keeps cities safe.

## 1. HUD Layout (FR-X01)

```
┌──────────────────────────────────────────────────────────┐
│ TOP: $12,450 ▲ | 👥 8,214 (jobs 7,900, un 4%) | 📅 Y2 M3 D12 | ⏸ 1x 2x 3x | ⚙  │
├──┬───────────────────────────────────────────────┬───────┤
│T │                                               │ INSPECT│
│O │            3D VIEWPORT (Three.js)             │ panel  │
│O │        + hover tooltip + ghost preview        │ (tile/ │
│L │                                               │ bldg)  │
│  │                                               │       │
├──┴───────────────────────────────────────────────┴───────┤
│ BOTTOM: [RCI bars] [Overlays ▾] [Alerts 🔔2] [Minimap 128px] [Advisors 💡] │
└──────────────────────────────────────────────────────────┘
```

- **Toolbar (left, icon+hotkey):** `V` Select · `R` Road · `1/2/3` R/C/I · `P` Power line · `⚡` Plant · `💧` Water · `🌳` Park · `🔥…` Services(M7) · `B` Bulldoze · `O` Overlay cycle.
- **4Hz rule:** HUD subscribes to sim snapshot at 4Hz max; viewport is 60fps but DOM updates throttled (perf + readability).
- **Inspector (right):** tile coords, zone, land value, powered/watered/connected icons; building: level, residents/jobs, upkeep, happiness, "why abandoned?" reason line. This reason line is mandatory — never leave player guessing.
- **Tooltip (cursor):** tool + cost preview ("Road 12 tiles — $300") + validity reason ("Too steep", "Insufficient funds").

## 2. Overlays & Minimap

- Overlay dropdown: None, Power, Water, Traffic, Land Value, Pollution, Crime, Happiness, Coverage. Keyboard `O` cycles. Each = DataTexture colormap (docs/01 §8) + legend chip bottom-left.
- Minimap: 128×128 canvas, zones (green/blue/yellow… use R=green C=blue I=orange per genre convention), roads gray, water blue, buildings white dots, viewport rect white. Click-to-jump. Updates on chunk-dirty only.

## 3. Advisors, Alerts, Tutorial (FR-X02..04)

- **Alerts queue:** critical (red: blackout, bankruptcy, disaster) / warn (amber: congestion, low funds) / info (gray: milestone "1,000 pop!"). Click → camera flies to location. Cap 5 visible, history 50.
- **Advisors:** rule engine checks daily; top 3 persistent issues rotate as 💡 cards with one-click fix ("Power 95% → [Build plant] selects tool"). Rules table: power>90%, water pressure<0.4 anywhere, unemployment>15%, demand>60 unzoned, treasury<20% of monthly burn, congestion LOS F>5 edges.
- **Tutorial checklist (dismissible, 5 steps):** 1. Lay a road (0/10 tiles) 2. Build coal plant 3. Zone 20 R tiles 4. Zone 10 C + 10 I 5. Reach 500 pop → 🎉 confetti + "Try: budget panel, overlays, night view" hints.

## 4. Settings (FR-X05)

Quality (Low/Med/High/Ultra + Auto-detect), FX on/off, Day/night speed, Autosave (off/2/5/10min), Audio (master/music/sfx + mute), Keybinds list, Colorblind mode (icons+patterns always on for critical states; mode boosts contrast), Reset-save + Export buttons.

## 5. Persistence (FR-P01..04)

### Format v1 (binary + JSON, gzipped)

```
save = gzip( headerJSON.len32 + headerJSON + layersBlob + entitiesJSON )
header: {version:1, seed, size:256, date:{y,m,d}, playMin, counts:{pop,buildings}, hash, mods:[]}
layersBlob: concatenated raw layers (zone, road, terrain, building-lo-ids...) — see plan.md §3.9
entities: {buildings:[...], nets:[...], treasury, rates, funding, stats:ring12, tutorial, settings}
hash: FNV-1a over (layersBlob + entities canonical JSON) — roundtrip equality test
```

- Slots: `city0..2` manual + `auto` in IndexedDB; each <5MB typical (65k tiles gzip well; entities ~10k×~100B ≈ 1MB → gzip ~300KB).
- Autosave: every N min + every game-year; writes to `auto` + keeps `auto.bak` (never corrupt both).
- Load: parse → version check → migrate (chain `migrateV1→V2…`) → rebuild derived (graph, nets, cohorts) → verify hash → toast "Loaded Y2 M3 · 8,214 pop".
- Corrupt: catch → offer `auto.bak` / other slots; never white-screen.
- Share: small cities (<30k tiles used) → base64 export string + copy button; import pastes. Screenshot: PNG download (preserveDrawingBuffer or re-render capture).

### Budgets: save <2s, load <3s @256²+10k (NFR). Measure in T-025 with fixture city.

## 6. Audio (FR-A01)

- WebAudio, all procedural (no mp3 assets v1): wind noise (filtered, always), traffic hum (gain ∝ volume/capacity), birds (day, parks), crickets (night), UI click/hover, build thunk, error buzz, cash cha-ching (monthly +), siren (disaster), explosion (meteor/quake).
- Music: simple generative pad loop (2 oscillators + slow LFO) — ambient, ignorable. Mute persists in localStorage. No audio before first user gesture (autoplay policy).

## 7. Disasters (FR-A02..03, T-034)

| Disaster | Trigger | Effect | Recovery |
|----------|---------|--------|----------|
| Fire | random (dry I/low funding) or button | spreads to adjacent buildings 1/day, smoke particles | fire service radius stops; rubble remains |
| Earthquake | button / rare random | 6–10 tile radius: 30% buildings → rubble, roads crack (capacity −50% until repaired→auto 10d) | bulldoze + rebuild |
| Meteor | button (fun!) | 4-tile crater (terrain→rock, water if low), boom + shake | bulldoze crater → park? |

- Toggle: "Random disasters on/off" (default ON but rare: ~1/5 game-years). Never while paused. Warning toast + camera shake + red vignette. Event logged in history + stats ("Disasters survived: 3").

## 8. Accessibility (NFR-05)

- Full keyboard path: Tab toolbar → arrows move cursor-tile → Enter place; documented in keybinds.
- Overlays never color-only: icons (⚡💧🚗) + hatch patterns + text %.
- Focus outlines visible; buttons ≥40px touch; remappable zoom (some users need +/- only).

## 9. Acceptance

- T-023: overlays+inspector incl. "why abandoned". T-025: UJ-07 roundtrip hash-equal + timings. T-031/34/35: tutorial, disasters, minimap screenshots.
