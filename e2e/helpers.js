import { E2E_AI_STORAGE } from '../src/storageKeys.js';

/** Clear app state before each test so the welcome modal appears. */
export async function clearAppStorage(page) {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/** Pre-set KanDOne and skip the welcome modal (for flow tests). */
export async function initTasksApp(page) {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('hasCompletedOnboarding_tasks', '1');
  });
}

export async function fillLabeledInput(page, labelPattern, value) {
  const label = page.locator('label').filter({ hasText: labelPattern }).first();
  await label.locator('xpath=following-sibling::input | following-sibling::textarea').first().fill(value);
}

export async function fillPlaceholderInput(page, placeholderPattern, value) {
  await page.getByPlaceholder(placeholderPattern).fill(value);
}

export async function selectLabeledOption(page, labelPattern, value) {
  const label = page.locator('label').filter({ hasText: labelPattern }).first();
  await label.locator('xpath=following-sibling::select').first().selectOption(value);
}

export async function saveForm(page) {
  await page.getByRole('button', { name: /Save Changes/i }).click();
}

export async function goToBoardTab(page) {
  await page.getByRole('button', { name: /Status Board/i }).click();
}

export async function goToListTab(page) {
  await page.getByRole('button', { name: /List & Edit/i }).click();
}

export async function goToCalendarTab(page) {
  await page.getByRole('button', { name: /^Calendar$/i }).click();
}

export async function selectListTask(page, name) {
  await page.locator('button').filter({ has: page.locator('p', { hasText: name }) }).first().click();
}

export async function acceptNextDialog(page) {
  page.once('dialog', (dialog) => dialog.accept());
}

/** Drag a kanban card into a column identified by its status header text. */
export async function dragCardToColumn(page, cardName, columnHeaderPattern) {
  const card = page.getByTestId('board-task-card').filter({ hasText: cardName });
  const column = page.locator('.board-column').filter({ has: page.getByText(columnHeaderPattern) });
  await expectVisible(card);
  await expectVisible(column);
  const from = await card.boundingBox();
  const to = await column.boundingBox();
  if (!from || !to) throw new Error('dragCardToColumn: missing bounding boxes');
  // Pointer path with enough steps for dnd-kit PointerSensor (distance: 8).
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + Math.min(to.height / 2, 80), { steps: 25 });
  await page.mouse.up();
}

async function expectVisible(locator) {
  await locator.waitFor({ state: 'visible' });
}

/** Configure localStorage so isAIReady() is true (gemini + fake key). */
export async function initMockAI(page) {
  await page.addInitScript(({ aiStorage }) => {
    Object.entries(aiStorage).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
  }, { aiStorage: E2E_AI_STORAGE });
}

/** Mock Gemini streaming API — avoids real network and API keys in e2e. */
export async function mockGeminiChatStream(page, replyText = 'Mock AI reply for e2e.') {
  const chunk = JSON.stringify({
    candidates: [{ content: { parts: [{ text: replyText }] } }],
  });
  const sseBody = `data: ${chunk}\n\n`;
  await page.route('**/generativelanguage.googleapis.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: sseBody,
    });
  });
}

export async function openTemplateLibrary(page) {
  await page.getByTestId('open-templates').first().click();
  await page.getByRole('heading', { name: /Task Planning Prompts/i }).waitFor();
}

export async function closeChatModal(page) {
  const modal = page.locator('[data-testid="chat-modal"]');
  await modal.getByRole('button', { name: 'Close' }).click();
}
