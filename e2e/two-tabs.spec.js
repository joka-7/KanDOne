import { test, expect } from '@playwright/test';
import { fillLabeledInput, saveForm, goToBoardTab } from './helpers.js';

// Both tabs of one browser share localStorage. Each used to keep its own copy
// of the task list in memory and rewrite the whole list on every change, so the
// tab that saved last silently erased what the other tab had just added.
test.describe('Two tabs of one browser', () => {
  test('keep each other\'s tasks instead of overwriting them', async ({ context }) => {
    // Not initTasksApp: that clears storage on every page load, including the second tab's.
    await context.addInitScript(() => {
      localStorage.setItem('hasCompletedOnboarding_tasks', '1');
    });
    const tabA = await context.newPage();
    const tabB = await context.newPage();
    await tabA.goto('/');
    await tabB.goto('/');

    const addTask = async (page, name) => {
      await page.getByRole('button', { name: /Add Task/i }).click();
      await fillLabeledInput(page, /Task Name/i, name);
      await saveForm(page);
    };

    await addTask(tabA, 'Task from tab A');
    await expect(tabB.getByText('Task from tab A').first()).toBeVisible();
    await addTask(tabB, 'Task from tab B');

    const stored = await tabB.evaluate(
      () => JSON.parse(localStorage.getItem('jobTrackerAppV2Data_tasks')).map((t) => t.name).sort(),
    );
    expect(stored).toEqual(['Task from tab A', 'Task from tab B']);

    await goToBoardTab(tabA);
    await expect(tabA.getByText('Task from tab B')).toBeVisible();
  });
});
