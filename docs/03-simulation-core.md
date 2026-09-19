# 03 — Simulation Core: Clock, RCI Demand & Growth

> Covers FR-S01..06. The heart of the game. All formulas are normative — implement exactly, tune via constants.

## 1. Game Clock (FR-S01)

- Unit: **1 tick = 1 game-hour**. Day = 24 ticks, Month = 30 days, Year = 12 months.
- Speeds (ticks per real second): pause=0, 1x=2, 2x=6, 3x=12. So 1x: a day ≈ 12s, a month ≈ 6min. Feels brisk but readable.
- Implementation: accumulator in `engine/clock.ts`; `update(realDt)` runs `while(acc>=TICK){sim.tick(); acc-=TICK}` with max 8 ticks/frame (spiral-of-death guard; if exceeded, show "Sim behind — consider 1x" hint).
- Determinism: sim RNG = `mulberry32(seed + tickCount)` streams per system; **never** `Math.random()` or `Date.now()` inside sim.
- Order per tick: `utilities(daily-gated) → agents/jobs(daily) → traffic(daily) → growth(daily) → fields(worker, daily) → economy(monthly)`. Hourly ticks only advance visual-time + agent movement; heavy logic runs on day boundary (tick%24==0). This keeps tickMs tiny.

## 2. RCI Demand Model (FR-S02) — the RCI bars

Each demand ∈ [−100, +100]. Positive = zone more of that type.

```
// Inputs (all 0..1 unless noted)
unemp = unemployed / workforce
happy = avgHappiness / 100
taxR/C/I = rate / 20 (normalized from 0..20%)
vacancy = emptyZonedTiles / totalZonedTiles (per zone)

// Residential: people come when there are jobs + happiness + low tax
demandR = 60*(1-unemp) + 30*happy - 40*taxR - 25*vacancyR + jobsAvailable*20 - 50
// Commercial: shops come when there are customers (pop) + low tax
demandC = 50*popFactor + 20*happy - 40*taxC - 25*vacancyC - 30*unempShop? + 10
// Industrial: factories come when workers available + low tax + cheap land
demandI = 55*workforceAvail + 25*(1-taxI*1.2) - 25*vacancyI - 15*regulation? + 5
clamp each to [-100,100]; smooth: demand += (target-demand)*0.2 per day (no flicker)
```

Tuning table (starting constants — playtest from here):

| Const | Value | Effect |
|-------|-------|--------|
| jobsAvailable weight | 20 | R follows jobs (commute matters) |
| popFactor | pop/5000 capped 0..1 | C needs customers |
| workforceAvail | unemployed/500 capped | I needs hands |
| tax penalty | −40 at 20% | 15%+ hurts visibly (UJ-05) |

RCI bars in HUD = these three numbers. Advisors trigger off them (e.g., demandR>60 for 10d → "Zone more Residential").

## 3. Growth Engine (FR-S03..04)

**Daily growth budget:** `N = clamp(2 + pop/500, 2, 25)` developments per day (spawn or upgrade). Prevents instant cities + bounds perf.

**Candidate scoring** (for each empty zoned tile with road adjacency):

```
if !powered || !watered || !connected: score = -inf (show icon reason)
else score = desirability(zone, tile)      // docs/02 §6, 0..100
           × landFit(zone, value)           // R/C want high value, I wants low
           × demandFactor                   // demand[zone]/100, min 0.05
           × (0.7 + 0.6*rng())              // organic jitter
```

`landFit`: R: `0.5+value/200`; C: `0.5+value/200`; I: `1.2-value/150` (cheap land attractive).

**Spawn:** take top-N vacant candidates with score > `SPAWN_T=25`, demand[zone] > 0. Create Building L1.
**Upgrade:** L1→L2 needs score>60 for 5 consecutive days + demand>20; L2→L3 needs score>75 for 8 days + demand>40 + park/school nearby (M7). Track `goodDays` counter per building.
**Abandon:** if unpowered/unwatered 30d OR happiness<25 for 20d OR tax>15% for 30d → abandoned=true (visual: dark, overgrown tint). Abandoned 30d more → collapses to rubble (bulldoze cheap/free). Re-occupy if conditions fix within 30d (score>40).

**Building stats by zone×level:**

| Zone/L | Residents | Jobs | Upkeep/mo | Tax base/mo | Power kW | Water kL |
|--------|-----------|------|-----------|-------------|----------|----------|
| R1/R2/R3 | 6 / 25 / 80 | 0 | 2 / 6 / 15 | 8 / 30 / 90 | 10/40/120 | 10/40/120 |
| C1/C2/C3 | 0 | 8 / 30 / 90 | 4 / 12 / 30 | 15 / 60 / 180 | 20/70/200 | 15/50/150 |
| I1/I2/I3 | 0 | 12 / 45 / 130 | 6 / 18 / 45 | 12 / 50 / 150 | 40/150/400 | 30/100/250 |

Balance target: a balanced 1k-pop city at 9% tax nets ≈ +$200–500/mo after upkeep (slightly positive, rewards growth).

## 4. Happiness (feeds demand + growth)

Per residence 0..100: `50 + powered*10 + watered*10 + parkNear*10 + schoolNear*8 + lowTax*8 + lowPollution*8 + employed*10 − trafficNoise*8 − crime*10`, clamped. City happiness = pop-weighted mean. Shown in HUD + happiness overlay (M7; M3 uses simplified subset without school/crime).

## 5. Determinism & Testing

- `sim.tick()` pure given (state, rngStream). Unit tests: fixed fixture grid + seed → run 30 days → assert exact pop/building counts (snapshot). Any formula change updates snapshots deliberately.
- Fuzz: random ops (zone/road/bulldoze) for 100 days must never throw/NaN (CI nightly).

## 6. Acceptance

- T-011: demand unit tests (unemployment↑→demandR↓, tax 20%→all demand negative-ish). T-012: 10-day growth screenshot. T-013: balanced city unemployment <50%.
