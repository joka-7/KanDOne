import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

const { FAKE_PROVIDERS } = vi.hoisted(() => ({
  FAKE_PROVIDERS: {
    gemini: { id: 'gemini', name: 'Google Gemini', free: false, defaultModel: 'gemini-2.0-flash', placeholder: 'AIza...', infoUrl: 'https://aistudio.google.com/app/apikey', infoText: 'Get free key →' },
    groq: { id: 'groq', name: 'Groq', free: true, defaultModel: 'llama-3.1-8b-instant', placeholder: 'gsk_...', infoUrl: 'https://console.groq.com/keys', infoText: 'Get free key →' },
    ollama: { id: 'ollama', name: 'Ollama (Local)', free: true, noKey: true, defaultModel: 'llama3.2', placeholder: 'http://localhost:11434', infoUrl: 'https://ollama.ai', infoText: 'Install Ollama →' },
    anthropic: { id: 'anthropic', name: 'Anthropic Claude', free: false, defaultModel: 'claude-haiku-4-5-20251001', placeholder: 'sk-ant-...', infoUrl: 'https://console.anthropic.com/settings/keys', infoText: 'Get key →' },
    openai: { id: 'openai', name: 'OpenAI', free: false, defaultModel: 'gpt-4o-mini', placeholder: 'sk-...', infoUrl: 'https://platform.openai.com/api-keys', infoText: 'Get key →' },
  },
}));

vi.mock('../services/aiAssistant', () => ({
  loadAIConfigFromStorage: vi.fn(),
  isAIReady: vi.fn(() => false),
  PROVIDERS: FAKE_PROVIDERS,
}));

const t = (key, fallback) => fallback || key;
const defaultProps = { t, onClose: vi.fn() };

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('APIKeySettings — ModelPicker path (default: dispatcherFeatures.ui true)', () => {
  it('renders the shared ModelPicker empty state with no providers configured', async () => {
    vi.resetModules();
    vi.doMock('../modeldispatcher.config', () => ({ dispatcherFeatures: { ui: true } }));
    const { default: FreshAPIKeySettings } = await import('../components/APIKeySettings');
    render(<FreshAPIKeySettings {...defaultProps} />);
    expect(screen.getByText(/No providers added yet/i)).toBeInTheDocument();
  });

  it('adding a provider persists via saveConfig and re-syncs aiAssistant', async () => {
    vi.resetModules();
    vi.doMock('../modeldispatcher.config', () => ({ dispatcherFeatures: { ui: true } }));
    const { default: FreshAPIKeySettings } = await import('../components/APIKeySettings');
    const { loadAIConfigFromStorage } = await import('../services/aiAssistant');
    const user = userEvent.setup();
    render(<FreshAPIKeySettings {...defaultProps} />);

    const select = screen.getByLabelText('Choose a provider to add');
    await user.selectOptions(select, 'groq');
    await user.click(screen.getByRole('button', { name: '+ Add provider' }));

    expect(loadAIConfigFromStorage).toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('aiConfig')).providers).toEqual([
      { provider: 'groq', model: expect.any(String), apiKeys: [] },
    ]);
  });
});

describe('APIKeySettings — legacy path (dispatcherFeatures.ui: false)', () => {
  it('renders the original hand-built provider/key fields', async () => {
    vi.resetModules();
    vi.doMock('../modeldispatcher.config', () => ({ dispatcherFeatures: { ui: false } }));
    const { default: FreshAPIKeySettings } = await import('../components/APIKeySettings');
    render(<FreshAPIKeySettings {...defaultProps} />);
    expect(screen.getByText('Google Gemini')).toBeInTheDocument();
    expect(screen.getByText('Groq')).toBeInTheDocument();
  });

  it('clicking Save stores aiProvider/aiApiKey/aiModel to localStorage', async () => {
    vi.resetModules();
    vi.doMock('../modeldispatcher.config', () => ({ dispatcherFeatures: { ui: false } }));
    const { default: FreshAPIKeySettings } = await import('../components/APIKeySettings');
    const user = userEvent.setup();
    render(<FreshAPIKeySettings {...defaultProps} />);

    await user.click(screen.getByText('Groq'));
    const passwordInput = document.querySelector('input[type="password"]');
    fireEvent.change(passwordInput, { target: { value: 'gsk_testkey' } });
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(localStorage.getItem('aiProvider')).toBe('groq');
    expect(localStorage.getItem('aiApiKey')).toBe('gsk_testkey');
  });
});
