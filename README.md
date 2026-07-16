# KanDOne

A standalone Kanban task-management app — ported from the **Tasks mode** of JobFlowTracker into its own repo.

Plan work as tasks with sub-steps, track progress across a Kanban board, list, timeline,
calendar and stats views, with optional AI coaching and Firebase cloud sync. Offline-first
(localStorage), installable as a PWA, and localized in English, Hebrew (RTL) and French.

## Screenshots

### Kanban board with labels, routines & reminders

![Kanban board showing a routine task with label, due time, and reminder badges](docs/images/board-with-routine-task.png)

### Task form — routines, due time & reminders (Phase B)

![Task edit form with routine schedule, weekday picker, and reminder settings](docs/images/phase-b-task-form.png)

### Task detail — metadata at a glance

![Task detail view showing due datetime, Routine and Reminder badges, and Work label](docs/images/task-detail-routine-reminder.png)

### Statistics — breakdown by label

![Statistics view with By Status and By Label charts](docs/images/stats-by-label.png)

## Features

| Area | Capabilities |
| --- | --- |
| **Core** | Kanban board, list/edit, timeline, calendar, statistics |
| **Steps** | Sub-tasks with status cycling (`todo → in_progress → done → blocked`) |
| **Phase A** | Custom labels & colors, per-task card color, estimated duration, label filter & stats |
| **Phase B** | Optional due time, recurring routine tasks (daily/weekly/monthly), browser reminders |
| **Data** | Auto-save to `localStorage`, JSON backup (tasks + labels), optional Google/Firestore sync |
| **AI** | Task coach, template sessions, goals finder (bring-your-own API key) |
| **PWA** | Installable, works offline once loaded |

### Routine tasks

Mark a task as a **routine** and choose daily, weekly (with weekday picker), or monthly
recurrence. When the task is moved to **Completed** (board drag or save), KanDOne resets
its steps, keeps it **Active**, and advances the due date to the next occurrence.

### Reminders

Enable a **reminder** with an offset (at due time, 15 min … 1 day before). KanDOne
requests browser notification permission and fires reminders while the app is open or
installed as a PWA.

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

## Documentation

- [High Level Design (HLD)](docs/hld/hld.md) — architecture, flows, integrations
- [Low Level Design (LLD)](docs/lld/lld.md) — modules, data shapes, function map

## Project layout (high level)

```
src/
├── TasksApp.jsx              # main UI + state
├── components/
│   ├── LabelPicker.jsx       # label library & chips
│   ├── CardColorPicker.jsx   # card background tint
│   └── RoutineReminderFields.jsx
├── utils/
│   ├── recurrence.js         # routine schedule logic
│   ├── reminders.js          # notification timing
│   └── labelColors.js
├── sanitize.js               # import/localStorage whitelisting
└── locales/                  # en / he / fr
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
- Labels are stored in `localStorage` (`tasksLabelsV1`) and synced to the user
  profile in Firestore (`tasksLabels` field) when signed in; also included in JSON export v2.
- Reminders require the app to be open (or running as an installed PWA); background
  service-worker scheduling is not implemented in v1.
