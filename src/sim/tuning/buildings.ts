// Building lifecycle tuning (data-only, hot-tunable per D-B3; locked by the VS-3 balancing suite T-306).
// Canonical construction duration: 3 game-days (building-and-zoning-systems.md §2) = 3 × 24 ticks.
export const BUILDING_TUNING = {
  constructionTicks: 72,
} as const;
