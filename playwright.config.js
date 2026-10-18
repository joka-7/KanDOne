import { defineConfig, devices } from '@playwright/test';

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
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5199 --strictPort',
    url: 'http://127.0.0.1:5199',
    // A client ID (public, not a secret) turns on the Drive controls so the
    // signed-in flows can run against a faked Drive.
    env: { VITE_GOOGLE_CLIENT_ID: 'e2e-client.apps.googleusercontent.com' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
