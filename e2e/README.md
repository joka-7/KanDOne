# E2E tests (Playwright)

```bash
npm run test:e2e
```

Uses `npm run dev` on port 5199 (see `playwright.config.js`).

## KanDOne welcome

`initTasksApp` must set `hasCompletedOnboarding_tasks` (see `STORAGE_KEYS.tasksWelcome` in
`src/storageKeys.js`). Parity is checked by `src/__tests__/storageKeys.e2eParity.test.js`.
