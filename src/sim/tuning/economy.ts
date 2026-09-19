// Economy tuning (docs/02-architecture/population-and-economy.md §4; progression doc §2).
// TAX_BASE: "first guess — scenario S-green decides" (progression §2): exactly 1.25× the
// MONTHLY_UPKEEP table so a healthy closed city trends gently positive at the default rate,
// per the stability loop guard table (§5). Owned by the balancing suite — lock in T-306.

export const TAX_BASE: Readonly<Record<number, Readonly<Record<number, number>>>> = {
  1: { 1: 25, 2: 50, 3: 100 }, // R — household tax base per density level
  2: { 1: 30, 2: 60, 3: 120 },
  3: { 1: 120, 2: 240, 3: 480 },
};

/** Tax rate per zone, default 9, range 0..20 (docs/02 §4; slider UI is T-302). */
export const TAX_RATE = { default: 9, min: 0, max: 20 } as const;

/** docs/02 §4: happyFactor (0.6 + 0.4·happy/100), floor 0.6 as the death-spiral guard. */
export const HAPPINESS_STUB = 80; // per-building happiness constant until the T-305 cohort ledger lands
export const HAPPY_FLOOR = 0.6;

/** Bankruptcy threshold (docs/02 §4): balance below this blocks paid commands + budget modal. */
export const BANKRUPT_LIMIT = -5_000;

/** Sparkline ring length for the budget panel (docs/02 §4). */
export const HISTORY_MONTHS = 12;
