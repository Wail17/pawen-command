import { test, expect } from '@playwright/test';
import { login } from './_helpers';

test.describe('Login flow', () => {
  test('wrong password shows error', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="password"]', 'definitely-wrong-' + Date.now());
    await page.press('input[type="password"]', 'Enter');
    await expect(page.locator('text=/incorrect|invalid|wrong/i')).toBeVisible({ timeout: 10_000 });
  });

  test('correct password → user picker → dashboard', async ({ page }) => {
    await login(page);
    await expect(page.locator('body')).toContainText(/Pawen|Projects|Dashboard/i);
  });

  test('session persists across reload', async ({ page, context }) => {
    await login(page);
    const cookies = await context.cookies();
    expect(cookies.find(c => c.name.includes('session'))).toBeTruthy();
    await page.reload();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });
});
