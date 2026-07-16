import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'fs';

const BROWSER_CANDIDATES = [
  '/opt/pw-browsers/chromium-1223/chrome-linux64/chrome',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
];
const executablePath = BROWSER_CANDIDATES.find(p => existsSync(p));

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:5199',
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
    ...(executablePath ? { executablePath } : {}),
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5199 --strictPort',
    url: 'http://127.0.0.1:5199',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
