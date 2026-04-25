import { test, expect } from '@playwright/test';
import { loginAdmin } from './_helpers';

test.describe('Admin — Scraping health (Phase U.4)', () => {
  test('page renders with provider tiles', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/scraping-health');
    // Provider tiles are grouped by category
    await expect(page.locator('text=/HEALTHY|DOWN/i').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=/search providers|scraper providers/i').first()).toBeVisible();
  });
});
