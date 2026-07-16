import { test, expect } from '@playwright/test';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  initTasksApp, fillLabeledInput, selectLabeledOption, saveForm, goToBoardTab, goToListTab,
  acceptNextDialog, dragCardToColumn, selectListTask,
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
});
