import { test, expect } from '@playwright/test';
import { initTasksApp, goToBoardTab, goToCalendarTab, goToListTab } from './helpers.js';

test.describe('Back button', () => {
  test.beforeEach(async ({ page }) => {
    await initTasksApp(page);
    await page.goto('/');
    await goToBoardTab(page);
  });

  test('goes back to the previous tab instead of leaving the app', async ({ page }) => {
    await goToListTab(page);
    await goToCalendarTab(page);
    const current = () => page.locator('button[aria-current="page"]');

    await page.goBack();
    await expect(current()).toHaveText(/List/);
    await page.goBack();
    await expect(current()).toHaveText(/Status Board/);

    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('closes the new-task form instead of leaving the page', async ({ page }) => {
    await page.getByRole('button', { name: /Add Task/i }).click();
    await expect(page.getByRole('button', { name: /Save Changes/i })).toBeVisible();

    await page.goBack();

    await expect(page.getByRole('button', { name: /Save Changes/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Status Board/i })).toBeVisible();
  });
});
