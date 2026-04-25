import { test, expect } from '@playwright/test';
import { loginAdmin } from './_helpers';

test.describe('Admin — Persona distillations (Phase U.1)', () => {
  test('page renders 6 persona cards', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/distillations');
    await expect(page.locator('text=Persona Distillations').first()).toBeVisible();
    // 6 personas → at least 6 "Distill" buttons
    const buttons = page.locator('button:has-text("Distill"), button:has-text("Re-distill")');
    await expect.poll(async () => buttons.count()).toBeGreaterThanOrEqual(6);
  });
});
