import { test, expect } from '@playwright/test';
import { clearAppStorage } from './helpers.js';

test.describe('Welcome onboarding', () => {
  test('first visit shows welcome modal', async ({ page }) => {
    await clearAppStorage(page);
    await page.goto('/');

    const modal = page.locator('.fixed.inset-0').filter({ has: page.getByRole('button', { name: /Skip tutorial/i }) });
    await expect(modal.getByRole('heading', { name: 'Welcome to KanDOne!' })).toBeVisible();
    await expect(modal.getByRole('button', { name: /Skip tutorial/i })).toBeVisible();
  });

  test('skip tutorial dismisses welcome modal', async ({ page }) => {
    await clearAppStorage(page);
    await page.goto('/');

    await page.getByRole('button', { name: /Skip tutorial/i }).click();
    await expect(page.getByRole('button', { name: /Skip tutorial/i })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'KanDOne', exact: true })).toBeVisible();
  });
});
