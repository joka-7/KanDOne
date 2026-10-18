import { test, expect } from '@playwright/test';
import { goToBoardTab, dragCardToColumn } from './helpers.js';

/** A minimal in-memory Google Drive appDataFolder behind the API URLs the app calls. */
async function routeFakeDrive(page) {
  const files = {};
  let created = 0;
  await page.route('https://openidconnect.googleapis.com/**', (route) => route.fulfill({
    json: { sub: 'u1', email: 'a@b.c', name: 'A B' },
  }));
  await page.route('https://www.googleapis.com/**', async (route) => {
    const request = route.request();
    const url = request.url();
    if (url.includes('/upload/') && request.method() === 'POST') {
      created += 1;
      const parts = request.postData().split('\r\n');
      files[`f${created}`] = { name: JSON.parse(parts[3]).name, body: parts[7] };
      return route.fulfill({ json: { id: `f${created}` } });
    }
    if (url.includes('/upload/')) {
      files[url.match(/files\/([^?]+)/)[1]].body = request.postData();
      return route.fulfill({ json: {} });
    }
    if (url.includes('alt=media')) {
      return route.fulfill({ body: files[decodeURIComponent(url.match(/files\/([^?]+)/)[1])].body });
    }
    const listed = Object.entries(files).map(([id, f]) => ({ id, name: f.name, modifiedTime: new Date().toISOString() }));
    return route.fulfill({ json: { files: listed } });
  });
}

test.describe('Signed in to Google Drive (fake Drive)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.clear();
      localStorage.setItem('hasCompletedOnboarding_tasks', '1');
      localStorage.setItem('kandone_drive_session_v1', JSON.stringify({
        accessToken: 'token', expiresAt: Date.now() + 3_600_000,
        user: { uid: 'u1', email: 'a@b.c', displayName: 'A B' },
      }));
      localStorage.setItem('jobTrackerAppV2Data_tasks', JSON.stringify([
        { id: 'x1', name: 'Drag Me', status: 'active', steps: [] },
      ]));
    });
    await routeFakeDrive(page);
  });

  test('a card dragged to another column stays there after the sync and a reload', async ({ page }) => {
    await page.goto('/');
    await goToBoardTab(page);
    await dragCardToColumn(page, 'Drag Me', /^On Hold$/);
    const onHold = () => page.locator('.board-column').filter({ has: page.getByText(/^On Hold$/) });
    await expect(onHold().getByText('Drag Me')).toBeVisible();

    await page.getByRole('button', { name: /Sync Now/i }).first().click();
    await page.reload();
    await goToBoardTab(page);

    await expect(onHold().getByText('Drag Me')).toBeVisible();
  });
});
