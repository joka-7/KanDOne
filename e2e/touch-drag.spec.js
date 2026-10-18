import { test, expect } from '@playwright/test';
import { goToBoardTab } from './helpers.js';

test.use({
  viewport: { width: 393, height: 800 },
  hasTouch: true,
  isMobile: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
});

test('a long press and drag on a phone moves a card to another column', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('hasCompletedOnboarding_tasks', '1');
    localStorage.setItem('jobTrackerAppV2Data_tasks', JSON.stringify([
      { id: 'x1', name: 'Drag Me', status: 'active', steps: [] },
    ]));
  });
  await page.goto('/');
  await goToBoardTab(page);
  const card = page.getByTestId('board-task-card').filter({ hasText: 'Drag Me' });
  const onHold = page.locator('.board-column').filter({ has: page.getByText(/^On Hold$/) });
  await card.scrollIntoViewIfNeeded();
  const from = await card.boundingBox();
  const to = await onHold.boundingBox();

  // Real touch input: Playwright's mouse would take the pointer path instead.
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
  });
  const x = from.x + from.width / 2;
  const y = from.y + from.height / 2;
  const targetY = to.y + 60;
  await touch('touchStart', x, y);
  await page.waitForTimeout(350);
  for (let step = 1; step <= 20; step += 1) {
    await touch('touchMove', x, y + ((targetY - y) * step) / 20);
    await page.waitForTimeout(20);
  }
  await touch('touchEnd');

  await expect(onHold.getByText('Drag Me')).toBeVisible();
});
