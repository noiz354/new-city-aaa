// E2E evidence for T-204 (FR-C06, VS-2a negative acceptance):
// "zona terisolasi tidak tumbuh + ikon tampil", Evidence: screenshot.
// Drives the real browser game via window.__game (same debug seam as vs1.spec.ts).
import { expect, test, type Page } from '@playwright/test';

interface Snapshot {
  tick: number;
  population: number;
  balance: number;
}
interface GameDebug {
  sim: {
    execute(cmd: unknown): { ok: boolean };
    snapshot(): Snapshot;
    update(ms: number): void;
    growth: { growthBlockReason(x: number, y: number): string | null };
    roadAccess: { isConnected(x: number, y: number): boolean; collectBlocked(): { x: number; y: number }[] };
    buildings: { count: number };
    clock: { setSpeed(s: number): void; tick: number; date(): { day: number; month: number; year: number } };
  };
  view: { focusTile(t: { x: number; y: number }, zoom?: number, instant?: boolean): void };
  store: { set(p: Record<string, unknown>): void };
}

function game(page: Page): Promise<GameDebug | null> {
  return page.evaluate(() => (window as unknown as { __game?: GameDebug }).__game ?? null);
}

test('T-204: isolated zone shows the icon + "No road connection" and never grows', async ({ page }) => {
  await page.goto('/?seed=25&preset=plains');
  await expect(page.locator('#scene-container canvas')).toBeVisible();
  await page.waitForFunction(() => (window as unknown as { __game?: unknown }).__game !== undefined);

  // Isolate: a 2×2 R zone far from any road (no road is ever built near it).
  const placed = await page.evaluate(() => {
    const g = (window as unknown as { __game: GameDebug }).__game;
    return g.sim.execute({ kind: 'paint-zone', rect: { x0: 120, y0: 120, x1: 121, y1: 121 }, zone: 1 });
  });
  expect(placed.ok).toBe(true);

  // Fast-forward 20 game days synchronously through the public update() path (attachment flags
  // + growth passes run on day boundaries), then pause and frame the lot for the capture.
  await page.evaluate(() => {
    const g = (window as unknown as { __game: GameDebug }).__game;
    g.sim.clock.setSpeed(1);
    for (let i = 0; i < 48 * 20; i++) g.sim.update(250);
    g.sim.clock.setSpeed(0);
    g.view.focusTile({ x: 120, y: 120 }, 120, true);
    g.store.set({ selectedTile: { x: 120, y: 120 } }); // Inspector shows the sim-owned reason
  });
  await page.waitForFunction(() => {
    const g = (window as unknown as { __game: GameDebug }).__game;
    return g.sim.snapshot().tick >= 24 * 20 && g.sim.roadAccess.collectBlocked().length > 0;
  });

  const probe = await game(page);
  if (!probe) throw new Error('no game');
  const accepts = await page.evaluate(() => {
    const g = (window as unknown as { __game: GameDebug }).__game;
    return {
      blocked: g.sim.roadAccess.collectBlocked().length,
      reason: g.sim.growth.growthBlockReason(120, 120),
      buildings: g.sim.buildings.count,
      population: g.sim.snapshot().population,
    };
  });
  expect(accepts.blocked).toBeGreaterThan(0); // icon markers exist for flagged lots
  expect(accepts.reason).toBe('no-road-access'); // inspector/block reason shown
  expect(accepts.buildings).toBe(0); // isolated zone never grows
  expect(accepts.population).toBe(0);
  await expect(page.locator('.inspector')).toContainText(/Growth blocked/);

  await page.waitForTimeout(900); // a few frames so the icon instanced mesh + HUD settle
  await page.screenshot({ path: 'test-results/t204-no-road-icon.png' });
});
