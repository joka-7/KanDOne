import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import ChatModal from '../components/ChatModal';

// vi.hoisted ensures these are available inside the vi.mock factory (which is hoisted to top)
const { mockIsAIReady, mockStreamChat, mockLoadAIConfig } = vi.hoisted(() => ({
  mockIsAIReady: vi.fn(() => true),
  mockLoadAIConfig: vi.fn(() => true),
  mockStreamChat: vi.fn(async (_messages, _system, onChunk) => {
    onChunk('Test response');
    return 'Test response';
  }),
}));

vi.mock('../services/aiAssistant', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isAIReady: mockIsAIReady,
    loadAIConfigFromStorage: mockLoadAIConfig,
    streamChat: mockStreamChat,
  };
});

const t = (key, fallback) => fallback || key;

const defaultProps = {
  task: null,
  t,
  onClose: vi.fn(),
  onOpenSettings: vi.fn(),
  onSaveToTask: vi.fn(),
};

// jsdom does not implement scrollIntoView — stub it out globally
window.HTMLElement.prototype.scrollIntoView = vi.fn();

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  mockIsAIReady.mockReturnValue(true);
  mockLoadAIConfig.mockReturnValue(true);
  mockStreamChat.mockImplementation(async (_messages, _system, onChunk) => {
    onChunk('Test response');
    return 'Test response';
  });
});

describe('ChatModal external AI escape hatch', () => {
  it('offers external AI chat links for the failed message once streamChat rejects', async () => {
    mockStreamChat.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<ChatModal {...defaultProps} />);
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'How do I plan a sprint?');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(screen.getByText('network down')).toBeInTheDocument();
    });
    const claudeLink = screen.getByRole('link', { name: 'Claude' });
    expect(claudeLink).toHaveAttribute('target', '_blank');
    const url = new URL(claudeLink.getAttribute('href'));
    expect(url.hostname).toBe('claude.ai');
    expect(url.searchParams.get('q')).toBe('How do I plan a sprint?');
    expect(screen.getByRole('link', { name: 'ChatGPT' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Gemini (Google AI Mode)' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Groq' })).toBeInTheDocument();
  });

  it('does not show external AI chat links when there is no error', async () => {
    const user = userEvent.setup();
    render(<ChatModal {...defaultProps} />);
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Hello');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    await waitFor(() => {
      expect(screen.getByText('Test response')).toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: 'Claude' })).toBeNull();
  });
});
