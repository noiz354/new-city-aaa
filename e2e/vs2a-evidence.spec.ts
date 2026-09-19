// Evidence playthrough for VS-2a "First House" + the VS-3 economy slice, driving the real
// browser build through the window.__game debug seam (same as vs1/vs2a specs):
//   T-202 before/after + pop HUD · T-203 house instances visible · T-205 month tick moves $ on
//   the HUD · T-206 RCI bars · T-207 land-value overlay gradient · T-208 pop/jobs/unemp strip ·
//   T-303 budget panel · VS-2 GATE save → reload → load → continue (hash-equal).
// Order mirrors a real first session: residential first (UJ-01), industry once people live
// there, then the first month settles. (The v0 growth pass hands its single daily spawn to the
// highest-demand zone — I > R > C at bootstrap — so zoning I on day 1 would delay the first
// house by weeks; T-304/T-305 mature the demand/jobs coupling. Documented in tasks.md.)
// Screenshots land in test-results/ and are copied to docs/05-execution/evidence/ when accepted.
import { expect, test, type Page } from '@playwright/test';

interface Snapshot {
  tick: number;
  population: number;
  balance: number;
  demand: { r: number; c: number; i: number };
  lastMonth: { income: number; expense: number; subsidy: number };
  history: { income: number; expense: number; subsidy: number }[];
  date: { year: number; month: number; day: number };
}
interface GameDebug {
  sim: {
    execute(cmd: unknown): { ok: boolean; reason?: string };
    snapshot(): Snapshot;
    update(ms: number): void;
    hash(): number;
    clock: { setSpeed(s: number): void; tick: number };
    buildings: { count: number; population(): number };
    fields: { valueAt(x: number, y: number): number };
  };
  view: { focusTile(t: { x: number; y: number }, zoom?: number, instant?: boolean): void };
  store: { getState(): { snapshot: Snapshot }; set(p: Record<string, unknown>): void };
  actions: { save(slot: string): Promise<void>; load(slot: string): Promise<void>; toggleValueOverlay(): void; toggleBudget(): void };
}

declare global {
  interface Window {
    __game?: GameDebug;
  }
}

const C = { x: 128, y: 128 }; // map centre (256²); focus zoom 260 m frames the block at 1280×720

