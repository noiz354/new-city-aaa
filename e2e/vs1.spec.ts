import { expect, test, type Page } from '@playwright/test';

interface Counts {
  roads: number;
  zonesR: number;
  zonesC: number;
  zonesI: number;
}
interface GameDebug {
  sim: { hash(): number; snapshot(): { counts: Counts; balance: number } };
  actions: { save(slot: string): Promise<void>; load(slot: string): Promise<void> };
}

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#scene-container canvas')).toBeVisible();
  await page.waitForFunction(() => (window as unknown as { __game?: unknown }).__game !== undefined);
  await expect(page.locator('.topbar')).toBeVisible();
  return errors;
}

test('city boots: terrain canvas, HUD, F3, no errors', async ({ page }) => {
  const errors = await boot(page);
  await expect(page.locator('.toolbar')).toBeVisible();
  await expect(page.locator('#f3-overlay')).toContainText(/fps \d+/);
  expect(errors).toEqual([]);
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/vs1-boot.png' });
});

test('road + zone via real mouse drags; toast receipts', async ({ page }) => {
  const errors = await boot(page);
  const box = await page.locator('#scene-container canvas').boundingBox();
  if (!box) throw new Error('no canvas box');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.getByRole('button', { name: /Road/ }).click();
  await page.mouse.move(cx - 120, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 120, cy, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.toast')).toContainText(/Road built/);

  await page.getByRole('button', { name: /Zone R/ }).click();
  await page.mouse.move(cx - 120, cy - 140);
  await page.mouse.down();
  await page.mouse.move(cx + 40, cy - 40, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.toast')).toContainText(/Zoned/);

  await page.getByRole('button', { name: /Zone C/ }).click();
  await page.mouse.move(cx + 60, cy - 140);
  await page.mouse.down();
  await page.mouse.move(cx + 200, cy - 40, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.toast')).toContainText(/Zoned/);

  await page.getByRole('button', { name: /Zone I/ }).click();
  await page.mouse.move(cx - 120, cy + 80);
  await page.mouse.down();
  await page.mouse.move(cx + 40, cy + 180, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.toast')).toContainText(/Zoned/);

  const counts = (await page.evaluate(() => (window as unknown as { __game: GameDebug }).__game.sim.snapshot())).counts;
  expect(counts.roads).toBeGreaterThan(5);
  expect(counts.zonesR).toBeGreaterThan(5);
  expect(counts.zonesC).toBeGreaterThan(5);
  expect(counts.zonesI).toBeGreaterThan(5);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/vs1-built.png' });
});

test('inspector shows clicked tile', async ({ page }) => {
  const errors = await boot(page);
  const box = await page.locator('#scene-container canvas').boundingBox();
  if (!box) throw new Error('no canvas box');
  await page.getByRole('button', { name: /Select/ }).click();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('.inspector')).toContainText(/Tile\s*\d+, \d+/);
  expect(errors).toEqual([]);
});

test('cameras: persp pick accuracy + zoom/pan smoke', async ({ page }) => {
  const errors = await boot(page);
  const box = await page.locator('#scene-container canvas').boundingBox();
  if (!box) throw new Error('no canvas box');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.getByRole('button', { name: /Persp|Ortho/ }).click(); // ortho -> persp
  await expect(page.getByRole('button', { name: /Persp/ })).toBeVisible();
  await page.getByRole('button', { name: /Select/ }).click();
  await page.mouse.click(cx, cy);
  const text = await page.locator('.inspector').textContent();
  const m = text?.match(/Tile\s*(\d+), (\d+)/);
  if (!m) throw new Error(`no tile in inspector: ${text}`);
  // map is 256^2 centered on screen: center click must land within 3 tiles of middle
  expect(Math.abs(Number(m[1]) - 128)).toBeLessThanOrEqual(3);
  expect(Math.abs(Number(m[2]) - 128)).toBeLessThanOrEqual(3);

  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -400); // zoom in
  await page.mouse.down({ button: 'right' }); // pan
  await page.mouse.move(cx + 80, cy + 40, { steps: 4 });
  await page.mouse.up({ button: 'right' });
  await page.keyboard.press('o'); // back to ortho
  await expect(page.getByRole('button', { name: /Ortho/ })).toBeVisible();
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/vs1-persp.png' });
});

test('water renders on bay preset; max zoom-out stays legible', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?preset=bay&seed=11');
  await expect(page.locator('#scene-container canvas')).toBeVisible();
  await page.waitForFunction(() => (window as unknown as { __game?: unknown }).__game !== undefined);
  const box = await page.locator('#scene-container canvas').boundingBox();
  if (!box) throw new Error('no canvas box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 1200); // max zoom-out
  await page.waitForTimeout(600);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/vs1-bay.png' });
});

test('save -> reload page -> load reproduces the exact hash', async ({ page }) => {
  const errors = await boot(page);
  await page.locator('.seg button').first().click(); // pause: freeze the tick for comparison
  const box = await page.locator('#scene-container canvas').boundingBox();
  if (!box) throw new Error('no canvas box');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.getByRole('button', { name: /Road/ }).click();
  await page.mouse.move(cx - 100, cy + 60);
  await page.mouse.down();
  await page.mouse.move(cx + 100, cy + 60, { steps: 6 });
  await page.mouse.up();

  await page.getByRole('button', { name: /^Save$/ }).click();
  await expect(page.locator('.toast')).toContainText(/Saved city0/);
  const hashA = await page.evaluate(() => (window as unknown as { __game: GameDebug }).__game.sim.hash());
  const countsA = await page.evaluate(() => (window as unknown as { __game: GameDebug }).__game.sim.snapshot().counts);

  await page.reload();
  const errors2 = await boot(page);
  await page.getByRole('button', { name: /^Load$/ }).click();
  await expect(page.locator('.toast')).toContainText(/Loaded city0/);
  const hashB = await page.evaluate(() => (window as unknown as { __game: GameDebug }).__game.sim.hash());
  const countsB = await page.evaluate(() => (window as unknown as { __game: GameDebug }).__game.sim.snapshot().counts);
  expect(hashB).toBe(hashA);
  expect(countsB).toEqual(countsA);
  expect(errors.concat(errors2)).toEqual([]);
  await page.screenshot({ path: 'test-results/vs1-loaded.png' });
});
