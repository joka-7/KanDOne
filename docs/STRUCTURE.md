# Repository structure

Every file in this repo and what is inside it. The tree below is **generated** —
run `python .ai/skills/repo_tree/gen_tree.py --project . --output docs/STRUCTURE.md`
to refresh it, and never edit between the markers by hand.

<!-- BEGIN GENERATED TREE (depth=all entries=all) -->
```text
KanDOne/
├── .github/
│   ├── workflows/
│   │   ├── android.yml
│   │   ├── ci.yml
│   │   ├── docs.yml
│   │   └── security.yml
│   ├── copilot-instructions.md        # Copilot's copy of AGENTS.md (generated)
│   ├── dependabot.yml
│   └── pull_request_template.md       # Summary
├── android/                           # Capacitor Android project wrapping the web build (see LLD 6.1a)
│   ├── app/
│   │   ├── src/
│   │   │   └── main/
│   │   │       ├── java/
│   │   │       │   └── io/
│   │   │       │       └── github/
│   │   │       │           └── joka7/
│   │   │       │               └── kandone/
│   │   │       │                   └── MainActivity.java
│   │   │       ├── res/
│   │   │       │   ├── drawable/
│   │   │       │   │   ├── ic_launcher_background.xml
│   │   │       │   │   └── splash.png
│   │   │       │   ├── drawable-land-hdpi/
│   │   │       │   │   └── splash.png
│   │   │       │   ├── drawable-land-mdpi/
│   │   │       │   │   └── splash.png
│   │   │       │   ├── drawable-land-xhdpi/
│   │   │       │   │   └── splash.png
│   │   │       │   ├── drawable-land-xxhdpi/
│   │   │       │   │   └── splash.png
│   │   │       │   ├── drawable-land-xxxhdpi/
│   │   │       │   │   └── splash.png
│   │   │       │   ├── drawable-port-hdpi/
│   │   │       │   │   └── splash.png
│   │   │       │   ├── drawable-port-mdpi/
│   │   │       │   │   └── splash.png
│   │   │       │   ├── drawable-port-xhdpi/
│   │   │       │   │   └── splash.png
│   │   │       │   ├── drawable-port-xxhdpi/
│   │   │       │   │   └── splash.png
│   │   │       │   ├── drawable-port-xxxhdpi/
│   │   │       │   │   └── splash.png
│   │   │       │   ├── drawable-v24/
│   │   │       │   │   └── ic_launcher_foreground.xml
│   │   │       │   ├── layout/
│   │   │       │   │   └── activity_main.xml
│   │   │       │   ├── mipmap-anydpi-v26/
│   │   │       │   │   ├── ic_launcher.xml
│   │   │       │   │   └── ic_launcher_round.xml
│   │   │       │   ├── mipmap-hdpi/
│   │   │       │   │   ├── ic_launcher.png
│   │   │       │   │   ├── ic_launcher_foreground.png
│   │   │       │   │   └── ic_launcher_round.png
│   │   │       │   ├── mipmap-mdpi/
│   │   │       │   │   ├── ic_launcher.png
│   │   │       │   │   ├── ic_launcher_foreground.png
│   │   │       │   │   └── ic_launcher_round.png
│   │   │       │   ├── mipmap-xhdpi/
│   │   │       │   │   ├── ic_launcher.png
│   │   │       │   │   ├── ic_launcher_foreground.png
│   │   │       │   │   └── ic_launcher_round.png
│   │   │       │   ├── mipmap-xxhdpi/
│   │   │       │   │   ├── ic_launcher.png
│   │   │       │   │   ├── ic_launcher_foreground.png
│   │   │       │   │   └── ic_launcher_round.png
│   │   │       │   ├── mipmap-xxxhdpi/
│   │   │       │   │   ├── ic_launcher.png
│   │   │       │   │   ├── ic_launcher_foreground.png
│   │   │       │   │   └── ic_launcher_round.png
│   │   │       │   ├── values/
│   │   │       │   │   ├── ic_launcher_background.xml
│   │   │       │   │   ├── strings.xml
│   │   │       │   │   └── styles.xml
│   │   │       │   └── xml/
│   │   │       │       └── file_paths.xml
│   │   │       └── AndroidManifest.xml
│   │   ├── .gitignore
│   │   ├── build.gradle
│   │   ├── capacitor.build.gradle
│   │   └── proguard-rules.pro
│   ├── gradle/
│   │   └── wrapper/
│   │       ├── gradle-wrapper.jar
│   │       └── gradle-wrapper.properties
│   ├── .gitignore
│   ├── build.gradle
│   ├── capacitor.settings.gradle
│   ├── gradle.properties
│   ├── gradlew
│   ├── gradlew.bat
│   ├── settings.gradle
│   └── variables.gradle
├── docs/
│   ├── images/                        # Screenshots referenced from README.md
│   │   ├── ai-coach.png
│   │   ├── board-with-routine-task.png
│   │   ├── calendar-view.png
│   │   ├── list-view.png
│   │   ├── phase-b-task-form.png
│   │   ├── priority-view.png
│   │   ├── stats-by-label.png
│   │   ├── task-detail-routine-reminder.png
│   │   ├── timeline-view.png
│   │   └── type-view.png
│   ├── .structure-notes.toml
│   ├── HLD.md                         # High Level Design — architecture, flows, integrations
│   ├── LLD.md                         # Low Level Design — modules, data shapes, function map
│   └── STRUCTURE.md                   # Repository structure
├── e2e/                               # Playwright end-to-end tests
│   ├── README.md                      # E2E tests (Playwright)
│   ├── accessibility.spec.js
│   ├── chat-simulation.spec.js
│   ├── dark-mode.spec.js
│   ├── helpers.js
│   ├── onboarding.spec.js
│   ├── screenshots.spec.js
│   └── tasks-flow.spec.js
├── public/
│   ├── apple-touch-icon-180x180.png
│   ├── favicon.ico
│   ├── favicon.svg
│   ├── github-repo-icon.png
│   ├── icon-master.png
│   ├── icons.svg
│   ├── maskable-icon-512x512.png
│   ├── pwa-192x192.png
│   ├── pwa-512x512.png
│   └── pwa-64x64.png
├── src/                               # App source — single entry point (TasksApp.jsx), no mode gate (unlike…
│   ├── __tests__/                     # Vitest unit + integration tests
│   │   ├── APIKeySettings.test.jsx
│   │   ├── AppErrorBoundary.test.jsx
│   │   ├── ChatModal.test.jsx
│   │   ├── TasksApp.logic.test.js
│   │   ├── aiAssistant.test.js
│   │   ├── boardOrder.test.js
│   │   ├── driveSync.test.js
│   │   ├── effortScale.test.js
│   │   ├── labelSync.test.js
│   │   ├── localeParity.test.js
│   │   ├── nativeGoogleAuth.test.js
│   │   ├── pendingSync.test.js
│   │   ├── phaseB.test.js
│   │   ├── promptSafety.test.js
│   │   ├── reminders.test.js
│   │   ├── sanitize.test.js
│   │   ├── storageKeys.e2eParity.test.js
│   │   ├── taskHelpers.test.js
│   │   ├── taskPriority.test.js
│   │   └── taskTypes.test.js
│   ├── components/
│   │   ├── APIKeySettings.jsx         # User-supplied LLM provider API key settings
│   │   ├── AppBrandMark.jsx           # App logo/brand mark
│   │   ├── AppErrorBoundary.jsx       # Root crash handler: reload + export data
│   │   ├── CalendarView.jsx           # Calendar view
│   │   ├── CardColorPicker.jsx        # Card color picker
│   │   ├── ChatModal.jsx              # AI coach chat UI
│   │   ├── EffortPicker.jsx
│   │   ├── GithubIcon.jsx
│   │   ├── KanbanBoard.jsx
│   │   ├── LabelPicker.jsx            # Label picker
│   │   ├── Onboarding.jsx             # First-run onboarding flow
│   │   ├── PriorityBadge.jsx
│   │   ├── PriorityView.jsx
│   │   ├── RoutineReminderFields.jsx  # Recurring-schedule + reminder form fields
│   │   ├── TemplateLibrary.jsx        # Task template library
│   │   ├── TypeBadge.jsx
│   │   ├── TypePicker.jsx
│   │   └── TypeView.jsx
│   ├── data/
│   │   └── taskTemplates.js
│   ├── hooks/
│   │   └── useModalA11y.js            # Dialog accessibility helpers
│   ├── locales/                       # I18n translation files: English, Hebrew, French
│   │   ├── templateQuestions/
│   │   │   ├── en.js
│   │   │   ├── fr.js
│   │   │   └── he.js
│   │   ├── en.json
│   │   ├── fr.json
│   │   └── he.json
│   ├── services/                      # AI coach integration (aiAssistant.js)
│   │   ├── aiAssistant.js
│   │   └── coachPrompts.js
│   ├── utils/
│   │   ├── boardOrder.js
│   │   ├── effortScale.js
│   │   ├── labelColors.js
│   │   ├── labelSync.js               # Label sync logic
│   │   ├── pendingSync.js
│   │   ├── promptSafety.js            # AI prompt input sanitization
│   │   ├── recurrence.js              # Recurring-schedule (routine) logic
│   │   ├── reminders.js               # Reminder scheduling logic
│   │   ├── saveFile.js
│   │   ├── taskHelpers.js             # Pure task/display logic
│   │   ├── taskPriority.js
│   │   ├── taskTypes.js
│   │   └── templateQuestions.js
│   ├── App.jsx
│   ├── TasksApp.jsx                   # Main UI + state — board/list/timeline/calendar/stats views
│   ├── driveSync.js                   # Optional sync to the user's own Google Drive (appDataFolder)
│   ├── i18n.js
│   ├── index.css
│   ├── main.jsx
│   ├── modeldispatcher.config.js
│   ├── nativeGoogleAuth.js            # Android app only: Google Drive token from the OS via Capacitor
│   ├── sanitize.js                    # Import/localStorage data whitelisting
│   ├── statuses.js
│   ├── storageKeys.js
│   └── usePwaInstall.js
├── .ai                                # Ogen-ai submodule — the shared source of rules, skills and the ai-sync…
├── .env.example
├── .gitignore
├── .gitleaks.toml
├── .gitleaksignore
├── .gitmodules
├── .trivyignore
├── AGENTS.md                          # The compiled coding rules every AI assistant reads — generated, do not…
├── CLAUDE.md                          # Claude Code's copy of AGENTS.md (generated)
├── GEMINI.md                          # Gemini CLI's copy of AGENTS.md (generated)
├── LICENSE
├── README.md                          # KanDOne
├── SECURITY.md                        # Security Policy
├── ai-config.toml                     # Which rule fragments and target tools ai-sync compiles for this repo
├── capacitor.config.json              # Capacitor app id, name and web build directory
├── eslint.config.js
├── firestore.rules
├── index.html
├── package-lock.json
├── package.json
├── playwright.config.js
├── postcss.config.js
├── tailwind.config.js
├── vercel.json
└── vite.config.js
```
<!-- END GENERATED TREE -->
