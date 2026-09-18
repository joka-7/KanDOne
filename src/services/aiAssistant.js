import { delimUserField } from '../utils/promptSafety';
import {
  streamComplete as agentStreamComplete,
  buildMessages as agentBuildMessages,
  loadConfig as loadPackageConfig,
  isConfigReady,
} from '@joka-7/modeldispatcher-browser-agent';

export const PROVIDERS = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    free: false,
    defaultModel: 'gemini-2.0-flash',
    placeholder: 'AIza...',
    infoUrl: 'https://aistudio.google.com/app/apikey',
    infoText: 'Get free key from Google AI Studio →',
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    free: true,
    defaultModel: 'llama-3.1-8b-instant',
    placeholder: 'gsk_...',
    infoUrl: 'https://console.groq.com/keys',
    infoText: 'Get free key from Groq Console →',
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local)',
    free: true,
    noKey: true,
    defaultModel: 'llama3.2',
    placeholder: 'http://localhost:11434',
    infoUrl: 'https://ollama.ai',
    infoText: 'Install Ollama on your machine →',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    free: false,
    defaultModel: 'claude-haiku-4-5-20251001',
    placeholder: 'sk-ant-...',
    infoUrl: 'https://console.anthropic.com/settings/keys',
    infoText: 'Get key from Anthropic Console →',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    free: false,
    defaultModel: 'gpt-4o-mini',
    placeholder: 'sk-...',
    infoUrl: 'https://platform.openai.com/api-keys',
    infoText: 'Get key from OpenAI Platform →',
  },
};

// `providers` is a fallback list ({ provider, model, apiKeys[] }[]) — see
// @joka-7/modeldispatcher-browser-agent's AgentConfig. Still populated by
// the single-provider initAI() below for the legacy settings UI and every
// existing test; the new <ModelPicker> UI (see APIKeySettings.jsx) writes
// this same shape directly via the package's own saveConfig()/loadConfig().
let config = { providers: [], ollamaUrl: 'http://localhost:11434' };

// Rate limiting: track last call time per action
const rateLimitMap = new Map();
const RATE_LIMIT_MS = 3000; // 3 second throttle between calls
// Disable rate limiting in browser environments (where E2E tests run) and Node.js test environments
const inBrowser = typeof window !== 'undefined';
const isNodeTest = typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.env.VITEST);
let rateLimitingEnabled = !inBrowser && !isNodeTest;

function checkRateLimit(key) {
  // Skip rate limiting in test environment
  if (!rateLimitingEnabled) return;

  const now = Date.now();
  const lastCall = rateLimitMap.get(key) || 0;
  if (now - lastCall < RATE_LIMIT_MS) {
    const waitMs = RATE_LIMIT_MS - (now - lastCall);
    throw new Error(`Rate limited. Please wait ${Math.ceil(waitMs / 1000)}s before next request.`);
  }
  rateLimitMap.set(key, now);
}

// Export for testing purposes
export function _setRateLimitingEnabled(enabled) {
  rateLimitingEnabled = enabled;
}

export function _resetRateLimitForTests() {
  rateLimitMap.clear();
  rateLimitingEnabled = false;
}

/** Single-provider entry point — still the legacy settings UI's shape.
 * Always produces exactly one provider entry (with or without a key, same
 * as the old `{ provider, apiKey }` did), so `getCurrentProvider()`/
 * `isAIReady()` behave exactly as before for every existing caller. */
export function initAI(provider, apiKey, model, ollamaUrl) {
  const p = provider || 'gemini';
  const key = String(apiKey ?? '').trim();
  const resolvedModel = (model && String(model).trim()) || PROVIDERS[p]?.defaultModel || '';
  config = {
    providers: [{ provider: p, model: resolvedModel, apiKeys: p === 'ollama' || !key ? [] : [key] }],
    ollamaUrl: ollamaUrl || 'http://localhost:11434',
  };
}

export const AI_CONFIG_UPDATED = 'ai-config-updated';

/** Reload the active config (call when opening chat, and after any AI
 * settings change). Prefers the new multi-provider blob the shared
 * <ModelPicker> writes; falls back to the legacy per-field keys for
 * existing users who saved a key before this app adopted it, or when the
 * legacy settings UI is still in use (see modeldispatcher.config.js). */
