import { test, expect } from '@playwright/test';
import { login } from './_helpers';

test.describe('Agent chat room (Phase V)', () => {
  test.skip(process.env.NEXT_PUBLIC_CONVERSATIONS_ENABLED !== '1', 'Phase V disabled');

  test('start conversation, post message, see agent reply', async ({ page }) => {
    await login(page);
    const projectLink = page.locator('a[href^="/project/"]').first();
    if (!(await projectLink.count())) test.skip(true, 'no projects exist');
    await projectLink.click();
    const url = page.url();
    const projectId = url.match(/\/project\/([a-f0-9-]+)/)?.[1];
    expect(projectId).toBeTruthy();

    await page.goto(`/project/${projectId}/agent-chat`);
    await page.fill('input[placeholder*="topic" i]', 'e2e test topic');
    await page.fill('textarea[placeholder*="first message" i]', '@marcus what\'s your take on senior dog probiotics?');
    await page.locator('button:has-text("Start conversation")').click();

    // Wait up to 90s for at least one agent message to land
    await expect(page.locator('[data-msg-agent], .bg-purple-500').first()).toBeVisible({ timeout: 90_000 });

    // Close conversation
    await page.locator('button:has-text("Close conversation")').click();
    await page.locator('button:has-text("OK")').click().catch(() => { /* no confirm dialog */ });
    await expect(page.locator('text=/Conversation closed/i')).toBeVisible({ timeout: 30_000 });
  });
});
