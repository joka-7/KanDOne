import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { clearAppStorage, initTasksApp } from './helpers.js';

async function expectNoSeriousA11yViolations(page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

test.describe('Accessibility (WCAG AA)', () => {
  test('html lang/dir follow the selected language', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem('hasCompletedOnboarding_tasks', '1');
      localStorage.setItem('appLanguage', 'he');
    });
    await page.goto('/');
    await page.getByRole('heading', { name: 'KanDOne', exact: true }).waitFor();

    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('welcome onboarding is a dialog with no serious axe violations', async ({ page }) => {
    await clearAppStorage(page);
    await page.goto('/');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog.getByRole('heading', { name: 'Welcome to KanDOne!' })).toBeVisible();

    await expectNoSeriousA11yViolations(page);
  });

  test('main board has no serious axe violations', async ({ page }) => {
    await initTasksApp(page);
    await page.goto('/');
    await page.getByRole('heading', { name: 'KanDOne', exact: true }).waitFor();

    await expect(page.getByRole('button', { name: /Add Task/i })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test('settings modal is a dialog and Escape closes it', async ({ page }) => {
    await initTasksApp(page);
    await page.goto('/');
    await page.getByRole('heading', { name: 'KanDOne', exact: true }).waitFor();

    // Locale key header.aiSettings is "Settings" (not "AI Settings").
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('header icon buttons expose accessible names', async ({ page }) => {
    await initTasksApp(page);
    await page.goto('/');
    await page.getByRole('heading', { name: 'KanDOne', exact: true }).waitFor();

    await expect(page.getByRole('button', { name: 'Goals & Tasks AI', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quick Tour', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
  });
});