async function boot(page: Page, query: string): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/${query}`);
  await expect(page.locator('#scene-container canvas')).toBeVisible();
  await page.waitForFunction(() => window.__game !== undefined);
  await expect(page.locator('.topbar')).toBeVisible();
  return errors;
}

/** Advance whole game days synchronously through the public update() path, then pause. */
async function fastForwardDays(page: Page, days: number): Promise<void> {
  await page.evaluate((d) => {
    const g = window.__game as GameDebug;
    g.sim.clock.setSpeed(1); // 1x = 2 ticks/s → 250 ms chunks = 48 updates per 24-tick day
    for (let i = 0; i < 48 * d; i++) g.sim.update(250);
    g.sim.clock.setSpeed(0);
  }, days);
  // Let the frame loop drain events into the view + pump the HUD snapshot (4 Hz) a few times.
  await page.waitForFunction(() => {
    const g = window.__game as GameDebug;
    return g.store.getState().snapshot.tick === g.sim.clock.tick;
  });
  await page.waitForTimeout(900);
}

async function hud(page: Page): Promise<string> {
  return (await page.locator('.topbar').textContent()) ?? '';
}

function snap(page: Page): Promise<Snapshot> {
  return page.evaluate(() => (window.__game as GameDebug).sim.snapshot());
}

test('VS-2a/VS-3 evidence: first houses grow, HUD moves, industry arrives, month tick bites, budget panel, save→load', async ({ page }) => {
  test.setTimeout(600_000); // SwiftShader frames are ~250 ms; the playthrough is long by design
  const errors = await boot(page, '?seed=25&preset=plains');

  // ---- Day 1: road cross through the centre; R strips west of it, a C strip north-east. ----
  const built = await page.evaluate((c) => {
    const g = window.__game as GameDebug;
    const path = (x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] => {
      const out: { x: number; y: number }[] = [];
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push({ x, y });
      return out;
    };
    const res = [
      g.sim.execute({ kind: 'place-road', path: path(c.x - 20, c.y, c.x + 20, c.y) }),
      g.sim.execute({ kind: 'place-road', path: path(c.x, c.y - 12, c.x, c.y + 12) }),
      g.sim.execute({ kind: 'paint-zone', rect: { x0: c.x - 18, y0: c.y - 2, x1: c.x - 3, y1: c.y - 1 }, zone: 1 }), // R north-west (32 lots)
      g.sim.execute({ kind: 'paint-zone', rect: { x0: c.x - 18, y0: c.y + 1, x1: c.x - 11, y1: c.y + 1 }, zone: 1 }), // R south-west (8 lots)
      g.sim.execute({ kind: 'paint-zone', rect: { x0: c.x + 3, y0: c.y - 1, x1: c.x + 10, y1: c.y - 1 }, zone: 2 }), // C north-east (8 lots)
    ];
    g.sim.clock.setSpeed(0);
    g.view.focusTile(c, 260, true);
    return { ok: res.every((r) => r.ok), reasons: res.map((r) => r.reason ?? 'ok'), snap: g.sim.snapshot() };
  }, C);
  expect(built.ok, built.reasons.join(',')).toBe(true);
  expect(built.snap.population).toBe(0);
  await page.waitForTimeout(900);
  await expect(page.locator('.topbar')).toContainText('Pop 0');
  await page.screenshot({ path: 'test-results/vs2a-before.png' }); // T-202 "before"
  const hudBefore = await hud(page);

  // ---- ~12 game days → first houses complete (3-day build) + move-in (pacing 1 spawn/day). ----
  await fastForwardDays(page, 12);
  const grown = await page.evaluate(() => {
    const g = window.__game as GameDebug;
    return { snap: g.sim.snapshot(), buildings: g.sim.buildings.count };
  });
  expect(grown.buildings).toBeGreaterThan(0); // T-202: spawned on zoned+road-attached lots
  expect(grown.snap.population).toBeGreaterThan(0); // T-202: pop > 0 within ~10 game days
  await expect(page.locator('.topbar')).toContainText(`Pop ${grown.snap.population.toLocaleString('en-US')}`); // T-208 strip
  await expect(page.locator('.topbar .rci')).toContainText(/R [+-]?\d+/); // T-206 bars
  const hudAfter = await hud(page);
  expect(hudAfter).not.toBe(hudBefore); // T-208: numbers move as the city grows
  await page.screenshot({ path: 'test-results/vs2a-after.png' }); // T-202 "after" + T-203 houses + T-206/T-208 HUD

  // ---- T-203 close-up: the instanced houses/scaffolds on the grown lots (camera away from origin). ----
  await page.evaluate((c) => (window.__game as GameDebug).view.focusTile({ x: c.x - 12, y: c.y - 1 }, 90, true), C);
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'test-results/vs2a-houses-closeup.png' }); // human-inspected: houses visible
  await page.evaluate((c) => (window.__game as GameDebug).view.focusTile(c, 260, true), C);

  // ---- Day 13: industry south-east; run through the first month boundary (tick 720 = Y1 M2 D1). ----
  const zonedI = await page.evaluate((c) => {
    const g = window.__game as GameDebug;
    return g.sim.execute({ kind: 'paint-zone', rect: { x0: c.x + 3, y0: c.y + 1, x1: c.x + 12, y1: c.y + 1 }, zone: 3 }); // I (10 lots)
  }, C);
  expect(zonedI.ok).toBe(true);
  const beforeMonth = (await snap(page)).balance;
  await fastForwardDays(page, 20); // day 13 → day 33
  const month = await snap(page);
  expect(month.date.month).toBe(2);
  expect(month.history.length).toBe(1);
  expect(month.lastMonth.income).toBeGreaterThan(0); // occupied houses pay tax (T-301)
  expect(month.lastMonth.expense).toBeGreaterThan(0); // upkeep billed (roads + standing buildings) (T-205)
  expect(month.lastMonth.subsidy).toBeGreaterThan(0); // frontier city (< 500 pop) pays 70%
  // The treasury moved by exactly the ledger the panel shows: income − gross upkeep + subsidy.
  expect(month.balance - beforeMonth).toBe(month.lastMonth.income - month.lastMonth.expense + month.lastMonth.subsidy);
  await expect(page.locator('.topbar')).toContainText(`$${month.balance.toLocaleString('en-US')}`);
  await expect(page.locator('.topbar')).toContainText(`Y${month.date.year} M${month.date.month} D${month.date.day}`);
  await page.screenshot({ path: 'test-results/vs2a-month-tick.png' }); // T-205: HUD after the month tick (I lots built)

  // ---- T-207: land-value gradient overlay (V key) — the I strip depresses value vs the R side. ----
  await page.keyboard.press('KeyV');
  await expect(page.locator('.topbar button', { hasText: 'Value' })).toHaveClass(/on/);
  const values = await page.evaluate((c) => {
    const g = window.__game as GameDebug;
    return { nearI: g.sim.fields.valueAt(c.x + 8, c.y + 2), nearR: g.sim.fields.valueAt(c.x - 10, c.y - 3) };
  }, C);
  expect(values.nearI).toBeLessThan(values.nearR); // industry pollution stamps show in the field
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'test-results/vs2a-value-overlay.png' });
  await page.keyboard.press('KeyV');
  await expect(page.locator('.topbar button', { hasText: 'Value' })).not.toHaveClass(/on/);

  // ---- T-303: budget panel (B) mirrors the settled ledger + one sparkline bar pair. ----
  await page.keyboard.press('KeyB');
  const panel = page.locator('.budget-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(`+$${month.lastMonth.income.toLocaleString('en-US')}`);
  await expect(panel).toContainText(`−$${month.lastMonth.expense.toLocaleString('en-US')}`);
  await expect(panel).toContainText(`+$${month.lastMonth.subsidy.toLocaleString('en-US')}`);
  const net = month.lastMonth.income - month.lastMonth.expense + month.lastMonth.subsidy;
  await expect(panel.locator('tr.total')).toContainText(`${net >= 0 ? '+' : '−'}$${Math.abs(net).toLocaleString('en-US')}`);
  expect(await panel.locator('rect.bar-inc').count()).toBe(1);
  await page.screenshot({ path: 'test-results/vs3-budget-panel.png' });
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();

  // ---- VS-2 GATE: save → reload page → load → identical hash → continue running. ----
  const hashA = await page.evaluate(async () => {
    const g = window.__game as GameDebug;
    await g.actions.save('city0');
    return g.sim.hash();
  });
  await expect(page.locator('.toast')).toContainText(/Saved city0/);
  await page.reload();
  await page.waitForFunction(() => window.__game !== undefined);
  const loaded = await page.evaluate(async (c) => {
    const g = window.__game as GameDebug;
    await g.actions.load('city0');
    g.sim.clock.setSpeed(0);
    g.view.focusTile(c, 260, true);
    return { hash: g.sim.hash(), snap: g.sim.snapshot(), buildings: g.sim.buildings.count };
  }, C);
  expect(loaded.hash).toBe(hashA);
  expect(loaded.buildings).toBeGreaterThan(0); // building store restored from the entity section
  expect(loaded.snap.population).toBe(month.population);
  expect(loaded.snap.balance).toBe(month.balance);
  await page.waitForTimeout(900);
  await expect(page.locator('.topbar')).toContainText(`Pop ${month.population.toLocaleString('en-US')}`);
  await page.screenshot({ path: 'test-results/vs2a-loaded.png' });
  await fastForwardDays(page, 5);
  const continued = await snap(page);
  expect(continued.tick).toBeGreaterThan(loaded.snap.tick);

  expect(errors).toEqual([]);
});
