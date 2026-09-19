# 05 — Utilities (Power/Water) & Economy (Treasury/Tax)

> Covers FR-U01..04 + FR-E01..05. Two halves, one doc: electrons/water keep buildings alive; dollars keep the player alive.

## PART A — UTILITIES

### A1. Network Model (shared pattern)

Conductors: **power lines + all roads + all buildings** conduct power (ADR-06: roads carry utilities — fun-first, SC2013-lite). Water: same + pipes (M7 adds explicit pipes; MVP roads carry water too).

- **Net discovery:** BFS/union-find flood over conductor tiles. Each net gets id. Recompute on edit + daily (cheap: 65k cells BFS ≈ <2ms).
- Data per net: `{id, supplyMW, demandMW, powered: bool, shedCount}` / water `{supplyKL, demandKL, pressureMin}`.

```ts
function floodNets(grid, isConductor): Int16Array {
  // union-find or BFS; returns netId per tile (-1 if non-conductor)
}
```

### A2. Power (FR-U01)

Plants (MVP):

| Plant | Build $ | Upkeep/mo | MW | Pollution | Notes |
|-------|---------|-----------|----|-----------|-------|
| Coal S | 2,500 | 120 | 400 | high (6-tile) | starter, dirty |
| Coal L (M7) | 8,000 | 350 | 1200 | very high | scale |
| Wind (M6+) | 800 | 20 | 60–120 (varies) | none | flavor/early-green |
| Solar (M7) | 3,000 | 40 | 200 day-only | none | day/night matters |

- Demand per building: `docs/03 §3` table (kW→MW sum).
- Balance per net: if `demand ≤ supply` → all powered. Else **brownout**: sort consumers Industrial-farthest-first → Commercial → Residential (ADR-05); shed until demand ≤ supply; shed buildings `powered=false` + ⚡ icon + advisor alert. Never partially power a building (binary clarity).
- Power lines: $10/tile, no upkeep; plants must touch road or line to join net.
- Overlay: powered nets green tint, unpowered tiles gray + ⚡ icons.

### A3. Water (FR-U02)

Sources:

| Source | Build $ | Upkeep/mo | kL | Notes |
|--------|---------|-----------|----|-------|
| Water tower | 800 | 30 | 800 | starter |
| Pumping station (M7) | 2,500 | 90 | 2500 | near water required |

- Pressure model: BFS distance from nearest source within net: `pressure = 1 − distTiles*0.02 − loadFactor*0.3` where `loadFactor = netDemand/netSupply`. Watered if pressure > 0.30. Far edge of a sprawling city needs a 2nd tower (UJ by design).
- Overlay: blue gradient by pressure; unwatered 💧 icon.

### A4. Services (FR-U04, M7 — T-032)

Police/Fire/School/Clinic/Park: each has `radiusTiles` (road-distance BFS), `capacity`, `upkeep`. Buildings in radius get happiness/growth/safety effects; overloaded (pop>capacity) → reduced effect + advisor tip. Coverage overlay per service.

---

## PART B — ECONOMY

### B1. Treasury Loop (FR-E01)

- Start: **$20,000**. Monthly tick (every 30 game-days):
  `treasury += taxIncome − totalUpkeep`
- Bankruptcy: treasury < −$5,000 → **block all paid placements**, force budget modal, play warn sting; recover by cutting funding / raising tax / bulldozing upkeep.
- All money integers (no float cents). Monthly report toast: "+$1,240 ▲ (taxes $2,100 − upkeep $860)".

### B2. Tax Income (FR-E02)

```
per building: income = taxBase[zone][level] × (rate[zone]/9) × happyFactor
happyFactor = 0.6 + 0.4*(happiness/100)   // miserable cities pay less (death spiral risk!)
rate sliders: 0..20%, default 9%. rate>15 → abandonment timer (docs/03).
```

Example: 50×R1 (base 8) + 20×C1 (15) + 10×I1 (12) at 9%, happy 70 → ≈ 50×8×0.88 + 20×15×0.88 + 10×12×0.88 ≈ **$722/mo**. Upkeep same city ≈ 50×2+20×4+10×6+plant 120+roads ≈ **$420/mo** → net +$300. ✔ Matches docs/03 balance target.

### B3. Placement & Upkeep Costs (FR-E03)

| Item | Build | Upkeep/mo |
|------|-------|-----------|
| Road /tile | $25 | $0.5 |
| Zone R/C/I /tile | $10 | $0 |
| Power line /tile | $10 | $0 |
| Coal plant S | $2,500 | $120 |
| Water tower | $800 | $30 |
| Park 3×3 | $400 | $25 |
| Bulldoze /tile (empty/rubble/building) | $5 / $5 / $50 | — |
| Police/Fire/School/Clinic | $1,200–2,000 | $80–150 |

Roads cheap to build, pricey at scale via upkeep — sprawl has a cost. Bulldozing buildings costs real money (no free re-roll).

### B4. Budget Panel (FR-E04)

- Sections: **Income** (R/C/I tax lines + total), **Expenses** (roads/utilities/services/plants + total), **Net + 12-mo sparkline**, **Tax sliders** (R/C/I with live revenue preview), **Funding sliders** (power/roads/services 50/100/150% — underfunding reduces coverage/capacity).
- Funding effects: 50% → plants output 70%, service radius 60%; 150% → +20% output/radius at 1.5× cost. Simple, legible.
- Live preview: moving a slider shows projected Δ/mo before Apply.

### B5. HUD Economy Strip (FR-E05)

Always visible: `$ + RCI bars + pop/jobs/unemp%`. RCI bars clickable → advisor explains ("I demand low: unemployment 4% — zone more R").

### B6. Anti-Death-Spiral Guards

- New cities (<500 pop) get "Frontier subsidy": upkeep −30% (hidden, prevents instant bankruptcy while learning).
- Abandonment from taxes has 30-day grace + 3 warnings.
- Empty zones cost nothing (no upkeep on vacant paint).

## Acceptance

- T-015: monthly math unit tests incl. happyFactor + subsidy. T-020/21: brownout + pressure demos. T-022: UJ-05 (15% tax → revenue↑ then abandonment).
