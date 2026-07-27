import { test, expect } from '@playwright/test';
import { initTasksApp, goToCalendarTab } from './helpers.js';

// KanDOne has no dark-mode toggle — the whole app is styled for a light
// background only. The Calendar view used to carry a handful of Tailwind
// `dark:` classes (removed in this change) that only ever activated when the
// OS/browser preferred a dark color scheme, fighting the `.calendar-force-light`
// CSS that intentionally keeps the calendar readable in that situation (e.g.
// `dark:text-white` text over the forced-white background was invisible).
// These tests emulate `prefers-color-scheme: dark` and assert the calendar
// stays legible, guarding against that class of regression.
test.describe('Dark Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await initTasksApp(page);
    await page.goto('/');
    await page.getByRole('heading', { name: 'KanDOne', exact: true }).waitFor();
  });

  test('keeps the calendar grid light and legible when the OS prefers dark mode', async ({ page }) => {
    await goToCalendarTab(page);

    const monthTitle = page.locator('.calendar-month-title');
    await expect(monthTitle).toBeVisible();

    const colors = await monthTitle.evaluate((el) => {
      const wrapper = el.closest('.calendar-force-light');
      return {
        wrapperBg: getComputedStyle(wrapper).backgroundColor,
        titleColor: getComputedStyle(el).color,
      };
    });

    expect(colors.wrapperBg).toBe('rgb(255, 255, 255)');
    expect(colors.titleColor).toBe('rgb(17, 24, 39)');
  });

  test('keeps the day detail panel text dark (not white-on-white) when a day is selected', async ({ page }) => {
    await goToCalendarTab(page);
    await page.getByRole('button', { name: 'Today' }).click();

    // This heading previously carried `dark:text-white`, which under a real
    // OS dark-mode preference rendered white text on the still-forced-white
    // panel background — effectively invisible.
    const dayHeading = page.locator('.calendar-force-light span.font-medium.text-sm');
    await expect(dayHeading).toBeVisible();
    const color = await dayHeading.evaluate((el) => getComputedStyle(el).color);
    expect(color).not.toBe('rgb(255, 255, 255)');
  });
});
