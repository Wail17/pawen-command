// Playwright config — E2E smoke tests. Requires:
//   npm install --save-dev @playwright/test
//   npx playwright install chromium
//
// Tests assume a logged-in admin session against a running dev server.
// Set BASE_URL / APP_PASSWORD / ADMIN_PASSWORD in env before running.

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // serial — shared login state
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
