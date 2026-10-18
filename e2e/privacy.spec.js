import { test, expect } from '@playwright/test';
import { initTasksApp } from './helpers.js';

test.describe('Privacy page', () => {
  test('is one tap from the main screen and says what leaves the device', async ({ page }) => {
    await initTasksApp(page);
    await page.goto('/');
    await page.getByRole('heading', { name: 'KanDOne', exact: true }).waitFor();

    await page.getByRole('link', { name: 'Privacy' }).click();

    await expect(page).toHaveURL(/\/privacy\.html$/);
    await expect(page.getByRole('heading', { level: 1, name: /Privacy/i })).toBeVisible();
    await expect(page.getByText(/hidden app folder in your own Google Drive/i)).toBeVisible();
    await expect(page.getByText(/AI provider you choose/i)).toBeVisible();
    await page.getByRole('link', { name: /Back to KanDOne/i }).click();
    await expect(page.getByRole('heading', { name: 'KanDOne', exact: true })).toBeVisible();
  });
});
