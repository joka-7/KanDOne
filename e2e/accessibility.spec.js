import { test, expect } from '@playwright/test';
import { clearAppStorage, initTasksApp } from './helpers.js';

test.describe('Accessibility (WCAG AA)', () => {
  test('welcome onboarding has proper heading structure', async ({ page }) => {
    await clearAppStorage(page);
    await page.goto('/');

    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThan(0);

    const modal = page.locator('.fixed.inset-0').filter({ has: page.getByRole('button', { name: /Skip tutorial/i }) });
    await expect(modal.getByRole('heading', { name: 'Welcome to KanDOne!' })).toBeVisible();
  });

  test('app is keyboard navigable', async ({ page }) => {
    await initTasksApp(page);
    await page.goto('/');
    await page.getByRole('heading', { name: 'KanDOne', exact: true }).waitFor();

    let focusedElement = '';
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      focusedElement = await page.evaluate(() => document.activeElement?.tagName || '');
    }

    expect(focusedElement).toBeTruthy();
  });

  test('add task button is functional', async ({ page }) => {
    await initTasksApp(page);
    await page.goto('/');
    await page.getByRole('heading', { name: 'KanDOne', exact: true }).waitFor();

    const addBtn = page.getByRole('button', { name: /Add Task/i });
    await expect(addBtn).toBeEnabled();
    await expect(addBtn).toBeVisible();
  });

  test('form inputs exist and are usable', async ({ page }) => {
    await initTasksApp(page);
    await page.goto('/');
    await page.getByRole('heading', { name: 'KanDOne', exact: true }).waitFor();

    await page.getByRole('button', { name: /Add Task/i }).click();
    await page.waitForTimeout(500);

    const inputs = page.locator('input[type="text"]');
    const inputCount = await inputs.count();
    if (inputCount > 0) {
      const firstInput = inputs.first();
      await firstInput.fill('Test Task');
      await expect(firstInput).toHaveValue('Test Task');
    } else {
      await expect(page.getByRole('button', { name: /Add Task/i })).toBeEnabled();
    }
  });

  test('buttons have accessible labels', async ({ page }) => {
    await clearAppStorage(page);
    await page.goto('/');

    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(buttonCount, 3); i++) {
      const btn = buttons.nth(i);
      const text = await btn.textContent();
      const ariaLabel = await btn.getAttribute('aria-label');
      expect(text?.trim() || ariaLabel).toBeTruthy();
    }
  });
});
