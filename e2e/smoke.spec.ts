import { expect, test } from '@playwright/test';

test('scaffold boots: placeholder + F3 overlay, no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByText(/VS-0 scaffold/)).toBeVisible();
  await expect(page.locator('#f3-overlay')).toBeVisible();
  await expect(page.locator('#f3-overlay')).toContainText(/fps \d+/);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/vs0-smoke.png' });
});
