import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Pre-existing patterns (localStorage sync effects, drag handlers that close
      // over refs). Tracked for a later cleanup — warn so `npm run lint` can gate
      // CI without failing on these React Compiler–style rules today.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
  {
    files: [
      'playwright.config.js',
      'vite.config.js',
      'eslint.config.js',
      'src/__tests__/**/*.{js,jsx}',
      'src/services/aiAssistant.js',
    ],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
])
