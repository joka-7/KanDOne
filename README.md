# KanDOne

A standalone Kanban task-management app — ported from the **Tasks mode** of JobFlowTracker into its own repo.

Plan work as tasks with sub-steps, track progress across a Kanban board, list, timeline,
calendar and stats views, with optional AI coaching and Firebase cloud sync. Offline-first
(localStorage), installable as a PWA, and localized in English, Hebrew (RTL) and French.

## Stack

React 19 · Vite · Tailwind CSS · i18next · Firebase (Auth + Firestore) · Vitest

## Getting started

```bash
npm install
npm run dev      # start dev server (http://localhost:5173)
npm run build    # production build
npm test         # run unit tests
npm run lint     # eslint
```

## What was carried over

Everything the Tasks feature needs, standalone:

- `TasksApp.jsx` — the full tasks UI (board / list / timeline / calendar / stats)
- Task data model + persistence: `sanitize.js`, `storageKeys.js`, `statuses.js`, `firebase.js`
- AI coaching: `services/aiAssistant.js`, `components/ChatModal.jsx`, template prompts
- Supporting UI: `CalendarView`, `TemplateLibrary`, `APIKeySettings`, `Onboarding`, `AppBrandMark`
- i18n: `en` / `he` / `fr` locales

The multi-mode architecture (jobseeker / recruiter modes, mode selection screen, mode
switcher/dropdown) was removed — `App.jsx` boots straight into the tasks view.

## Notes

- `src/firebase.js` points at the `kandone-a6c91` Firebase project (the config is a public
  web API key, not a secret). The app works fully offline without it.
