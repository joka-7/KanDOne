import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppErrorBoundary from '../components/AppErrorBoundary';
import { saveJsonFile } from '../utils/saveFile';

vi.mock('../utils/saveFile', () => ({ saveJsonFile: vi.fn() }));

function Bomb() {
  throw new Error('boom');
}

describe('AppErrorBoundary', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders children when there is no error', () => {
    render(
      <AppErrorBoundary>
        <p>All good</p>
      </AppErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeTruthy();
  });

  it('catches a render error and shows the fallback with a reload and export option', () => {
    // React logs the error to console.error even when caught; silence it for this test.
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('boom')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Export my data/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reload app/i })).toBeTruthy();
  });

  it('reload button calls window.location.reload', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });

    render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    );
    await userEvent.click(screen.getByRole('button', { name: /Reload app/i }));
    expect(reloadSpy).toHaveBeenCalled();

    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('explains on the page, without a blocking alert, when the backup cannot be saved', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    saveJsonFile.mockRejectedValueOnce(new Error('disk full'));

    render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    );
    await userEvent.click(screen.getByRole('button', { name: /Export my data/i }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/Could not export automatically/i);
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
