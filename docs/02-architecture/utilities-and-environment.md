# Utilities & Environment

> Corrects gaps G-A8 (environment model) and hardens utilities. Prior: `../05-utilities-economy.md` retained for costs/tables.

## 1. Utility networks (power + water)

- **Conductors (v1):** power lines + roads + buildings (ADR-06, fun-first); explicit pipes are a stretch with a frozen `waterPipe` layer id reserved.
- **Net discovery:** union-find/BFS flood per edit + daily; per net `{supply, demand, members}`.
- **Power:** binary per building; overload → brownout shed order **Industrial farthest-first → Commercial → Residential** (design decision, playtest-validated in VS-4; rationale: homes last).
- **Water:** `pressure = 1 − distTiles·k − loadFactor·m`, watered iff >0.30; constants `k,m` in tuning file, validated by UJ water test.
- Overlays per net + per-building icons (⚡💧) with reasons.

## 2. Services (M7 scope, interfaces frozen early)

Police/fire/school/clinic/park: `{position, radiusTiles, capacity, upkeep, effect}`; coverage via **road-distance BFS** (fallback: euclid in VS-3, upgraded later — flagged); overload degrades effect + advisor tip. Coverage overlay per service.

## 3. Environment model (G-A8 correction — new)

| Field | Sources (+) | Sinks (−) | Diffusion | Gameplay effect |
|-------|-------------|-----------|-----------|-----------------|
| Air pollution | I buildings (level-scaled), coal plants, traffic volume | trees/parks, distance | blur, radius ~8 | R/C desirability↓, happiness↓, land value↓ |
| Noise | traffic volume, I | distance | blur, radius ~5 | R happiness↓ near arterials |
| Ground pollution | I abandon/rubble, disasters | bulldoze + time decay | slow decay, no spread | blocks R re-occupancy until clean |
| Crime | unemployment, low police coverage | police coverage | blur, radius ~6 | C/R happiness↓, land value↓ |
| Health | clinic coverage, low pollution | pollution, unemployment | city+local mix | happiness modifier; death-flow input (late) |

All weights in `tuning/environment.ts` with balancing-suite assertions (e.g., "I next to R depresses value ≥15 within radius"). Fire spread + quake + meteor state machines defined here for VS-6: fire (ignite→spread 1/day→burnout→rubble, stopped by coverage), quake (instant radius damage + road capacity debuff 10d), meteor (crater terrain change + rubble).

## 4. Verification

Flood/migration unit tests; brownout order test; pressure falloff test; environment weight tests; disaster E2E (trigger → rubble → rebuild → recovery); overlay legend tests.
