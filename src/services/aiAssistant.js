import { delimUserField } from '../utils/promptSafety';
import {
  streamComplete as agentStreamComplete,
  buildMessages as agentBuildMessages,
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

let config = { provider: 'gemini', apiKey: '', model: '', ollamaUrl: 'http://localhost:11434' };

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

export function initAI(provider, apiKey, model, ollamaUrl) {
  const p = provider || 'gemini';
  config = {
    provider: p,
    apiKey: String(apiKey ?? '').trim(),
    model: (model && String(model).trim()) || PROVIDERS[p]?.defaultModel || '',
    ollamaUrl: ollamaUrl || 'http://localhost:11434',
  };
}

export const AI_CONFIG_UPDATED = 'ai-config-updated';

/** Reload provider/key/model from localStorage (call when opening chat). */
export function loadAIConfigFromStorage() {
  const provider = localStorage.getItem('aiProvider') || 'gemini';
  const apiKey = (localStorage.getItem('aiApiKey')
    || localStorage.getItem('anthropicApiKey') || '').trim();
  const model = (localStorage.getItem('aiModel') || '').trim();
  const ollamaUrl = (localStorage.getItem('ollamaUrl') || 'http://localhost:11434').trim();
  initAI(provider, apiKey, model, ollamaUrl);
  const ready = isAIReady();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AI_CONFIG_UPDATED, { detail: { ready } }));
  }
  return ready;
}

export function isAIReady() {
  if (config.provider === 'ollama') return true;
  return Boolean(config.apiKey?.trim());
}

export function getCurrentProvider() {
  return config.provider;
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

  const { provider, apiKey } = config;
  const apiMessages = Array.isArray(messages) && messages.length > 0
    ? messages
    : buildApiMessages(messages);
  const emit = (text) => {
    try {
      onChunk(String(text ?? ''));
    } catch { /* ignore UI callback errors */ }
  };

  if (!provider || !PROVIDERS[provider]) {
    throw new Error(`Unknown AI provider: ${provider || '(not set)'}`);
  }
  if (!apiKey && provider !== 'ollama') {
    throw new Error('API key is not configured');
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
