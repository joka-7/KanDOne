import { test, expect, devices } from '@playwright/test';
import { initTasksApp } from './helpers.js';

const APK_URL = 'https://github.com/joka-7/KanDOne/releases/latest/download/KanDOne.apk';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const { userAgent: PIXEL_UA, viewport: PIXEL_VIEWPORT } = devices['Pixel 7'];
const apkLink = (page) => page.getByRole('link', { name: /Android app/i });

async function openApp(page) {
  await initTasksApp(page);
  await page.goto('/');
  await page.getByRole('heading', { name: 'KanDOne', exact: true }).waitFor();
}

test.describe('Android app offer on the website', () => {
  test.describe('in an Android browser', () => {
    test.use({ userAgent: PIXEL_UA, viewport: PIXEL_VIEWPORT, isMobile: true, hasTouch: true });

    test('the menu entry next to Install App links to the latest APK', async ({ page }) => {
      await openApp(page);
      await page.getByRole('button', { name: /more options/i }).click();

      await expect(page.getByRole('button', { name: /Install App/i })).toBeVisible();
      await expect(apkLink(page)).toBeVisible();
      await expect(apkLink(page)).toHaveAttribute('href', APK_URL);
    });
  });

  test.describe('in an Android browser on a wide screen', () => {
    test.use({ userAgent: PIXEL_UA, viewport: { width: 1280, height: 800 } });

    test('the header button next to Install App links to the latest APK', async ({ page }) => {
      await openApp(page);

      await expect(page.getByRole('button', { name: /Install App/i }).first()).toBeVisible();
      await expect(apkLink(page).first()).toHaveAttribute('href', APK_URL);
    });
  });

  test.describe('anywhere else', () => {
    test('no APK link on a desktop browser', async ({ page }) => {
      await openApp(page);

      await expect(page.getByRole('button', { name: /Install App/i }).first()).toBeVisible();
      await expect(apkLink(page)).toHaveCount(0);
    });

    test.describe('on an iPhone', () => {
      test.use({ userAgent: IPHONE_UA, viewport: { width: 390, height: 844 } });

      test('no APK link', async ({ page }) => {
        await openApp(page);
        await page.getByRole('button', { name: /more options/i }).click();

        await expect(page.getByRole('button', { name: /Install App/i })).toBeVisible();
        await expect(apkLink(page)).toHaveCount(0);
      });
    });
  });
});
