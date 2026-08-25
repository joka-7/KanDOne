import { test, expect } from '@playwright/test';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  initTasksApp, fillLabeledInput, selectLabeledOption, saveForm, goToBoardTab, goToListTab,
  acceptNextDialog, dragCardToColumn, selectListTask, goToPriorityTab, pickEffort,
} from './helpers.js';

test.describe('KanDOne task flows', () => {
  test.beforeEach(async ({ page }) => {
    await initTasksApp(page);
    await page.goto('/');
    await page.getByRole('heading', { name: 'KanDOne', exact: true }).waitFor();
  });

  test('add task and see on kanban board', async ({ page }) => {
    await page.getByRole('button', { name: /Add Task/i }).click();
    await fillLabeledInput(page, /Task Name/i, 'Ship release');
    await saveForm(page);

    await goToBoardTab(page);
    await expect(page.getByText('Ship release')).toBeVisible();
    await expect(page.getByText(/^Active/i)).toBeVisible();
  });

  test('task data persists in localStorage', async ({ page }) => {
    await page.getByRole('button', { name: /Add Task/i }).click();
    await fillLabeledInput(page, /Task Name/i, 'Persist Me');
    await saveForm(page);

    const stored = await page.evaluate(() => localStorage.getItem('jobTrackerAppV2Data_tasks'));
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored).some(t => t.name === 'Persist Me')).toBe(true);
  });

  test('keyboard shortcut N opens add form', async ({ page }) => {
    await page.keyboard.press('n');
    await expect(page.getByRole('heading', { name: /Add New Task/i })).toBeVisible();
  });

  test('export downloads JSON backup', async ({ page }) => {
    await page.getByRole('button', { name: /Add Task/i }).click();
    await fillLabeledInput(page, /Task Name/i, 'Export Test');
    await saveForm(page);

    await page.evaluate(() => { delete window.showSaveFilePicker; });

    const downloadPromise = page.waitForEvent('download');
    await page.getByTitle(/Download backup/i).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/tasks-backup.*\.json/);
  });

  test('import JSON backup loads tasks', async ({ page }) => {
    const filePath = join(tmpdir(), `kandone-import-${Date.now()}.json`);
    await writeFile(filePath, JSON.stringify([
      { id: 'import-1', name: 'Imported Task', status: 'active', steps: [] },
    ]));

    await page.locator('input[type="file"]').first().setInputFiles(filePath);
    await expect(page.getByText('File loaded successfully!')).toBeVisible();
    await goToBoardTab(page);
    await expect(page.getByText('Imported Task')).toBeVisible();

    await unlink(filePath);
  });

  test('drag task to on hold column on board', async ({ page }) => {
    await page.getByRole('button', { name: /Add Task/i }).click();
    await fillLabeledInput(page, /Task Name/i, 'On Hold Anchor');
    await selectLabeledOption(page, /^Status$/i, 'on_hold');
    await saveForm(page);

    await page.getByRole('button', { name: /Add Task/i }).click();
    await fillLabeledInput(page, /Task Name/i, 'Drag Task');
    await saveForm(page);

    await goToBoardTab(page);
    await dragCardToColumn(page, 'Drag Task', /^On Hold$/);

    const onHoldCol = page.locator('.board-column').filter({ has: page.getByText(/^On Hold$/) });
    await expect(onHoldCol.getByText('Drag Task')).toBeVisible();
  });

  test('edit task updates name on board', async ({ page }) => {
    await page.getByRole('button', { name: /Add Task/i }).click();
    await fillLabeledInput(page, /Task Name/i, 'Before Edit');
    await saveForm(page);

    await goToListTab(page);
    await selectListTask(page, 'Before Edit');
    await page.getByRole('button', { name: /Edit Details/i }).click();
    await fillLabeledInput(page, /Task Name/i, 'After Edit');
    await saveForm(page);

    await goToBoardTab(page);
    await expect(page.getByText('After Edit')).toBeVisible();
    await expect(page.getByText('Before Edit')).toHaveCount(0);
  });

  test('delete task removes from list and board', async ({ page }) => {
    await page.getByRole('button', { name: /Add Task/i }).click();
    await fillLabeledInput(page, /Task Name/i, 'Delete Me');
    await saveForm(page);

    await goToListTab(page);
    await selectListTask(page, 'Delete Me');
    acceptNextDialog(page);
    await page.getByRole('button', { name: /Edit Details/i }).locator('xpath=..').getByRole('button').last().click();
    await expect(page.getByText('Task deleted.')).toBeVisible();

    await expect(page.getByText('Delete Me')).toHaveCount(0);
    await goToBoardTab(page);
    await expect(page.getByText('Delete Me')).toHaveCount(0);
  });

  test('past due date is flagged as overdue on the board', async ({ page }) => {
    await page.getByRole('button', { name: /Add Task/i }).click();
    await fillLabeledInput(page, /Task Name/i, 'Late report');
    await page.locator('input[type="date"]').first().fill('2020-01-15');
    await saveForm(page);

    await goToBoardTab(page);
    const card = page.getByTestId('board-task-card').filter({ hasText: 'Late report' });
    await expect(card.getByText('· Overdue')).toBeVisible();
  });

  test('undo restores a deleted task', async ({ page }) => {
    await page.getByRole('button', { name: /Add Task/i }).click();
    await fillLabeledInput(page, /Task Name/i, 'Undo Me');
    await saveForm(page);

    await goToListTab(page);
    await selectListTask(page, 'Undo Me');
    acceptNextDialog(page);
    await page.getByRole('button', { name: /Edit Details/i }).locator('xpath=..').getByRole('button').last().click();
    await expect(page.getByText('Task deleted.')).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('Undo Me')).toBeVisible();
  });

  test('a big-impact small-effort task is flagged BISE and ranked as a quick win', async ({ page }) => {
    await page.getByRole('button', { name: /Add Task/i }).click();
    await fillLabeledInput(page, /Task Name/i, 'Reply to Dana');
    await selectLabeledOption(page, /^Impact$/i, 'high');
    // 30 minutes — inside the default "small effort" cut-point.
    await pickEffort(page, 'Minutes', 30);
    await page.getByRole('button', { name: /^This week$/i }).click();
    await saveForm(page);

    await goToPriorityTab(page);
    const row = page.getByTestId('priority-task-row').filter({ hasText: 'Reply to Dana' });
    await expect(row).toBeVisible();
    await expect(row.getByText('BISE')).toBeVisible();

    // It belongs under Quick Wins, not Big Projects.
    const quickWins = page.locator('section').filter({ hasText: /Quick Wins/i });
    await expect(quickWins.getByText('Reply to Dana')).toBeVisible();
  });

  test('the When quick-pick fills the due date', async ({ page }) => {
    await page.getByRole('button', { name: /Add Task/i }).click();
    await fillLabeledInput(page, /Task Name/i, 'Dated by quick pick');
    await page.getByRole('button', { name: /^Today$/i }).click();

    const dueLabel = page.locator('label').filter({ hasText: /Due Date/i }).first();
    const due = dueLabel.locator('xpath=following-sibling::input').first();
    const today = new Date();
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    await expect(due).toHaveValue(expected);
  });

  test('effort, impact and urgency round-trip through storage and back into the form', async ({ page }) => {
    await page.getByRole('button', { name: /Add Task/i }).click();
    await fillLabeledInput(page, /Task Name/i, 'Round Trip');
    await selectLabeledOption(page, /^Impact$/i, 'high');
    await pickEffort(page, 'Minutes', 30);
    await page.getByRole('button', { name: /^This week$/i }).click();
    await saveForm(page);

    // sanitize.js whitelists fields, so a field missing there is dropped on
    // save. Assert against what actually landed in storage.
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('jobTrackerAppV2Data_tasks')));
    const task = stored.find(t => t.name === 'Round Trip');
    expect(task.impact).toBe('high');
    expect(task.urgency).toBe('week');
    expect(task.effort).toEqual({ value: 30, unit: 'minute' });

    // ...and that reopening the task shows those values again.
    await goToListTab(page);
    await selectListTask(page, 'Round Trip');
    await page.getByRole('button', { name: /Edit Details/i }).click();
    const impact = page.locator('label').filter({ hasText: /^Impact$/i }).first()
      .locator('xpath=following-sibling::select').first();
    await expect(impact).toHaveValue('high');
    await expect(page.getByRole('radio', { name: /^30 Minutes/i })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('button', { name: /^This week$/i })).toHaveAttribute('aria-pressed', 'true');
  });

  test('sorting the list by priority score puts the most urgent first', async ({ page }) => {
    await page.getByRole('button', { name: /Add Task/i }).click();
    await fillLabeledInput(page, /Task Name/i, 'Someday Thing');
    await selectLabeledOption(page, /^Impact$/i, 'low');
    await page.getByRole('button', { name: /^Someday$/i }).click();
    await saveForm(page);

    await page.getByRole('button', { name: /Add Task/i }).click();
    await fillLabeledInput(page, /Task Name/i, 'Urgent Thing');
    await selectLabeledOption(page, /^Impact$/i, 'high');
    await page.getByRole('button', { name: /^Now$/i }).click();
    await saveForm(page);

    await goToListTab(page);
    await page.getByLabel(/Sort by/i).selectOption('score');

    const names = await page.locator('button p.font-semibold').allInnerTexts();
    expect(names.indexOf('Urgent Thing')).toBeLessThan(names.indexOf('Someday Thing'));
  });
});
