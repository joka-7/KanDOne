import Anthropic from '@anthropic-ai/sdk';
import { delimUserField } from '../utils/promptSafety';

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

// SSE stream parser for OpenAI-compatible APIs (OpenAI, Groq)
async function streamOpenAICompat(url, apiKey, body, onChunk) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ ...body, stream: true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') continue;
      try {
        const delta = JSON.parse(raw).choices?.[0]?.delta?.content;
        if (delta) { full += delta; onChunk(full); }
      } catch { /* skip malformed */ }
    }
  }
  return full;
}

// Gemini SSE stream
async function streamGemini(apiKey, model, prompt, onChunk) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      try {
        const text = JSON.parse(raw).candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) { full += text; onChunk(full); }
      } catch { /* skip */ }
    }
  }
  return full;
}

// Validate Ollama URL for security (HTTPS only or localhost)
function validateOllamaUrl(url) {
  try {
    const parsed = new URL(url);
    // Allow localhost/127.0.0.1 over HTTP (for development)
    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
    if (!isLocalhost && parsed.protocol !== 'https:') {
      throw new Error('Remote Ollama must use HTTPS. For local testing, use http://localhost:11434');
    }
    return parsed.origin;
  } catch (err) {
    throw new Error(`Invalid Ollama URL: ${err.message}`);
  }
}

