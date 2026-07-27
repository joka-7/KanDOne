import React from 'react';
import { getStorageKey } from '../statuses';
import { TASKS_LABELS_KEY } from '../storageKeys.js';
import { saveJsonFile } from '../utils/saveFile';

const MODE = 'tasks';

/**
 * Last-resort fallback for a render error anywhere in the app. Deliberately
 * has no dependency on app state, i18n, or any component that could itself be
 * the cause of the crash — it reads localStorage directly so a backup is
 * still possible even if the in-memory React tree is broken.
 */
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('KanDOne crashed:', error, info);
  }

  handleExport = async () => {
    try {
      const tasksRaw = localStorage.getItem(getStorageKey(MODE));
      const labelsRaw = localStorage.getItem(TASKS_LABELS_KEY);
      const payload = {
        version: 2,
        tasks: tasksRaw ? JSON.parse(tasksRaw) : [],
        labels: labelsRaw ? JSON.parse(labelsRaw) : [],
      };
      await saveJsonFile(`tasks-backup-${Date.now()}.json`, payload);
    } catch (e) {
      console.error('Crash-recovery export failed:', e);
      alert('Could not export automatically. Open your browser devtools console and copy localStorage manually.');
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="fixed inset-0 bg-slate-50 z-[100] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center">
          <p className="text-4xl mb-3">⚠️</p>
          <h1 className="text-lg font-bold text-gray-800 mb-2">Something went wrong</h1>
          <p className="text-sm text-gray-500 mb-5">
            KanDOne hit an unexpected error. Your data is still in this browser's
            storage — export a backup before reloading, just in case.
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={this.handleExport}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors"
            >
              Export my data (JSON backup)
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-bold rounded-xl transition-colors"
            >
              Reload app
            </button>
          </div>
          {this.state.error?.message && (
            <p className="text-xs text-gray-400 mt-4 break-words">{this.state.error.message}</p>
          )}
        </div>
      </div>
    );
  }
}
