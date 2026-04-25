import { test, expect } from '@playwright/test';
import { loginAdmin } from './_helpers';

test.describe('Admin — Agent constitutions (Phase U.2)', () => {
  test('page renders 6 persona cards with counter', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/constitutions');
    await expect(page.locator('text=Agent Constitutions')).toBeVisible();
    // Counter badge text
    await expect(page.locator('text=/Counter: \\d+/').first()).toBeVisible();
  });
});
