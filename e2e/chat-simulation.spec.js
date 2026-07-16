import { test, expect } from '@playwright/test';
import {
  initTasksApp, initMockAI, mockGeminiChatStream, openTemplateLibrary, closeChatModal,
} from './helpers.js';

const MOCK_REPLY = 'Break this goal into three concrete steps you can start today.';

test.describe('AI coach (browser e2e)', () => {
  test.beforeEach(async ({ page }) => {
    await mockGeminiChatStream(page, MOCK_REPLY);
  });

  test('coaching practice opens chat and receives reply', async ({ page }) => {
    await initTasksApp(page);
    await initMockAI(page);
    await page.goto('/');
    await page.getByRole('heading', { name: 'KanDOne', exact: true }).waitFor();

    await openTemplateLibrary(page);
    await page.getByRole('button', { name: /Practice with AI coach/i }).first().click();

    await expect(page.getByText('AI Coaching')).toBeVisible();
    await expect(page.getByText(MOCK_REPLY)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Something went wrong')).toHaveCount(0);

    await closeChatModal(page);
    await expect(page.getByRole('heading', { name: 'KanDOne', exact: true })).toBeVisible();
  });

  test('AI assistant chat sends message without crashing', async ({ page }) => {
    await initTasksApp(page);
    await initMockAI(page);
    await page.goto('/');
    await page.getByRole('heading', { name: 'KanDOne', exact: true }).waitFor();

    await page.getByTitle(/Task Coach/i).click();

    await expect(page.getByText('Task Coach')).toBeVisible();
    await page.getByTestId('chat-input').fill('Hello coach');
    await page.getByTestId('chat-input').press('Enter');

    await expect(page.getByText('Hello coach')).toBeVisible();
    await expect(page.getByText(MOCK_REPLY)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Something went wrong')).toHaveCount(0);
  });
});