export function loadAIConfigFromStorage() {
  const packageConfig = loadPackageConfig();
  if (packageConfig.providers.length > 0) {
    config = packageConfig;
  } else {
    const provider = localStorage.getItem('aiProvider') || 'gemini';
    const apiKey = (localStorage.getItem('aiApiKey')
      || localStorage.getItem('anthropicApiKey') || '').trim();
    const model = (localStorage.getItem('aiModel') || '').trim();
    const ollamaUrl = (localStorage.getItem('ollamaUrl') || 'http://localhost:11434').trim();
    initAI(provider, apiKey, model, ollamaUrl);
  }
  const ready = isAIReady();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AI_CONFIG_UPDATED, { detail: { ready } }));
  }
  return ready;
}

export function isAIReady() {
  return isConfigReady(config);
}

/** The first configured provider, for display only (e.g. "Gemini is
 * answering") — with more than one configured, which one actually answers
 * a given request depends on runtime fallback, not this. */
export function getCurrentProvider() {
  return config.providers[0]?.provider;
}

// Request/response translation, SSE parsing, and Ollama URL validation for
// every provider now live in @joka-7/modeldispatcher-browser-agent (the
// shared core extracted from this file — and JobFlowTracker/HighFive/
// StepByLearn, which had each independently built the same thing). This
// file keeps only what's genuinely app-specific: the PROVIDERS table's own
// copy/wording, config state, rate limiting, and the prompt below.

/**
 * Build a provider-safe chat history from UI messages.
 * Ensures user-first ordering (required by Anthropic/Gemini) and strict alternation.
 * Validates and sanitizes message roles to prevent injection.
 */
const SIM_TRIGGER = '__sim_start__';

export function buildApiMessages(uiMessages, { appendSimBegin = false } = {}) {
  return agentBuildMessages(uiMessages, {
    forceTrailingFiller: appendSimBegin,
    dropContent: SIM_TRIGGER,
  });
}

// Multi-turn chat streaming (messages must already be normalized via buildApiMessages)
export async function streamChat(messages, systemPrompt, onChunk) {
  // Rate limit check
  checkRateLimit('chat-stream');

  const apiMessages = Array.isArray(messages) && messages.length > 0
    ? messages
    : buildApiMessages(messages);
  const emit = (text) => {
    try {
      onChunk(String(text ?? ''));
    } catch { /* ignore UI callback errors */ }
  };

  if (!isConfigReady(config)) {
    throw new Error('AI is not configured — add a provider and key (or Ollama) in AI settings.');
  }

  return agentStreamComplete(config, apiMessages, {
    systemInstruction: systemPrompt,
    onChunk: emit,
  });
}

const LANG = { en: 'Respond in English.', he: 'ענה בעברית.', fr: 'Réponds en français.' };

export function getGoalsTasksSystemPrompt(tasks = [], language = 'en') {
  const langInstruction = LANG[language] || LANG.en;
  const activeTasks = tasks
    .filter(t => t.status === 'active')
    .map(t => t.name)
    .filter(Boolean)
    .slice(0, 8)
    .map((name) => delimUserField(name));
  const completedTasks = tasks
    .filter(t => t.status === 'completed')
    .map(t => t.name)
    .filter(Boolean)
    .slice(0, 5)
    .map((name) => delimUserField(name));

  return `You are a personal productivity coach, goal-setting expert, and opportunity finder.

You help people with three things:
1. **Define clear goals**: Turn vague intentions into SMART goals (Specific, Measurable, Achievable, Relevant, Time-bound) and break them into actionable steps
2. **Find tasks & projects**: Discover open-source projects to contribute to, side projects to start, or community initiatives to join
3. **Find volunteering opportunities**: Match their skills and interests with meaningful volunteering — local nonprofits, online volunteering platforms (Catchafire, VolunteerMatch, UN Online Volunteers), mentorship programs, hackathons

Their current tasks:
${activeTasks.length ? `- Active: ${activeTasks.join(', ')}` : '- No active tasks yet'}
${completedTasks.length ? `- Recently completed: ${completedTasks.join(', ')}` : ''}

Start by asking what they want to focus on: defining a new goal, finding projects/tasks to work on, or finding volunteering opportunities. Then guide them with specific, personalized recommendations.

${langInstruction}`;
}
