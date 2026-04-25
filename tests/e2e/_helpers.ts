// Shared helpers for E2E specs.
// Exports: `login` which handles the two-step auth flow (password → user pick).

import { Page, expect } from '@playwright/test';

export async function login(page: Page, opts: { appPassword?: string } = {}): Promise<void> {
  const appPassword = opts.appPassword ?? process.env.APP_PASSWORD;
  if (!appPassword) throw new Error('APP_PASSWORD env var required');

  await page.goto('/');
  // Step 1: password
  await page.fill('input[type="password"]', appPassword);
  await page.press('input[type="password"]', 'Enter');
  // Step 2: user picker — click first admin-tagged user if present, else first user
  await page.waitForSelector('[data-user-pick], button:has-text("Sykss")', { timeout: 10_000 });
  const sykss = page.locator('button:has-text("Sykss")').first();
  if (await sykss.count()) {
    await sykss.click();
  } else {
    await page.locator('[data-user-pick]').first().click();
  }
  await expect(page).toHaveURL(/\/(?!login)/);
}

export async function loginAdmin(page: Page): Promise<void> {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) throw new Error('ADMIN_PASSWORD env var required');
  await page.goto('/admin');
  await page.fill('input[type="password"]', pw);
  await page.press('input[type="password"]', 'Enter');
  await expect(page.locator('text=God Panel,text=Scraping Health,text=Persona Distillations').first()).toBeVisible({ timeout: 10_000 });
}

export function uniqueProjectName(prefix = 'e2e'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
