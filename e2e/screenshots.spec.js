import { test } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { STORAGE_KEYS, TASKS_LABELS_KEY, E2E_AI_STORAGE } from '../src/storageKeys.js';
import { getStorageKey } from '../src/statuses.js';
import { openTemplateLibrary, mockGeminiChatStream } from './helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../docs/images');

const LABELS = [
  { id: 'lbl-work', text: 'Work', color: '#3b82f6' },
  { id: 'lbl-home', text: 'Home', color: '#10b981' },
  { id: 'lbl-errands', text: 'Errands', color: '#f59e0b' },
];

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const emptyRoutine = { enabled: false, frequency: 'weekly', interval: 1, weekdays: [1, 2, 3, 4, 5], endDate: '' };
const emptyReminder = { enabled: false, minutesBefore: 60, snoozedUntil: '' };
function task(overrides) {
  return {
    id: overrides.id,
    name: overrides.name,
    description: overrides.description || '',
    status: overrides.status || 'active',
    priority: 'medium',
    impact: overrides.impact || 'medium',
    urgency: overrides.urgency || '',
    type: overrides.type || '',
    dueDate: overrides.dueDate || '',
    dueTime: '',
    duration: { value: '', unit: 'hour' },
    effort: overrides.effort || { value: '', unit: 'hour' },
    labelIds: overrides.labelIds || [],
    cardColor: '',
    routine: overrides.routine || emptyRoutine,
    reminder: overrides.reminder || emptyReminder,
    lastReminderKey: '',
    boardOrder: overrides.boardOrder ?? 0,
    steps: overrides.steps || [],
    notes: '',
  };
}

const TASKS = [
  task({
    id: 't-fix', name: 'Fix the leaky kitchen faucet', type: 'fix', status: 'active',
    impact: 'high', urgency: 'week', effort: { value: 2, unit: 'hour' },
    dueDate: daysFromNow(3), labelIds: ['lbl-home'],
    reminder: { enabled: true, minutesBefore: 60, snoozedUntil: '' },
    steps: [
      { id: 's1', title: 'Buy replacement washer', status: 'done', notes: '', dueDate: '', duration: { value: '', unit: 'hour' }, effort: { value: '', unit: 'hour' }, labelIds: [] },
      { id: 's2', title: 'Shut off water and swap it in', status: 'todo', notes: '', dueDate: '', duration: { value: '', unit: 'hour' }, effort: { value: '', unit: 'hour' }, labelIds: [] },
    ],
  }),
  task({
    id: 't-buy', name: 'Buy birthday gift for Noa', type: 'buy', status: 'active',
    impact: 'medium', urgency: 'today', dueDate: daysFromNow(0), labelIds: ['lbl-errands'],
  }),
  task({
    id: 't-sync', name: 'Weekly team sync notes', type: 'other', status: 'active',
    impact: 'medium', urgency: 'week', labelIds: ['lbl-work'],
    routine: { enabled: true, frequency: 'weekly', interval: 1, weekdays: [1], endDate: '' },
  }),
  task({
    id: 't-order', name: 'Order a new laptop charger', type: 'order', status: 'on_hold',
    impact: 'low', labelIds: ['lbl-work'],
  }),
  task({
    id: 't-throw', name: 'Throw out the old moving boxes', type: 'throw', status: 'completed',
    impact: 'low', labelIds: ['lbl-home'],
  }),
  task({
    id: 't-call', name: 'Call the dentist to reschedule', type: 'call', status: 'active',
    impact: 'high', urgency: 'now', effort: { value: 10, unit: 'minute' }, labelIds: ['lbl-home'],
  }),
  task({
    id: 't-email', name: 'Email the quarterly report', type: 'email', status: 'active',
    impact: 'high', urgency: 'week', dueDate: daysFromNow(-2), labelIds: ['lbl-work'],
  }),
  task({
    id: 't-clean', name: 'Clean out the garage', type: 'clean', status: 'cancelled',
    impact: 'low', labelIds: ['lbl-home'],
  }),
  task({
    id: 't-research', name: 'Research summer vacation options', type: 'research', status: 'active',
    impact: 'medium', urgency: 'month', dueDate: daysFromNow(10), labelIds: ['lbl-errands'],
  }),
];

/** Seed a realistic board (tasks + shared labels) before the welcome modal check. */
async function seedTasks(page) {
  await page.addInitScript(
    ({ storageKey, tasks, labelsKey, labels, welcomeKey }) => {
      localStorage.clear();
      localStorage.setItem(welcomeKey, '1');
      localStorage.setItem(storageKey, JSON.stringify(tasks));
      localStorage.setItem(labelsKey, JSON.stringify(labels));
    },
    {
      storageKey: getStorageKey('tasks'),
      tasks: TASKS,
      labelsKey: TASKS_LABELS_KEY,
      labels: LABELS,
      welcomeKey: STORAGE_KEYS.tasksWelcome,
    },
  );
}

test.describe('capture README screenshots', () => {
  test.skip(!!process.env.CI, 'Run locally to regenerate README screenshots');

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  async function snap(page, filename) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: 1280, height: Math.max(height, 900) });
    await page.screenshot({ path: path.join(OUT_DIR, filename), animations: 'disabled' });
  }

  test('list & edit view', async ({ page }) => {
    await seedTasks(page);
    await page.goto('/');
    await page.getByRole('button', { name: /List & Edit/i }).click();
    await page.getByText('Fix the leaky kitchen faucet').waitFor();

    await snap(page, 'list-view.png');
  });

  test('priority view', async ({ page }) => {
    await seedTasks(page);
    await page.goto('/');
    await page.getByRole('button', { name: /^Priority$/i }).click();
    await page.getByText(/Quick Wins/i).waitFor();

    await snap(page, 'priority-view.png');
  });

  test('by-type view', async ({ page }) => {
    await seedTasks(page);
    await page.goto('/');
    await page.getByRole('button', { name: /^By Type$/i }).click();
    await page.getByText('Call the dentist to reschedule').waitFor();

    await snap(page, 'type-view.png');
  });

  test('timeline view', async ({ page }) => {
    await seedTasks(page);
    await page.goto('/');
    await page.getByRole('button', { name: /^Timeline$/i }).click();
    await page.getByText('Fix the leaky kitchen faucet').first().waitFor();

    await snap(page, 'timeline-view.png');
  });

  test('calendar view', async ({ page }) => {
    await seedTasks(page);
    await page.goto('/');
    await page.getByRole('button', { name: /^Calendar$/i }).click();
    await page.getByText('Buy birthday gift for Noa').first().waitFor();

    await snap(page, 'calendar-view.png');
  });

  test('AI coaching chat', async ({ page }) => {
    const reply = "Let's break \"Research summer vacation options\" into three concrete steps you can start today.";
    await mockGeminiChatStream(page, reply);
    await seedTasks(page);
    await page.addInitScript((aiStorage) => {
      Object.entries(aiStorage).forEach(([key, value]) => localStorage.setItem(key, value));
    }, E2E_AI_STORAGE);
    await page.goto('/');

    await openTemplateLibrary(page);
    await page.getByRole('button', { name: /Practice with AI coach/i }).first().click();
    await page.getByText(reply).waitFor({ timeout: 15_000 });

    await snap(page, 'ai-coach.png');
  });
});
