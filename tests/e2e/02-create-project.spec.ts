import { test, expect } from '@playwright/test';
import { login, uniqueProjectName } from './_helpers';

test.describe('Project creation', () => {
  test('new project form submits and redirects to /project/[id]', async ({ page }) => {
    await login(page);
    const name = uniqueProjectName('e2e-proj');
    // Find the "New Project" CTA — matches multiple possible texts
    await page.locator('button, a').filter({ hasText: /new project|créer un projet|nouveau/i }).first().click();

    await page.fill('input[placeholder*="name" i], input[name*="name" i]', name);
    // Product + niche minimum
    const fields = ['product', 'niche', 'language', 'market'];
    for (const f of fields) {
      const input = page.locator(`input[placeholder*="${f}" i], input[name*="${f}" i]`).first();
      if (await input.count()) await input.fill(`e2e-${f}`);
    }
    await page.locator('button[type="submit"]').first().click();

    await expect(page).toHaveURL(/\/project\/[a-f0-9-]{8,}/i, { timeout: 15_000 });
    await expect(page.locator('body')).toContainText(name);
  });
});