// Ollama newline-delimited JSON stream
async function streamOllama(baseUrl, model, prompt, onChunk) {
  const validUrl = validateOllamaUrl(baseUrl);
  const res = await fetch(`${validUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: true }),
  });
  if (!res.ok) throw new Error(`Ollama error: HTTP ${res.status}. Is Ollama running?`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.response) { full += obj.response; onChunk(full); }
      } catch { /* skip */ }
    }
  }
  return full;
}

// Anthropic SDK stream
async function streamAnthropic(apiKey, model, prompt, onChunk) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const stream = await client.messages.stream({
    model,
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });
  let full = '';
  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      full += chunk.delta.text;
      onChunk(full);
    }
  }
  return full;
}

/**
 * Build a provider-safe chat history from UI messages.
 * Ensures user-first ordering (required by Anthropic/Gemini) and strict alternation.
 * Validates and sanitizes message roles to prevent injection.
 */
const SIM_TRIGGER = '__sim_start__';
const VALID_ROLES = new Set(['user', 'assistant']);

export function buildApiMessages(uiMessages, { appendSimBegin = false } = {}) {
  let msgs = (Array.isArray(uiMessages) ? uiMessages : [])
    .map(({ role, content }) => ({
      role: VALID_ROLES.has(role) ? role : 'user', // Strict role validation
      content: String(content ?? '').trim().slice(0, 4000), // Cap message length
    }))
    .filter(m => m.content.length > 0 && m.content !== SIM_TRIGGER);

  if (appendSimBegin) {
    msgs = [...msgs, { role: 'user', content: 'begin' }];
  } else if (msgs.length > 0 && msgs[0].role === 'assistant') {
    msgs = [{ role: 'user', content: 'begin' }, ...msgs];
  }

  const out = [];
  for (const msg of msgs) {
    const last = out[out.length - 1];
    if (last && last.role === msg.role) {
      last.content = `${last.content}\n\n${msg.content}`;
    } else {
      out.push({ ...msg });
    }
  }
  return out.length > 0 ? out : [{ role: 'user', content: 'begin' }];
}

// Multi-turn chat streaming (messages must already be normalized via buildApiMessages)
export async function streamChat(messages, systemPrompt, onChunk) {
  // Rate limit check
  checkRateLimit('chat-stream');

  const { provider, apiKey, model, ollamaUrl } = config;
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

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const contents = apiMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const body = { contents };
    if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `HTTP ${res.status}`); }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try { const t = JSON.parse(line.slice(6)).candidates?.[0]?.content?.parts?.[0]?.text; if (t) { full += t; emit(full); } } catch { /* skip */ }
      }
    }
    return full;
  }

  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    const stream = await client.messages.stream({
      model, max_tokens: 1024,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: apiMessages,
    });
    let full = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        full += chunk.delta.text; emit(full);
      }
    }
    return full;
  }

  if (provider === 'ollama') {
    const validUrl = validateOllamaUrl(ollamaUrl);
    const res = await fetch(`${validUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: systemPrompt ? [{ role: 'system', content: systemPrompt }, ...apiMessages] : apiMessages,
        stream: true,
      }),
    });
    if (!res.ok) throw new Error(`Ollama error: HTTP ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try { const t = JSON.parse(line).message?.content; if (t) { full += t; emit(full); } } catch { /* skip */ }
      }
    }
    return full;
  }

  // OpenAI / Groq
  const urls = { openai: 'https://api.openai.com/v1/chat/completions', groq: 'https://api.groq.com/openai/v1/chat/completions' };
  return streamOpenAICompat(
    urls[provider],
    apiKey,
    { model, messages: systemPrompt ? [{ role: 'system', content: systemPrompt }, ...apiMessages] : apiMessages },
    emit,
  );
}

async function runStream(prompt, onChunk) {
  const { provider, apiKey, model, ollamaUrl } = config;
  switch (provider) {
    case 'gemini':
      return streamGemini(apiKey, model, prompt, onChunk);
    case 'groq':
      return streamOpenAICompat(
        'https://api.groq.com/openai/v1/chat/completions',
        apiKey,
        { model, messages: [{ role: 'user', content: prompt }] },
        onChunk,
      );
    case 'openai':
      return streamOpenAICompat(
        'https://api.openai.com/v1/chat/completions',
        apiKey,
        { model, messages: [{ role: 'user', content: prompt }] },
        onChunk,
      );
    case 'ollama':
      return streamOllama(ollamaUrl, model, prompt, onChunk);
    case 'anthropic':
      return streamAnthropic(apiKey, model, prompt, onChunk);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

const LANG = { en: 'Respond in English.', he: 'ענה בעברית.', fr: 'Réponds en français.' };

export async function getInterviewPrep(company, interviewType, language = 'en', onChunk) {
  checkRateLimit('interview-prep');
  const interviewCount = company.interviews?.length || 0;
  const prompt = `You are a job search coach helping someone prepare for a ${interviewType} interview at ${delimUserField(company.name)}.
${company.role ? `Role: ${delimUserField(company.role)}` : ''}
${company.location ? `Location: ${delimUserField(company.location)}` : ''}
${interviewCount > 0 ? `Previous interviews at this company: ${interviewCount}` : 'First interview at this company'}

Give exactly 3 focused preparation tips. For each tip:
- Start with a bold title (e.g., **Research Their Stack**)
- Follow with 1-2 actionable sentences
- Be specific and practical

${LANG[language] || LANG.en}`;
  return runStream(prompt, onChunk);
}

export async function analyzeRejection(company, language = 'en', onChunk) {
  checkRateLimit('analyze-rejection');
  const interviews = Array.isArray(company.interviews) ? company.interviews : [];
  const r = company.rejection || {};
  const interviewTypes = interviews.map(i => i.type).filter(Boolean);
  const prompt = `You are a supportive job search coach. Someone was rejected from ${delimUserField(company.name)}${company.role ? ` for the ${delimUserField(company.role)} role` : ''}.

Rejection details:
- Method: ${r.method || 'Unknown'}
- Number of interviews completed: ${interviews.length}
${interviewTypes.length ? `- Interview stages: ${interviewTypes.join(' → ')}` : ''}

Give 3 constructive, empathetic improvement suggestions. Each should:
- Start with a bold emoji + title (e.g., **💪 Strengthen Technical Skills**)
- Be actionable and specific (under 40 words)

End with one short encouraging sentence.

${LANG[language] || LANG.en}`;
  return runStream(prompt, onChunk);
}

export async function analyzePatterns(companies, language = 'en', onChunk) {
  checkRateLimit('analyze-patterns');
  const rejected = companies.filter(c => ['rejected', 'ghosted'].includes(c.status)).length;
  const active = companies.filter(c => !['rejected', 'ghosted', 'withdrawn'].includes(c.status)).length;
  const totalInterviews = companies.reduce((acc, c) => acc + (c.interviews?.length || 0), 0);
  const sample = companies.slice(0, 20).map(c => ({
    name: delimUserField(c.name, 120), status: c.status,
    interviews: c.interviews?.length || 0,
    rejectionMethod: c.rejection?.method || '',
  }));
  const prompt = `You are a job search strategist analyzing someone's job hunt data.

Stats:
- Total applications: ${companies.length}
- Rejected/ghosted: ${rejected}
- Active processes: ${active}
- Total interviews: ${totalInterviews}

Recent applications: ${JSON.stringify(sample, null, 2)}

Identify 3 patterns or insights. For each:
- Bold title with emoji
- 1-2 sentences with a specific, actionable recommendation

${LANG[language] || LANG.en}`;
  return runStream(prompt, onChunk);
}

export async function getSchedulingAdvice(company, language = 'en', onChunk) {
  checkRateLimit('scheduling-advice');
  const upcoming = (company.interviews || []).filter(
    i => i.date && new Date(i.date) > new Date()
  );
  if (!upcoming.length) return '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const interviewLines = upcoming.map(i => {
    const d = new Date(i.date);
    d.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
    return `- ${i.type || 'Interview'} on ${i.date} (${daysUntil} day${daysUntil !== 1 ? 's' : ''} from today)`;
  }).join('\n');

  const prompt = `You are an interview prep coach. Create a day-by-day preparation timeline for an upcoming interview.

Company: ${delimUserField(company.name)}
Role: ${delimUserField(company.role || 'Not specified')}
Upcoming interviews:
${interviewLines}

For each upcoming interview, create a focused day-by-day prep plan starting from today until the interview date. Each day should have:
- A bold heading with the day (e.g., **Day 1 — Today**)
- 1-2 specific, actionable tasks focused on preparation (research, practice, logistics)

Keep each day's tasks brief and actionable. Do not include any personal data beyond what is listed above.

${LANG[language] || LANG.en}`;
  return runStream(prompt, onChunk);
}

export async function getResumeAdvice(company, resumeText, language = 'en', onChunk) {
  checkRateLimit('resume-advice');
  const prompt = `You are a job application coach helping tailor a resume for a specific role.

Company: ${delimUserField(company.name)}
${company.role ? `Role: ${delimUserField(company.role)}` : ''}
${company.location ? `Location: ${delimUserField(company.location)}` : ''}

Resume content:
---
${resumeText.slice(0, 3000)}
---

Based on the resume above, suggest 3 specific experiences or achievements to highlight for this application. For each:
- Start with a **bold title** naming the experience
- One sentence on why it's relevant to this company/role
- One concrete tip (e.g., quantify impact, lead with it in summary, reword for keywords)

Be specific to the content provided. Keep tips actionable.

${LANG[language] || LANG.en}`;
  return runStream(prompt, onChunk);
}

export function getJobFinderSystemPrompt(companies = [], language = 'en') {
  const langInstruction = LANG[language] || LANG.en;
  const appliedRoles = [...new Set(companies.map(c => delimUserField(c.role, 120)).filter(Boolean))].slice(0, 10);
  const appliedCompanies = companies.map(c => delimUserField(c.name, 120)).filter(Boolean).slice(0, 10);
  const activeLocations = [...new Set(companies.map(c => delimUserField(c.location, 120)).filter(Boolean))].slice(0, 5);

  return `You are an expert job search advisor helping someone find their next job opportunity.

Your role:
- Ask about their skills, experience level, preferred location (remote/hybrid/onsite), desired salary range, and company size preferences
- Suggest concrete search strategies: specific LinkedIn search terms, relevant job boards (LinkedIn, Indeed, Glassdoor, AngelList, specific industry boards), GitHub Jobs, etc.
- Recommend networking tactics and how to leverage their existing applications
- Help them craft outreach messages and referral requests
- Identify industries or companies they haven't considered yet

Their existing job search data:
${appliedRoles.length ? `- Roles they've applied for: ${appliedRoles.join(', ')}` : ''}
${appliedCompanies.length ? `- Companies in their pipeline: ${appliedCompanies.join(', ')}` : ''}
${activeLocations.length ? `- Locations they're targeting: ${activeLocations.join(', ')}` : ''}

Start by warmly greeting them and asking 2-3 focused questions to understand what they're looking for. Then provide specific, actionable recommendations.

${langInstruction}`;
}

export function getCandidateFinderSystemPrompt(candidates = [], language = 'en') {
  const langInstruction = LANG[language] || LANG.en;
  const openPositions = [...new Set(candidates.map(c => delimUserField(c.role, 120)).filter(Boolean))].slice(0, 10);
  const activeCandidates = candidates.filter(c => !['rejected', 'withdrawn'].includes(c.status)).length;

  return `You are an expert talent acquisition specialist and sourcing strategist helping a recruiter find qualified candidates.

Your role:
- Help craft effective LinkedIn search strings (Boolean search syntax)
- Suggest the best sourcing channels: LinkedIn Recruiter, GitHub, Stack Overflow, Behance, Dribbble, AngelList/Wellfound, niche communities
- Recommend passive candidate outreach strategies and personalized InMail templates
- Advise on job description optimization to attract the right candidates
- Suggest referral program strategies and employee advocacy
- Help identify skills-adjacent talent pools they might be missing

Current recruiting context:
${openPositions.length ? `- Open positions: ${openPositions.join(', ')}` : '- No positions recorded yet'}
- Active candidates in pipeline: ${activeCandidates}

Start by asking about the specific role they're hiring for, required skills, experience level, and where they've already looked. Then provide specific sourcing strategies tailored to their needs.

${langInstruction}`;
}

export function getGoalsTasksSystemPrompt(tasks = [], language = 'en') {
  const langInstruction = LANG[language] || LANG.en;
  const activeTasks = tasks.filter(t => t.status === 'active').map(t => t.name).filter(Boolean).slice(0, 8);
  const completedTasks = tasks.filter(t => t.status === 'completed').map(t => t.name).filter(Boolean).slice(0, 5);

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

export async function debriefInterview(notes, context, language = 'en', onChunk) {
  checkRateLimit('interview-debrief');
  const prompt = `You are an expert interview coach. Analyze these post-interview notes written by the candidate:

---
${notes}
---
${context ? `\nContext: ${context}` : ''}

Provide a structured debrief with these 4 sections:

**✅ What went well**
(2-3 bullet points of strengths shown)

**⚠️ Areas to improve**
(2-3 specific things to work on before the next interview)

**📌 Key topics covered**
(quick list of main subjects discussed)

**🎯 Action items**
(1-3 concrete next steps before next interview or follow-up)

Be direct, specific, and constructive. ${LANG[language] || LANG.en}`;
  return runStream(prompt, onChunk);
}
