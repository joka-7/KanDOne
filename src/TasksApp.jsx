import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Search, Download, Upload, Layout, List, BarChart2, Activity,
  Trash2, Edit2, ArrowLeft, ArrowRight, CheckCircle2, CheckCircle, Circle,
  Clock, AlertCircle, Calendar, Cloud, CloudOff, RefreshCw,
  ClipboardList, X, GripVertical, Languages, MoreVertical, Settings, Smartphone, Sparkles,
  Timer, Repeat, Bell,
} from 'lucide-react';
import { initAI, getGoalsTasksSystemPrompt } from './services/aiAssistant';
import { TASK_TEMPLATES } from './data/taskTemplates';
import {
  getLocalizedQuestions, getLocalizedCategoryLabel, formatQuestionList,
} from './utils/templateQuestions';
import { delimUserField } from './utils/promptSafety';
import {
  signInWithGoogle, signOut, onAuthChange, loadAllItems, formatSignInError,
  updateItem, deleteItem, batchSaveItems, saveUserProfile,
  loadTaskLabels, saveTaskLabels,
} from './firebase';
import { getStorageKey, STATUSES_TASKS, filterItemsForMode } from './statuses';
import { usePwaInstall } from './usePwaInstall';
import AppBrandMark from './components/AppBrandMark';
import { STORAGE_KEYS, TASKS_LABELS_KEY } from './storageKeys.js';
import {
  sanitizeTaskRecords, parseTaskStoragePayload, generateId,
  parseTaskLabelsStoragePayload,
  sanitizeTaskLabels,
} from './sanitize';
import { saveJsonFile } from './utils/saveFile';
import LabelPicker, { LabelChipsReadOnly } from './components/LabelPicker';
import CardColorPicker from './components/CardColorPicker';
import RoutineReminderFields from './components/RoutineReminderFields';
import { LABEL_COLOR_PALETTE, readableTextColor } from './utils/labelColors';
import { applyTaskStatusChange } from './utils/recurrence';
import {
  buildReminderKey, formatDueDateTime, requestReminderPermission, shouldNotifyTask,
  snoozeTaskReminder, isReminderSnoozed, SNOOZE_MINUTES,
} from './utils/reminders';
import { resolveLabelsOnSignIn, resolveTasksOnSignIn } from './utils/labelSync';
import {
  safeStr, cycleStepStatus, makeInitialDuration, makeInitialTask,
  getProgress, getNextPendingStep, formatDate, formatDuration, isTaskOverdue,
  buildCalendarEvents, buildTimelineEvents, mergeTaskIntoList, DURATION_UNITS,
} from './utils/taskHelpers';

// Modal / tab-scoped views — keep them out of the initial board paint.
const ChatModal = lazy(() => import('./components/ChatModal'));
const CalendarView = lazy(() => import('./components/CalendarView'));
const TemplateLibrary = lazy(() => import('./components/TemplateLibrary'));
const APIKeySettings = lazy(() => import('./components/APIKeySettings'));
const Onboarding = lazy(() => import('./components/Onboarding'));

const MODE = 'tasks';

const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-orange-100 text-orange-700 border-orange-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
};

const STEP_STATUS_CONFIG = {
  todo: { icon: Circle, color: 'text-gray-400', bg: 'bg-gray-50', label: 'todo' },
  in_progress: { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50', label: 'in_progress' },
  done: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50', label: 'done' },
  blocked: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'blocked' },
};

export default function TasksApp() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const lang = i18n.language;

  // Keep <html lang/dir> in sync with the UI language (WCAG 3.1.1). The
  // root div's dir= alone is not enough for assistive tech / browser defaults.
  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang === 'he' ? 'he' : lang === 'fr' ? 'fr' : 'en';
    root.dir = isRTL ? 'rtl' : 'ltr';
  }, [lang, isRTL]);

  // Stable across renders (only changes when `t` itself changes, e.g. language
  // switch) — several effects below key their deps on `tt` and would otherwise
  // tear down and rebuild on every render.
  const tt = useCallback((key, fb) => t(`tasks.${key}`, fb), [t]);
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  const [tasks, setTasks] = useState(() => {
    const sanitized = parseTaskStoragePayload(localStorage.getItem(getStorageKey(MODE)));
    return filterItemsForMode(sanitized, MODE);
  });
  const [labels, setLabels] = useState(
    () => parseTaskLabelsStoragePayload(localStorage.getItem(TASKS_LABELS_KEY)),
  );

  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(makeInitialTask());
  const [activeTab, setActiveTab] = useState('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [labelFilter, setLabelFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [reminderPrompt, setReminderPrompt] = useState(null);
  const [isSaved, setIsSaved] = useState(true);
  const [localStorageError, setLocalStorageError] = useState(false);
  const [user, setUser] = useState(null);
  const [syncing, setSyncing] = useState(false);
  // True once a cloud write/read has failed and not yet succeeded since —
  // drives the header's error state and blocks the focus-triggered pull
  // below from clobbering local changes that haven't made it to Firestore.
  const [syncError, setSyncError] = useState(false);
  const [newStepTitle, setNewStepTitle] = useState('');
  const [visibleCount, setVisibleCount] = useState(25);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showGoalsFinder, setShowGoalsFinder] = useState(false);
  const [simulationData, setSimulationData] = useState(null);
  const [showTasksWelcome, setShowTasksWelcome] = useState(
    () => !localStorage.getItem(STORAGE_KEYS.tasksWelcome),
  );
  const { canInstall, runInstall } = usePwaInstall();

  const dragTaskId = useRef(null);
  const fileInputRef = useRef(null);
  const toastTimerRef = useRef(null);
  const toastRef = useRef(null);

  // `undo` is optional: { label, onUndo }. Undo toasts stay up longer since
  // the user needs a moment to notice and react before the action is lost.
  const showToast = useCallback((msg, undo) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    const next = { message: msg, undo };
    toastRef.current = next;
    setToast(next);
    toastTimerRef.current = setTimeout(() => {
      toastRef.current = null;
      setToast(null);
    }, undo ? 6000 : 3000);
  }, []);

  // Run undo outside the setState updater — React may invoke updaters twice
  // in Strict Mode, which would restore the deleted item twice.
  const dismissToastAndUndo = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    const current = toastRef.current;
    toastRef.current = null;
    setToast(null);
    current?.undo?.onUndo();
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  useEffect(() => {
    try {
      if (tasks.length > 0 || localStorage.getItem(getStorageKey(MODE))) {
        setIsSaved(false);
        localStorage.setItem(getStorageKey(MODE), JSON.stringify(tasks));
        setLocalStorageError(false);
        const timer = setTimeout(() => setIsSaved(true), 800);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      // localStorage IS the source of truth for signed-out users — a quota or
      // private-mode failure here means silent, total data loss if unnoticed.
      console.error('Failed to save tasks to localStorage', e);
      setLocalStorageError(true);
      setIsSaved(false);
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem(TASKS_LABELS_KEY, JSON.stringify(labels));
      setLocalStorageError(false);
    } catch (e) {
      console.error('Failed to save labels to localStorage', e);
      setLocalStorageError(true);
    }
    if (user) {
      saveTaskLabels(user.uid, labels)
        .then(() => setSyncError(false))
        .catch((e) => { console.error(e); setSyncError(true); });
    }
  }, [labels, user]);

  useEffect(() => {
    const provider = localStorage.getItem('aiProvider') || 'gemini';
    const apiKey = localStorage.getItem('aiApiKey') || localStorage.getItem('anthropicApiKey') || '';
    const model = localStorage.getItem('aiModel') || '';
    const ollamaUrl = localStorage.getItem('ollamaUrl') || 'http://localhost:11434';
    initAI(provider, apiKey, model, ollamaUrl);
  }, []);

  const userRef = useRef(null);
  useEffect(() => { userRef.current = user; }, [user]);

  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  const markSyncError = useCallback((e) => {
    console.error(e);
    setSyncError(true);
  }, []);
  const clearSyncError = useCallback(() => setSyncError(false), []);

  useEffect(() => {
    const unsub = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        setSyncing(true);
        try {
          await saveUserProfile(firebaseUser.uid, { appMode: MODE });
          const [data, cloudLabels] = await Promise.all([
            loadAllItems(firebaseUser.uid, MODE),
            loadTaskLabels(firebaseUser.uid),
          ]);
          // Prefer cloud tasks when they exist; otherwise this is the user's
          // first sign-in with local-only data, so push it up instead of
          // silently leaving them with zero cloud backup.
          const { tasks: mergedTasks, pushToCloud: pushTasksToCloud } =
            resolveTasksOnSignIn(tasksRef.current, data);
          setTasks(mergedTasks);
          if (pushTasksToCloud && mergedTasks.length > 0) {
            await batchSaveItems(firebaseUser.uid, MODE, mergedTasks);
          }
          const localLabels = parseTaskLabelsStoragePayload(localStorage.getItem(TASKS_LABELS_KEY));
          const { labels: mergedLabels, pushToCloud } = resolveLabelsOnSignIn(localLabels, cloudLabels);
          setLabels(mergedLabels);
          if (pushToCloud && mergedLabels.length > 0) {
            await saveTaskLabels(firebaseUser.uid, mergedLabels);
          }
          clearSyncError();
          if ((data && data.length > 0) || mergedLabels.length > 0) {
            showToast(tt('toast.imported', 'Data loaded from cloud!'));
          }
        } catch (e) { markSyncError(e); }
        setSyncing(false);
      }
    });
    return unsub;
  }, [clearSyncError, markSyncError, showToast, tt]);

  useEffect(() => {
    const handleVisibility = async () => {
      const firebaseUser = userRef.current;
      // Skip the auto-pull while a previous write is known to have failed —
      // that write may still only exist locally, and overwriting local state
      // with a stale cloud snapshot would silently discard it. The header's
      // sync-error indicator lets the user retry manually instead.
      if (document.visibilityState === 'visible' && firebaseUser && !syncError) {
        setSyncing(true);
        try {
          const data = await loadAllItems(firebaseUser.uid, MODE);
          if (data && data.length > 0) setTasks(filterItemsForMode(data, MODE));
          clearSyncError();
        } catch (e) { markSyncError(e); }
        setSyncing(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [syncError, clearSyncError, markSyncError]);

  const saveTasks = useCallback(async (newTasks) => {
    setTasks(newTasks);
    if (user) {
      try {
        await batchSaveItems(user.uid, MODE, newTasks);
        clearSyncError();
      } catch (e) { markSyncError(e); }
    }
  }, [user, clearSyncError, markSyncError]);

  const saveTask = useCallback(async (task) => {
    setTasks(prev => mergeTaskIntoList(prev, task));
    if (user) {
      try {
        await updateItem(user.uid, MODE, task);
        clearSyncError();
      } catch (e) { markSyncError(e); }
    }
  }, [user, clearSyncError, markSyncError]);

  const deleteTask = useCallback(async (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    if (user) {
      try {
        await deleteItem(user.uid, MODE, id);
        clearSyncError();
      } catch (e) { markSyncError(e); }
    }
  }, [user, clearSyncError, markSyncError]);

  const handleSyncNow = async () => {
    if (!user || syncing) return;
    setSyncing(true);
    try {
      const [data, cloudLabels] = await Promise.all([
        loadAllItems(user.uid, MODE),
        loadTaskLabels(user.uid),
      ]);
      if (data && data.length > 0) setTasks(filterItemsForMode(data, MODE));
      if (Array.isArray(cloudLabels)) {
        setLabels(sanitizeTaskLabels(cloudLabels));
      }
      clearSyncError();
    } catch (e) { markSyncError(e); }
    setSyncing(false);
  };

  const openNewForm = useCallback(() => {
    setFormData(makeInitialTask());
    setSelectedId(null);
    setIsEditing(true);
    setNewStepTitle('');
    setActiveTab('list');
  }, []);

  const openEditForm = useCallback((task) => {
    setFormData({ ...task, steps: Array.isArray(task.steps) ? [...task.steps] : [] });
    setIsEditing(true);
    setNewStepTitle('');
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'n' || e.key === 'N') openNewForm();
      if (e.key === 'Escape') { setSelectedId(null); setIsEditing(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openNewForm]);

  // Browser back/forward support
  const navigateTo = useCallback((tab, taskId = null) => {
    setActiveTab(tab);
    if (taskId) {
      setSelectedId(taskId);
      setIsEditing(false);
    } else if (tab !== 'list') {
      setSelectedId(null);
      setIsEditing(false);
    }
    window.history.pushState({ tab, selectedId: taskId }, '');
  }, []);

  useEffect(() => {
    const onPop = (e) => {
      const s = e.state;
      if (!s) return;
      setActiveTab(s.tab || 'board');
      setSelectedId(s.selectedId || null);
      setIsEditing(false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const isSavingRef = useRef(false);
  const handleSave = async () => {
    if (isSavingRef.current) return;
    if (!safeStr(formData.name).trim()) {
      alert(tt('form.requiredName', 'Task name is required'));
      return;
    }
    isSavingRef.current = true;
    try {
      const rawTask = {
        ...formData,
        id: formData.id || generateId(),
        name: safeStr(formData.name).trim(),
      };
      const task = rawTask.status === 'completed'
        ? applyTaskStatusChange(rawTask, 'completed')
        : rawTask;
      await saveTask(task);
      setSelectedId(task.id);
      setIsEditing(false);
      showToast(tt('toast.saved', 'Task saved!'));
    } finally {
      isSavingRef.current = false;
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(tt('alert.deleteConfirm', 'Delete this task?'))) return;
    const removedIndex = tasks.findIndex(t => t.id === id);
    const removedTask = tasks[removedIndex];
    await deleteTask(id);
    setSelectedId(null);
    setIsEditing(false);
    showToast(tt('toast.deleted', 'Task deleted.'), removedTask ? {
      label: tt('toast.undo', 'Undo'),
      onUndo: () => {
        setTasks(prev => {
          const next = [...prev];
          next.splice(Math.min(removedIndex, next.length), 0, removedTask);
          return next;
        });
        if (userRef.current) {
          updateItem(userRef.current.uid, MODE, removedTask).then(clearSyncError).catch(markSyncError);
        }
      },
    } : undefined);
  };

  const handleStepStatusToggle = useCallback(async (taskId, stepId) => {
    setTasks(prev => {
      const updated = prev.map(task => {
        if (task.id !== taskId) return task;
        const steps = (task.steps || []).map(s =>
          s.id === stepId ? { ...s, status: cycleStepStatus(s.status) } : s
        );
        return { ...task, steps };
      });
      const task = updated.find(t => t.id === taskId);
      if (task && user) {
        updateItem(user.uid, MODE, task).then(clearSyncError).catch(markSyncError);
      }
      return updated;
    });
  }, [user, clearSyncError, markSyncError]);

  const handleFormStepToggle = (stepId) => {
    setFormData(prev => ({
      ...prev,
      steps: (prev.steps || []).map(s =>
        s.id === stepId ? { ...s, status: cycleStepStatus(s.status) } : s
      ),
    }));
  };

  const handleAddStep = () => {
    const title = newStepTitle.trim();
    if (!title) return;
    const newStep = {
      id: generateId(), title, status: 'todo', notes: '', dueDate: '',
      duration: makeInitialDuration(), labelIds: [],
    };
    setFormData(prev => ({ ...prev, steps: [...(prev.steps || []), newStep] }));
    setNewStepTitle('');
  };

  const handleDeleteStep = (stepId) => {
    const steps = formData.steps || [];
    const removedIndex = steps.findIndex(s => s.id === stepId);
    const removedStep = steps[removedIndex];
    setFormData(prev => ({ ...prev, steps: (prev.steps || []).filter(s => s.id !== stepId) }));
    if (removedStep) {
      showToast(tt('toast.stepDeleted', 'Step deleted.'), {
        label: tt('toast.undo', 'Undo'),
        onUndo: () => {
          setFormData(prev => {
            const nextSteps = [...(prev.steps || [])];
            nextSteps.splice(Math.min(removedIndex, nextSteps.length), 0, removedStep);
            return { ...prev, steps: nextSteps };
          });
        },
      });
    }
  };

  const handleCreateLabel = useCallback((text) => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const id = generateId();
    const color = LABEL_COLOR_PALETTE[labels.length % LABEL_COLOR_PALETTE.length];
    setLabels(prev => [...prev, { id, text: trimmed, color }]);
    return id;
  }, [labels]);

  const handleLabelColorChange = useCallback((id, color) => {
    setLabels(prev => prev.map(l => l.id === id ? { ...l, color } : l));
  }, []);

  const handleDeleteLabel = useCallback((id) => {
    const labelIndex = labels.findIndex(l => l.id === id);
    const removedLabel = labels[labelIndex];
    if (!removedLabel) return;
    // Snapshot everything the deletion can touch so Undo can restore it
    // exactly, including labelIds stripped from the currently open form.
    const previousTasks = tasksRef.current;
    const previousFormLabelIds = formData.labelIds;
    const previousFormSteps = formData.steps;

    setLabels(prev => prev.filter(l => l.id !== id));
    setFormData(prev => ({
      ...prev,
      labelIds: (prev.labelIds || []).filter(x => x !== id),
      steps: (prev.steps || []).map(s => (Array.isArray(s.labelIds) && s.labelIds.includes(id)
        ? { ...s, labelIds: s.labelIds.filter(x => x !== id) }
        : s)),
    }));
    setTasks(prev => {
      const changed = [];
      const updated = prev.map(task => {
        const hasTaskLabel = Array.isArray(task.labelIds) && task.labelIds.includes(id);
        const hasStepLabel = Array.isArray(task.steps)
          && task.steps.some(s => Array.isArray(s.labelIds) && s.labelIds.includes(id));
        if (!hasTaskLabel && !hasStepLabel) return task;
        const next = {
          ...task,
          labelIds: hasTaskLabel ? task.labelIds.filter(x => x !== id) : task.labelIds,
          steps: hasStepLabel
            ? task.steps.map(s => (Array.isArray(s.labelIds) && s.labelIds.includes(id)
              ? { ...s, labelIds: s.labelIds.filter(x => x !== id) }
              : s))
            : task.steps,
        };
        changed.push(next);
        return next;
      });
      // Keep Firestore in sync — otherwise tasks referencing the deleted label
      // only lose it locally, and a synced device sees the orphaned id again.
      if (userRef.current && changed.length > 0) {
        batchSaveItems(userRef.current.uid, MODE, changed).then(clearSyncError).catch(markSyncError);
      }
      return updated;
    });

    showToast(tt('toast.labelDeleted', 'Label deleted.'), {
      label: tt('toast.undo', 'Undo'),
      onUndo: () => {
        setLabels(prev => {
          const next = [...prev];
          next.splice(Math.min(labelIndex, next.length), 0, removedLabel);
          return next;
        });
        setFormData(prev => ({ ...prev, labelIds: previousFormLabelIds, steps: previousFormSteps }));
        setTasks(previousTasks);
        if (userRef.current) {
          batchSaveItems(userRef.current.uid, MODE, previousTasks).then(clearSyncError).catch(markSyncError);
        }
      },
    });
  }, [labels, formData, clearSyncError, markSyncError, showToast, tt]);

  const handleTaskLabelToggle = useCallback((id) => {
    setFormData(prev => {
      const current = prev.labelIds || [];
      return {
        ...prev,
        labelIds: current.includes(id) ? current.filter(x => x !== id) : [...current, id],
      };
    });
  }, []);

  const handleStepLabelToggle = useCallback((stepId, id) => {
    setFormData(prev => ({
      ...prev,
      steps: (prev.steps || []).map(s => {
        if (s.id !== stepId) return s;
        const current = s.labelIds || [];
        return {
          ...s,
          labelIds: current.includes(id) ? current.filter(x => x !== id) : [...current, id],
        };
      }),
    }));
  }, []);

  const handleDragStart = (taskId) => { dragTaskId.current = taskId; };
  const handleDragOver = (e) => { e.preventDefault(); };
  const handleDrop = (statusId) => {
    const id = dragTaskId.current;
    if (!id) return;
    setTasks(prev => {
      const updated = prev.map(t => (t.id === id ? applyTaskStatusChange(t, statusId) : t));
      const task = updated.find(t => t.id === id);
      if (task && user) updateItem(user.uid, MODE, task).then(clearSyncError).catch(markSyncError);
      return updated;
    });
    dragTaskId.current = null;
    showToast(tt('toast.saved', 'Saved!'));
  };

  const handleReminderEnable = useCallback(async () => {
    const result = await requestReminderPermission();
    if (result === 'denied') {
      alert(tt('reminder.permissionDenied', 'Enable notifications in your browser settings to use reminders.'));
    }
  }, [tt]);

  const applyTaskUpdate = useCallback(async (updated) => {
    setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    if (user) {
      try {
        await updateItem(user.uid, MODE, updated);
        clearSyncError();
      } catch (e) { markSyncError(e); }
    }
  }, [user, clearSyncError, markSyncError]);

  const handleSnoozeReminder = useCallback(async (taskId, minutes) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const updated = snoozeTaskReminder(task, minutes);
    await applyTaskUpdate(updated);
    setReminderPrompt(null);
    showToast(tt('reminder.snoozed', 'Reminder snoozed.'));
  }, [tasks, applyTaskUpdate, showToast, tt]);

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return undefined;
    // Side effects (notifications, prompt, Firestore writes) run here, outside
    // any setState updater — updaters must stay pure since React may invoke
    // them more than once per commit.
    const runReminders = () => {
      const pending = tasksRef.current.filter(shouldNotifyTask);
      if (pending.length === 0) return;
      const pendingIds = new Set(pending.map(p => p.id));

      const first = pending[0];
      setReminderPrompt({ taskId: first.id, name: first.name || tt('reminder.defaultTitle', 'Task reminder') });
      pending.forEach(task => {
        try {
          new Notification(task.name || tt('reminder.defaultTitle', 'Task reminder'), {
            body: formatDueDateTime(task.dueDate, task.dueTime, lang, formatDate)
              || tt('reminder.body', 'Your task is coming up.'),
            tag: `kandone-reminder-${task.id}-${buildReminderKey(task)}`,
          });
        } catch { /* ignore */ }
      });

      setTasks(prev => prev.map(task => (
        pendingIds.has(task.id)
          ? { ...task, lastReminderKey: buildReminderKey(task) }
          : task
      )));

      const currentUser = userRef.current;
      if (currentUser) {
        pending.forEach(task => {
          updateItem(currentUser.uid, MODE, { ...task, lastReminderKey: buildReminderKey(task) })
            .then(clearSyncError).catch(markSyncError);
        });
      }
    };
    runReminders();
    const timer = setInterval(runReminders, 30_000);
    return () => clearInterval(timer);
  }, [lang, tt, clearSyncError, markSyncError]);

  const handleExport = async () => {
    const payload = { version: 2, tasks, labels };
    const saved = await saveJsonFile(`tasks-backup-${Date.now()}.json`, payload);
    if (saved) showToast(tt('toast.exported', 'Backup downloaded!'));
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Import fully overwrites tasks (and labels, if the file has them) with
    // no merge option — snapshot both so an accidental import over real data
    // can be undone.
    const previousTasks = tasksRef.current;
    const previousLabels = labels;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        let rawTasks;
        let rawLabels = null;
        if (Array.isArray(data)) {
          rawTasks = data;
        } else if (data && Array.isArray(data.tasks)) {
          rawTasks = data.tasks;
          if (Array.isArray(data.labels)) rawLabels = data.labels;
        } else {
          throw new Error('invalid format');
        }
        const sanitized = sanitizeTaskRecords(rawTasks);
        if (sanitized.length === 0) throw new Error('empty');
        const nextTasks = filterItemsForMode(sanitized, MODE);
        // Import already fully replaces the local task list (no merge option
        // is offered) — bring the cloud copy to the same state, or restoring
        // an older backup would leave tasks it doesn't mention resurrected on
        // the next sync.
        const nextIds = new Set(nextTasks.map(t => t.id));
        const staleIds = tasksRef.current.map(t => t.id).filter(id => !nextIds.has(id));
        saveTasks(nextTasks);
        if (userRef.current && staleIds.length > 0) {
          Promise.all(staleIds.map(id => deleteItem(userRef.current.uid, MODE, id)))
            .then(clearSyncError)
            .catch(markSyncError);
        }
        if (rawLabels !== null) setLabels(sanitizeTaskLabels(rawLabels));
        showToast(tt('toast.imported', 'File loaded!'), {
          label: tt('toast.undo', 'Undo'),
          onUndo: () => {
            saveTasks(previousTasks);
            setLabels(previousLabels);
            if (userRef.current) {
              saveTaskLabels(userRef.current.uid, previousLabels).then(clearSyncError).catch(markSyncError);
            }
          },
        });
      } catch {
        alert(tt('alert.importError', 'Error importing file.'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const selectedTask = selectedId ? tasks.find(t => t.id === selectedId) : null;

  const handleSaveToTask = useCallback((taskId, text) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const merged = { ...t, notes: t.notes ? `${t.notes}\n\n---\n${text}` : text };
      if (user) updateItem(user.uid, MODE, merged).catch(() => {});
      return merged;
    }));
  }, [user]);

  const handleStartSimulation = useCallback((categoryKey) => {
    const cat = TASK_TEMPLATES[categoryKey];
    if (!cat) return;
    const label = getLocalizedCategoryLabel(t, categoryKey, cat.label);
    const questions = getLocalizedQuestions(t, categoryKey, cat.questions);
    const questionList = formatQuestionList(questions);
    const taskCtx = selectedTask
      ? `The user is working on task ${delimUserField(selectedTask.name)} (status: ${delimUserField(selectedTask.status || '', 40)}${selectedTask.dueDate ? `, due ${delimUserField(selectedTask.dueDate, 40)}` : ''}).`
      : 'No specific task is selected — general task-management practice.';
    const systemPrompt = `You are a supportive productivity coach running a ${label} coaching session.
${taskCtx}

Work through these prompts one at a time:
${questionList}

Rules:
- Ask ONE prompt at a time
- After the user responds, reflect in 2-3 sentences and suggest one concrete next action
- Then move to the next prompt
- Keep tone practical and encouraging
- When the user says "begin", welcome them briefly and ask prompt 1`;

    setSimulationData({ systemPrompt, title: `${cat.icon} ${label}` });
    setShowTemplates(false);
  }, [selectedTask, t]);

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (statusFilter !== 'all') result = result.filter(t => t.status === statusFilter);
    if (labelFilter !== 'all') {
      result = result.filter(t => {
        const taskLabels = t.labelIds || [];
        const stepLabels = (t.steps || []).flatMap(s => s.labelIds || []);
        return taskLabels.includes(labelFilter) || stepLabels.includes(labelFilter);
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        safeStr(t.name).toLowerCase().includes(q) ||
        safeStr(t.description).toLowerCase().includes(q)
      );
    }
    return result;
  }, [tasks, statusFilter, labelFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const active = tasks.filter(t => t.status === 'active').length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const allSteps = tasks.flatMap(t => t.steps || []);
    const totalSteps = allSteps.length;
    const doneSteps = allSteps.filter(s => s.status === 'done').length;
    const byStatus = {};
    STATUSES_TASKS.forEach(s => { byStatus[s.id] = tasks.filter(t => t.status === s.id).length; });
    const byLabel = {};
    labels.forEach(l => {
      byLabel[l.id] = tasks.filter(t => {
        const ids = new Set([...(t.labelIds || []), ...(t.steps || []).flatMap(s => s.labelIds || [])]);
        return ids.has(l.id);
      }).length;
    });
    return { total, active, completed, totalSteps, doneSteps, byStatus, byLabel };
  }, [tasks, labels]);

  const calendarEvents = useMemo(() => buildCalendarEvents(tasks), [tasks]);

  const timelineEvents = useMemo(() => buildTimelineEvents(tasks), [tasks]);

  const timelineBorder = isRTL ? 'border-r-2 pr-6' : 'border-l-2 pl-6';
  const timelineDot = isRTL ? '-right-[31px]' : '-left-[31px]';

  const renderStepStatusBadge = (status) => {
    const cfg = STEP_STATUS_CONFIG[status] || STEP_STATUS_CONFIG.todo;
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
        <Icon size={11} />
        {tt(`stepStatus.${status}`, status)}
      </span>
    );
  };

  const renderProgressBar = (task) => {
    const prog = getProgress(task);
    if (!prog) return null;
    const pct = prog.total === 0 ? 0 : Math.round((prog.done / prog.total) * 100);
    return (
      <div className="mt-2">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{prog.done}/{prog.total} {tt('detail.progress', 'steps')}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  };

  const renderBoard = () => (
    <div className="flex-1 overflow-y-auto overflow-x-hidden sm:overflow-x-auto sm:overflow-y-hidden p-3 sm:p-4 bg-slate-50 min-h-0 flex flex-col sm:flex-row gap-3 sm:gap-4">
      {tasks.length === 0 ? (
        <div className="flex items-center justify-center flex-1 min-h-[200px]">
          <div className="text-center max-w-sm px-4">
            <div className="mx-auto mb-4 w-14 h-14 flex items-center justify-center">
              <AppBrandMark size={56} />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-700 mb-2">{tt('board.emptyTitle', 'Welcome to KanDOne')}</h2>
            <p className="text-sm text-gray-500 mb-6">{tt('board.emptyDesc', 'Add your first task to get started.')}</p>
            <button
              onClick={openNewForm}
              className="bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-emerald-800 transition-colors mb-3"
            >
              {tt('board.addFirstButton', 'Add your first task')}
            </button>
            <button
              type="button"
              onClick={() => setShowTasksWelcome(true)}
              className="text-sm text-emerald-700 hover:text-emerald-900 font-medium"
            >
              💡 {tt('board.viewTutorial', 'View welcome')}
            </button>
          </div>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="flex items-center justify-center flex-1 min-h-[200px]">
          <div className="text-center max-w-sm px-4">
            <p className="text-sm text-gray-500">{tt('board.noResults', 'No tasks match your filters.')}</p>
          </div>
        </div>
      ) : (
        <>
          {STATUSES_TASKS.map(status => {
            const columnTasks = filteredTasks.filter(t => t.status === status.id);
            return (
              <div
                key={status.id}
                role="region"
                aria-label={tt(`status.${status.id}`, status.id)}
                className="board-column w-full sm:w-72 sm:flex-shrink-0 flex flex-col sm:h-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(status.id)}
              >
                <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${status.color}`}>
                      {tt(`status.${status.id}`, status.id)}
                    </span>
                    <span className="text-gray-400 text-xs sm:text-sm font-medium">{columnTasks.length}</span>
                  </div>
                </div>
                <div className="p-2 sm:p-3 space-y-2 sm:space-y-3 sm:flex-1 sm:overflow-y-auto sm:custom-scrollbar sm:min-h-[80px]">
                  {columnTasks.length === 0 && (
                    <div className="text-center text-xs text-gray-300 italic py-4">
                      {tt('board.emptyColumn', 'Drop a task here')}
                    </div>
                  )}
                  {columnTasks.map(task => {
                    const next = getNextPendingStep(task);
                    const overdue = isTaskOverdue(task);
                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={() => handleDragStart(task.id)}
                        onClick={() => navigateTo('list', task.id)}
                        style={task.cardColor ? { backgroundColor: task.cardColor } : undefined}
                        className={`${task.cardColor ? '' : 'bg-white'} border rounded-xl p-2.5 sm:p-3 cursor-pointer hover:shadow-md hover:border-emerald-300 active:bg-emerald-50/50 transition-all group ${overdue ? 'border-red-300' : 'border-gray-200'}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="font-semibold text-gray-800 text-xs sm:text-sm leading-snug flex-1">{safeStr(task.name)}</p>
                          <GripVertical size={14} className="text-gray-300 shrink-0 mt-0.5 group-hover:text-gray-400 hidden sm:block" />
                        </div>
                        {task.priority && (
                          <span className={`inline-block text-xs px-1.5 py-0.5 rounded border font-medium ${PRIORITY_COLORS[task.priority]}`}>
                            {t(`priority.${task.priority}`, task.priority)}
                          </span>
                        )}
                        {task.dueDate && (
                          <div className={`flex items-center gap-1 text-xs mt-1 ${overdue ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                            {overdue ? <AlertCircle size={10} /> : <Calendar size={10} />}
                            {formatDueDateTime(task.dueDate, task.dueTime, lang, formatDate)}
                            {overdue && <span>· {tt('overdue', 'Overdue')}</span>}
                          </div>
                        )}
                        {(task.routine?.enabled || task.reminder?.enabled) && (
                          <div className="flex items-center gap-2 mt-1">
                            {task.routine?.enabled && (
                              <Repeat size={10} className="text-violet-500" aria-label={tt('routine.badge', 'Routine')} />
                            )}
                            {task.reminder?.enabled && (
                              <Bell size={10} className="text-amber-500" aria-label={tt('reminder.badge', 'Reminder')} />
                            )}
                          </div>
                        )}
                        {formatDuration(task.duration, tt) && (
                          <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                            <Timer size={10} />
                            {formatDuration(task.duration, tt)}
                          </div>
                        )}
                        {(task.labelIds || []).length > 0 && (
                          <div className="mt-1.5">
                            <LabelChipsReadOnly labels={labels} labelIds={task.labelIds} />
                          </div>
                        )}
                        {renderProgressBar(task)}
                        {next && (
                          <div className="mt-2 text-xs text-gray-500 truncate">
                            <span className="text-gray-400">{tt('detail.nextStep', 'Next')}: </span>
                            {safeStr(next.title)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );

  const renderStepRow = (step, editable, taskId, taskDueDate) => {
    const cfg = STEP_STATUS_CONFIG[step.status] || STEP_STATUS_CONFIG.todo;
    const Icon = cfg.icon;
    return (
      <div key={step.id} className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.bg} border-gray-100 group`}>
        <button
          onClick={() => editable ? handleFormStepToggle(step.id) : handleStepStatusToggle(taskId, step.id)}
          className={`mt-0.5 shrink-0 ${cfg.color} hover:opacity-70 transition-opacity`}
          title={tt(`stepStatus.${step.status}`, step.status)}
        >
          <Icon size={18} />
        </button>
        <div className="flex-1 min-w-0">
          {editable ? (
            <input
              value={safeStr(step.title)}
              onChange={e => setFormData(prev => ({
                ...prev,
                steps: prev.steps.map(s => s.id === step.id ? { ...s, title: e.target.value } : s),
              }))}
              className="w-full text-sm font-medium bg-transparent border-0 outline-none text-gray-800 placeholder-gray-400"
              placeholder={tt('form.addStepPlaceholder', 'Describe the step...')}
            />
          ) : (
            <p className={`text-sm font-medium ${step.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
              {safeStr(step.title)}
            </p>
          )}
          {step.notes && !editable && (
            <p className="text-xs text-gray-500 mt-0.5">{safeStr(step.notes)}</p>
          )}
          {step.dueDate && !editable && (
            <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
              <Calendar size={10} />
              {formatDate(step.dueDate, lang)}
            </div>
          )}
          {editable && (
            <input
              value={safeStr(step.notes)}
              onChange={e => setFormData(prev => ({
                ...prev,
                steps: prev.steps.map(s => s.id === step.id ? { ...s, notes: e.target.value } : s),
              }))}
              className="w-full text-xs text-gray-500 bg-transparent border-0 outline-none mt-1 placeholder-gray-400"
              placeholder={tt('form.stepNotesPlaceholder', 'Add description...')}
            />
          )}
          {editable && (
            <div className="flex items-center gap-1 mt-1">
              <Calendar size={10} className="text-gray-400 shrink-0" />
              <input
                type="date"
                value={safeStr(step.dueDate)}
                max={taskDueDate || undefined}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  steps: prev.steps.map(s => s.id === step.id ? { ...s, dueDate: e.target.value } : s),
                }))}
                className={`text-xs bg-transparent border-0 outline-none ${step.dueDate && taskDueDate && step.dueDate > taskDueDate ? 'text-red-500 font-semibold' : 'text-gray-500'}`}
              />
            </div>
          )}
          {editable && step.dueDate && taskDueDate && step.dueDate > taskDueDate && (
            <div className="flex items-center gap-1 mt-1 text-xs text-red-500">
              <AlertCircle size={11} />
              {tt('form.stepDateAfterTask', 'Date is after the task due date')}
            </div>
          )}
          {editable && (
            <div className="flex items-center gap-1 mt-1.5">
              <Timer size={10} className="text-gray-400 shrink-0" />
              <input
                type="number"
                min="0"
                value={safeStr(step.duration?.value)}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  steps: prev.steps.map(s => s.id === step.id
                    ? { ...s, duration: { value: e.target.value, unit: s.duration?.unit || 'hour' } }
                    : s),
                }))}
                placeholder={tt('form.durationValuePlaceholder', 'Duration')}
                className="w-16 text-xs bg-transparent border-0 outline-none text-gray-500"
              />
              <select
                value={step.duration?.unit || 'hour'}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  steps: prev.steps.map(s => s.id === step.id
                    ? { ...s, duration: { value: s.duration?.value || '', unit: e.target.value } }
                    : s),
                }))}
                className="text-xs bg-transparent border-0 outline-none text-gray-500 cursor-pointer"
              >
                {DURATION_UNITS.map(u => (
                  <option key={u} value={u}>{tt(`duration.${u}`, u)}</option>
                ))}
              </select>
            </div>
          )}
          {!editable && formatDuration(step.duration, tt) && (
            <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
              <Timer size={10} />
              {formatDuration(step.duration, tt)}
            </div>
          )}
          {editable && (
            <div className="mt-1.5">
              <LabelPicker
                labels={labels}
                selectedIds={step.labelIds || []}
                onToggle={(id) => handleStepLabelToggle(step.id, id)}
                onCreate={(text) => {
                  const id = handleCreateLabel(text);
                  if (id) handleStepLabelToggle(step.id, id);
                }}
                onColorChange={handleLabelColorChange}
                onDelete={handleDeleteLabel}
                t={tt}
                compact
              />
            </div>
          )}
          {!editable && (step.labelIds || []).length > 0 && (
            <div className="mt-1.5">
              <LabelChipsReadOnly labels={labels} labelIds={step.labelIds} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!editable && renderStepStatusBadge(step.status)}
          {editable && (
            <button
              onClick={() => handleDeleteStep(step.id)}
              className="text-gray-400 hover:text-red-500 transition-colors"
              title={tt('form.deleteStep', 'Delete step')}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderDetailPanel = () => {
    if (isEditing) {
      const steps = formData.steps || [];
      return (
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 pb-20 custom-scrollbar">
          <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <h2 className="text-base sm:text-lg font-bold text-gray-800">
              {formData.id ? tt('form.editTitle', 'Edit Task') : tt('form.addTitle', 'Add New Task')}
            </h2>
            <button
              type="button"
              onClick={() => { setIsEditing(false); if (!formData.id) setSelectedId(null); }}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors text-sm font-semibold"
              title={tt('form.cancel', 'Cancel')}
              aria-label={tt('form.cancel', 'Cancel')}
            >
              <X size={18} />
              {tt('form.cancel', 'Cancel')}
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                {tt('form.taskName', 'Task Name *')}
              </label>
              <input
                value={safeStr(formData.name)}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                placeholder={tt('form.taskNamePlaceholder', 'What needs to be done?')}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  {tt('form.status', 'Status')}
                </label>
                <select
                  value={formData.status}
                  onChange={e => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                >
                  {STATUSES_TASKS.map(s => (
                    <option key={s.id} value={s.id}>{tt(`status.${s.id}`, s.id)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  {tt('form.priority', 'Priority')}
                </label>
                <select
                  value={formData.priority}
                  onChange={e => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                >
                  {['high', 'medium', 'low'].map(p => (
                    <option key={p} value={p}>{t(`priority.${p}`, p)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  {tt('form.dueDate', 'Due Date')}
                </label>
                <input
                  type="date"
                  value={safeStr(formData.dueDate)}
                  onChange={e => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  {tt('form.duration', 'Duration')}
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    min="0"
                    value={safeStr(formData.duration?.value)}
                    onChange={e => setFormData(prev => ({
                      ...prev, duration: { value: e.target.value, unit: prev.duration?.unit || 'hour' },
                    }))}
                    placeholder={tt('form.durationValuePlaceholder', 'Duration')}
                    className="w-1/2 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                  />
                  <select
                    value={formData.duration?.unit || 'hour'}
                    onChange={e => setFormData(prev => ({
                      ...prev, duration: { value: prev.duration?.value || '', unit: e.target.value },
                    }))}
                    className="w-1/2 border border-gray-200 rounded-xl px-2 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                  >
                    {DURATION_UNITS.map(u => (
                      <option key={u} value={u}>{tt(`duration.${u}`, u)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <RoutineReminderFields
              formData={formData}
              setFormData={setFormData}
              tt={tt}
              onReminderEnable={handleReminderEnable}
            />

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {tt('form.labels', 'Labels')}
              </label>
              <LabelPicker
                labels={labels}
                selectedIds={formData.labelIds || []}
                onToggle={handleTaskLabelToggle}
                onCreate={(text) => {
                  const id = handleCreateLabel(text);
                  if (id) handleTaskLabelToggle(id);
                }}
                onColorChange={handleLabelColorChange}
                onDelete={handleDeleteLabel}
                t={tt}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {tt('form.cardColor', 'Card Color')}
              </label>
              <CardColorPicker
                value={formData.cardColor || ''}
                onChange={(color) => setFormData(prev => ({ ...prev, cardColor: color }))}
                noneLabel={tt('form.cardColorNone', 'None')}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                {tt('form.description', 'Description')}
              </label>
              <textarea
                value={safeStr(formData.description)}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm resize-none"
                placeholder={tt('form.descriptionPlaceholder', 'Goal, context...')}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {tt('form.steps', 'Steps')} ({steps.length})
              </label>
              <div className="space-y-2 mb-3">
                {steps.length === 0 && (
                  <p className="text-sm text-gray-400 italic py-2">{tt('form.noSteps', 'No steps yet.')}</p>
                )}
                {steps.map(step => renderStepRow(step, true, null, formData.dueDate))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newStepTitle}
                  onChange={e => setNewStepTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddStep(); } }}
                  placeholder={tt('form.addStepPlaceholder', 'Describe the step...')}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <button
                  onClick={handleAddStep}
                  className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-200 transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                {tt('form.notes', 'Notes')}
              </label>
              <textarea
                value={safeStr(formData.notes)}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm resize-none"
                placeholder={tt('form.notesPlaceholder', 'Any additional notes...')}
              />
            </div>

            <div className={`flex gap-3 pt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={handleSave}
                className="flex-1 bg-emerald-700 text-white py-2.5 rounded-xl font-semibold hover:bg-emerald-800 transition-colors text-sm"
              >
                {tt('form.save', 'Save Changes')}
              </button>
              <button
                onClick={() => { setIsEditing(false); if (!selectedTask) setSelectedId(null); }}
                className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                {tt('form.cancel', 'Cancel')}
              </button>
            </div>
          </div>
          </div>
        </div>
      );
    }

    if (!selectedTask) {
      return (
        <div className="flex-1 flex items-center justify-center text-center p-6">
          <div>
            <ClipboardList className="mx-auto text-gray-300 mb-3" size={48} />
            <p className="text-gray-400">{tt('list.selectTask', 'Select a task from the list')}</p>
          </div>
        </div>
      );
    }

    const task = selectedTask;
    const steps = Array.isArray(task.steps) ? task.steps : [];
    const prog = getProgress(task);
    const statusDef = STATUSES_TASKS.find(s => s.id === task.status);
    const overdue = isTaskOverdue(task);

    return (
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 custom-scrollbar">
        <div className="flex items-start justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 leading-tight">{safeStr(task.name)}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {statusDef && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusDef.color}`}>
                  {tt(`status.${task.status}`, task.status)}
                </span>
              )}
              {task.priority && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${PRIORITY_COLORS[task.priority]}`}>
                  {t(`priority.${task.priority}`, task.priority)}
                </span>
              )}
              {task.dueDate && (
                <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${overdue ? 'text-red-700 bg-red-50 font-bold' : 'text-gray-500'}`}>
                  {overdue ? <AlertCircle size={11} /> : <Calendar size={11} />}
                  {formatDueDateTime(task.dueDate, task.dueTime, lang, formatDate)}
                  {overdue && ` · ${tt('overdue', 'Overdue')}`}
                </span>
              )}
              {task.routine?.enabled && (
                <span className="flex items-center gap-1 text-xs text-violet-600">
                  <Repeat size={11} />
                  {tt('routine.badge', 'Routine')}
                </span>
              )}
              {task.reminder?.enabled && (
                <span className="flex items-center gap-1 text-xs text-amber-600">
                  <Bell size={11} />
                  {isReminderSnoozed(task.reminder)
                    ? tt('reminder.snoozedBadge', 'Snoozed')
                    : tt('reminder.badge', 'Reminder')}
                </span>
              )}
              {task.routine?.enabled && task.routine?.endDate && (
                <span className="flex items-center gap-1 text-xs text-violet-500">
                  <Repeat size={11} />
                  {tt('routine.until', 'Until')} {formatDate(task.routine.endDate, lang)}
                </span>
              )}
              {formatDuration(task.duration, tt) && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Timer size={11} />
                  {formatDuration(task.duration, tt)}
                </span>
              )}
            </div>
            {(task.labelIds || []).length > 0 && (
              <div className="mt-2">
                <LabelChipsReadOnly labels={labels} labelIds={task.labelIds} size="sm" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => openEditForm(task)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              <Edit2 size={13} />
              {tt('detail.editDetails', 'Edit')}
            </button>
            <button
              onClick={() => handleDelete(task.id)}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {task.description && (
          <p className="text-sm text-gray-600 mb-4 whitespace-pre-wrap">{safeStr(task.description)}</p>
        )}

        {task.reminder?.enabled && (
          <div className="mb-4 p-3 rounded-xl border border-amber-100 bg-amber-50/60">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">
              {tt('reminder.snoozeTitle', 'Reminder')}
            </p>
            <div className="flex flex-wrap gap-2">
              {SNOOZE_MINUTES.map(minutes => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => handleSnoozeReminder(task.id, minutes)}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white border border-amber-200 text-amber-800 hover:bg-amber-100 transition-colors"
                >
                  {tt(`reminder.snooze${minutes}`, `${minutes} min`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {prog && (
          <div className="mb-4">
            {renderProgressBar(task)}
          </div>
        )}

        <div className="mb-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {tt('form.steps', 'Steps')} ({steps.length})
          </h3>
          {steps.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-2">{tt('detail.noSteps', 'No steps. Click "Edit Details" to add.')}</p>
          ) : (
            <div className="space-y-2">
              {steps.map(step => renderStepRow(step, false, task.id))}
            </div>
          )}
        </div>

        {task.notes && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{tt('detail.notes', 'Notes')}</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-xl p-3">{safeStr(task.notes)}</p>
          </div>
        )}
      </div>
    );
  };

  const renderList = () => {
    const visible = filteredTasks.slice(0, visibleCount);
    const remaining = filteredTasks.length - visible.length;
    const showDetailOnMobile = selectedId || isEditing;

    return (
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className={`w-full md:w-72 shrink-0 flex flex-col border-gray-200 ${isRTL ? 'border-l' : 'border-r'} bg-white ${showDetailOnMobile ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-2 sm:p-3 border-b border-gray-100 space-y-2">
            <div className="relative">
              <Search size={14} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400`} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={tt('list.searchPlaceholder', 'Search tasks...')}
                className={`w-full border border-gray-200 rounded-lg py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="all">{tt('list.allStatuses', 'All Statuses')}</option>
              {STATUSES_TASKS.map(s => (
                <option key={s.id} value={s.id}>{tt(`status.${s.id}`, s.id)}</option>
              ))}
            </select>
            {labels.length > 0 && (
              <select
                value={labelFilter}
                onChange={e => setLabelFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="all">{tt('list.allLabels', 'All Labels')}</option>
                {labels.map(l => (
                  <option key={l.id} value={l.id}>{l.text}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {visible.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-sm">
                {tasks.length === 0 ? tt('list.noTasks', 'No tasks yet.') : tt('list.noResults', 'No results found.')}
              </div>
            ) : (
              <>
                {visible.map(task => {
                  const prog = getProgress(task);
                  const statusDef = STATUSES_TASKS.find(s => s.id === task.status);
                  const isSelected = selectedId === task.id;
                  const overdue = isTaskOverdue(task);
                  return (
                    <button
                      key={task.id}
                      onClick={() => { setSelectedId(task.id); setIsEditing(false); }}
                      style={task.cardColor ? { backgroundColor: task.cardColor } : undefined}
                      className={`w-full text-left px-3 sm:px-4 py-3 min-h-[52px] border-b border-gray-50 transition-colors ${task.cardColor ? '' : 'hover:bg-emerald-50 active:bg-emerald-100'} ${isSelected ? 'ring-2 ring-inset ring-emerald-500' : ''} ${isSelected && !task.cardColor ? 'bg-emerald-50' : ''}`}
                    >
                      <p className="font-semibold text-gray-800 text-xs sm:text-sm truncate">{safeStr(task.name)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {statusDef && (
                          <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${statusDef.color}`}>
                            {tt(`status.${task.status}`, task.status)}
                          </span>
                        )}
                        {overdue && (
                          <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded border font-medium text-red-700 bg-red-50 border-red-200">
                            <AlertCircle size={10} />
                            {tt('overdue', 'Overdue')}
                          </span>
                        )}
                        {prog && (
                          <span className="text-xs text-gray-400">{prog.done}/{prog.total}</span>
                        )}
                      </div>
                      {(() => {
                        const taskLabelIds = [...new Set([
                          ...(task.labelIds || []),
                          ...(task.steps || []).flatMap(s => s.labelIds || []),
                        ])];
                        return taskLabelIds.length > 0 ? (
                          <div className="mt-1.5">
                            <LabelChipsReadOnly labels={labels} labelIds={taskLabelIds} />
                          </div>
                        ) : null;
                      })()}
                    </button>
                  );
                })}
                {remaining > 0 && (
                  <button
                    onClick={() => setVisibleCount(v => v + 25)}
                    className="w-full py-3 text-sm text-blue-600 hover:bg-blue-50 transition-colors font-medium"
                  >
                    {tt('list.loadMore', 'Load more')} ({remaining} {tt('list.remaining', 'remaining')})
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        <div className={`flex-1 flex flex-col min-h-0 bg-slate-50 ${!showDetailOnMobile ? 'hidden md:flex' : 'flex'}`}>
          {showDetailOnMobile && (
            <div className="md:hidden sticky top-0 bg-white/90 backdrop-blur-sm p-2.5 border-b border-gray-200 z-10 shrink-0">
              <button
                type="button"
                onClick={() => { setSelectedId(null); setIsEditing(false); }}
                className="flex items-center gap-2 text-emerald-700 font-bold text-sm"
              >
                <BackArrow size={18} /> {tt('list.backToList', 'Back to List')}
              </button>
            </div>
          )}
          {renderDetailPanel()}
        </div>
      </div>
    );
  };

  const renderStats = () => (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-50 min-h-0 custom-scrollbar">
      <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
          <BarChart2 className="text-emerald-600" /> {tt('stats.title', 'Statistics')}
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: tt('stats.total', 'Tasks'), value: stats.total, color: 'text-emerald-600' },
            { label: tt('stats.active', 'Active'), value: stats.active, color: 'text-blue-600' },
            { label: tt('stats.completed', 'Completed'), value: stats.completed, color: 'text-green-600' },
            { label: tt('stats.doneSteps', 'Steps Done'), value: `${stats.doneSteps}/${stats.totalSteps}`, color: 'text-purple-600' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5 text-center">
              <div className={`text-2xl sm:text-3xl font-black mb-1 ${card.color}`}>{card.value}</div>
              <div className="text-xs sm:text-sm text-gray-500 font-medium">{card.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-gray-800 mb-4">{tt('stats.byStatus', 'By Status')}</h3>
          <div className="space-y-3">
            {STATUSES_TASKS.map(s => {
              const count = stats.byStatus[s.id] || 0;
              const pct = stats.total === 0 ? 0 : Math.round((count / stats.total) * 100);
              return (
                <div key={s.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${s.color}`}>
                      {tt(`status.${s.id}`, s.id)}
                    </span>
                    <span className="text-gray-600 font-semibold">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-gray-800 mb-4">{tt('stats.byLabel', 'By Label')}</h3>
          {labels.length === 0 ? (
            <p className="text-sm text-gray-400 italic">{tt('form.noLabels', 'No labels yet.')}</p>
          ) : (
            <div className="space-y-3">
              {labels.map(l => {
                const count = stats.byLabel[l.id] || 0;
                const pct = stats.total === 0 ? 0 : Math.round((count / stats.total) * 100);
                return (
                  <div key={l.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: l.color, color: readableTextColor(l.color) }}
                      >
                        {l.text}
                      </span>
                      <span className="text-gray-600 font-semibold">{count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: l.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {stats.total > 0 && stats.totalSteps > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-bold text-gray-800 mb-3">{tt('stats.doneSteps', 'Steps Done')}</h3>
            <div className="flex items-center gap-4">
              <div className="text-4xl font-black text-emerald-600">
                {stats.totalSteps === 0 ? 0 : Math.round((stats.doneSteps / stats.totalSteps) * 100)}%
              </div>
              <div className="flex-1">
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${stats.totalSteps === 0 ? 0 : Math.round((stats.doneSteps / stats.totalSteps) * 100)}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-1">{stats.doneSteps} / {stats.totalSteps} {tt('form.steps', 'steps')}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderTimeline = () => (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-50 min-h-0 custom-scrollbar">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-8 flex items-center gap-2">
          <Activity className="text-emerald-600" /> {t('timeline.title')}
        </h2>
        {timelineEvents.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">{t('timeline.empty')}</div>
        ) : (
          <div className={`relative ${timelineBorder} border-emerald-200 space-y-8`}>
            {timelineEvents.map((event, index) => (
              <div key={index} className="relative">
                <div className={`absolute ${timelineDot} top-1 w-4 h-4 rounded-full border-4 border-white shadow-sm ${event.overdue ? 'bg-red-500' : event.isStep ? 'bg-blue-400' : 'bg-emerald-500'}`} />
                <button
                  type="button"
                  onClick={() => navigateTo('list', event.parentId)}
                  className={`w-full text-left bg-white p-5 rounded-xl shadow-sm border hover:shadow-md transition-shadow ${event.overdue ? 'border-red-200' : 'border-gray-100'}`}
                >
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <span className={`px-2 py-1 text-xs font-bold rounded-md ${event.isStep ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {event.isStep ? tt('timeline.step', 'Step') : tt('timeline.dueDate', 'Due date')}
                    </span>
                    <span className="text-sm text-gray-500 font-medium bg-gray-50 px-2 py-1 rounded shrink-0">
                      {formatDate(event.date, lang)}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg text-gray-800 mb-0.5">{event.taskName}</h3>
                  {event.isStep ? (
                    <p className="text-sm text-gray-600">{event.stepTitle}</p>
                  ) : (
                    <p className="text-sm text-gray-500 capitalize">{tt(`status.${event.status}`, event.status)}</p>
                  )}
                  {event.overdue && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                      <AlertCircle size={13} />
                      {tt('timeline.stepOverdue', 'Step date is after task due date!')}
                    </div>
                  )}
                  {!event.isStep && event.notes && (
                    <p className="text-gray-600 text-sm mt-2 whitespace-pre-wrap line-clamp-3">{event.notes}</p>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const TABS = [
    { id: 'board', icon: Layout, label: t('tabs.board', 'Board') },
    { id: 'list', icon: List, label: t('tabs.list', 'List & Edit') },
    { id: 'timeline', icon: Activity, label: t('tabs.timeline', 'Timeline') },
    { id: 'calendar', icon: Calendar, label: t('tabs.calendar', 'Calendar') },
    { id: 'stats', icon: BarChart2, label: t('tabs.stats', 'Statistics') },
  ];

  return (
    <div className="flex flex-col h-dvh bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className={`bg-gradient-to-r ${isRTL ? 'from-emerald-700 to-green-600' : 'from-green-600 to-emerald-700'} text-white shadow-md flex-shrink-0`}>
        <div className="px-3 sm:px-6 py-3 sm:py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <div className="bg-white/20 p-1.5 sm:p-2 rounded-lg backdrop-blur-sm shrink-0">
                <AppBrandMark size={24} className="sm:w-7 sm:h-7" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-xl font-bold tracking-tight leading-tight">
                  {tt('header.title', 'KanDOne')}
                  {tasks.length > 0 && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 transition-all ${
                        localStorageError
                          ? 'bg-red-500/60 text-red-50'
                          : isSaved ? 'bg-green-500/20 text-green-100' : 'bg-yellow-500/50 text-yellow-50'
                      }`}
                      title={localStorageError
                        ? tt('header.notSavedTooltip', 'Your browser storage is full or unavailable — changes are not being saved. Export a backup now.')
                        : undefined}
                    >
                      {localStorageError
                        ? <AlertCircle size={12} />
                        : isSaved ? <CheckCircle size={12} /> : <Clock size={12} />}
                      {localStorageError
                        ? tt('header.notSaved', 'Not saved!')
                        : isSaved ? tt('header.savedInBrowser', 'Saved') : tt('header.saving', 'Saving...')}
                    </span>
                  )}
                </h1>
                <p className="text-green-100 text-xs sm:text-sm truncate hidden sm:block">{tt('header.subtitle', 'Manage your tasks and track progress')}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
            <button onClick={openNewForm} className="flex items-center gap-1.5 bg-white text-emerald-700 hover:bg-green-50 active:bg-green-100 px-2 sm:px-4 py-2 rounded-lg font-bold shadow-sm transition-colors text-xs sm:text-sm min-h-[44px] touch-manipulation">
              <Plus size={16} className="shrink-0" />
              <span className="shrink-0">{tt('header.addTask', 'Add Task')}</span>
            </button>

            {user ? (
              <>
                <button
                  onClick={() => signOut()}
                  title={syncError ? t('header.syncErrorTooltip', 'Last cloud sync failed — click "Sync Now" to retry. (This signs out.)') : user.email}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-bold transition-colors border min-h-[44px] touch-manipulation ${
                    syncing
                      ? 'bg-yellow-500/20 border-yellow-400/30 text-yellow-100'
                      : syncError
                        ? 'bg-red-500/20 border-red-400/40 text-red-100'
                        : 'bg-green-500/20 border-green-400/30 text-green-100 hover:bg-red-500/20 hover:border-red-400/30 hover:text-red-100'
                  }`}
                >
                  {syncError && !syncing
                    ? <AlertCircle size={16} />
                    : <Cloud size={16} className={syncing ? 'animate-pulse' : ''} />}
                  <span className="hidden sm:inline shrink-0 max-w-[5rem] truncate sm:max-w-none">
                    {syncing
                      ? t('header.driveSyncing')
                      : syncError
                        ? t('header.syncErrorBadge', 'Sync issue')
                        : user.displayName?.split(' ')[0] || t('header.driveOn')}
                  </span>
                </button>
                <button
                  onClick={handleSyncNow}
                  disabled={syncing}
                  title={syncError ? t('header.syncNowRetry', 'Retry sync') : t('header.syncNow')}
                  className={`hidden md:flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-bold border transition-colors min-h-[44px] touch-manipulation disabled:opacity-50 ${
                    syncError
                      ? 'bg-red-500/20 hover:bg-red-500/30 border-red-400/40 text-red-100'
                      : 'bg-white/10 hover:bg-white/20 border-white/20 text-blue-100'
                  }`}
                >
                  <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                  <span className="shrink-0">{syncError ? t('header.syncNowRetry', 'Retry sync') : t('header.syncNow')}</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => signInWithGoogle()
                  .then((u) => { if (!u) return; })
                  .catch((e) => {
                    console.error('Google sign-in failed:', e);
                    alert(formatSignInError(e));
                  })}
                title={t('header.connectDriveTooltip')}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-bold bg-white/10 hover:bg-white/20 border border-white/20 text-green-100 transition-colors min-h-[44px] touch-manipulation"
              >
                <CloudOff size={16} className="shrink-0" /> <span className="hidden sm:inline shrink-0 max-w-[5rem] truncate sm:max-w-none">{t('header.connectDrive')}</span>
              </button>
            )}

            {canInstall && (
              <button
                type="button"
                onClick={() => runInstall(t)}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs sm:text-sm font-bold bg-white text-emerald-700 shadow-sm min-h-[40px] transition-colors hover:bg-green-50 active:bg-green-100 shrink-0"
                title={t('header.installApp')}
              >
                <Smartphone size={16} className="shrink-0" />
                <span className="shrink-0 max-w-[5rem] truncate sm:max-w-none">{t('header.installApp')}</span>
              </button>
            )}

            {/* Desktop controls */}
            <div className="hidden md:flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/10 border border-white/20">
              <Languages size={16} className="text-green-100 flex-shrink-0" aria-hidden="true" />
              <select
                value={i18n.language}
                onChange={e => { i18n.changeLanguage(e.target.value); localStorage.setItem('appLanguage', e.target.value); }}
                aria-label={t('header.language', 'Language')}
                className="bg-transparent text-green-100 text-sm font-bold border-none outline-none cursor-pointer"
              >
                <option value="en" className="text-gray-800">English</option>
                <option value="he" className="text-gray-800">עברית</option>
                <option value="fr" className="text-gray-800">Français</option>
              </select>
            </div>

            <div className="hidden md:flex bg-white/10 rounded-lg p-1">
              <button onClick={handleExport} title={t('header.downloadTooltip')} aria-label={t('header.downloadTooltip')} className="p-2 bg-green-500/20 hover:bg-green-500/40 rounded text-white transition-colors border border-green-400/30">
                <Download size={18} />
              </button>
              <label className="p-2 hover:bg-white/20 rounded text-white transition-colors cursor-pointer" title={t('header.uploadTooltip')} aria-label={t('header.uploadTooltip')}>
                <Upload size={18} />
                <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
              </label>
              <button
                type="button"
                data-testid="open-templates"
                aria-label={t('templates.titleTasks', 'Task Planning Prompts')}
                onClick={() => setShowTemplates(true)}
                title={t('templates.titleTasks', 'Task Planning Prompts')}
                className="p-2 hover:bg-white/20 rounded text-white transition-colors"
              >
                📚
              </button>
              <button
                onClick={() => setShowGoalsFinder(true)}
                title={t('ai.goalsAndTasks', 'Goals & Tasks')}
                aria-label={t('ai.goalsAndTasks', 'Goals & Tasks')}
                className="p-2 hover:bg-white/20 rounded text-white transition-colors"
              >
                🎯
              </button>
              <button
                onClick={() => setShowAISettings(true)}
                title={t('header.aiSettings', 'AI Settings')}
                aria-label={t('header.aiSettings', 'AI Settings')}
                className="p-2 hover:bg-white/20 rounded text-white transition-colors"
              >
                <Settings size={18} />
              </button>
              <button
                type="button"
                onClick={() => setShowTasksWelcome(true)}
                title={tt('board.viewTutorial', 'View welcome')}
                aria-label={tt('board.viewTutorial', 'View welcome')}
                className="p-2 hover:bg-white/20 rounded text-white transition-colors"
              >
                💡
              </button>
            </div>

            {/* Mobile overflow menu */}
            <div className="md:hidden relative">
              <button
                onClick={() => setMobileMenuOpen(o => !o)}
                aria-label={t('header.moreMenu', 'More options')}
                aria-expanded={mobileMenuOpen}
                className="p-2 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-lg text-white transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <MoreVertical size={20} />
              </button>
              {mobileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMobileMenuOpen(false)} />
                  <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-50 min-w-[200px] py-2`}>
                    <div className="px-3 py-2 border-b border-gray-100">
                      <div className="flex items-center gap-1.5">
                        <Languages size={14} className="text-gray-400" />
                        <select
                          value={i18n.language}
                          onChange={e => { i18n.changeLanguage(e.target.value); localStorage.setItem('appLanguage', e.target.value); setMobileMenuOpen(false); }}
                          aria-label={t('header.language', 'Language')}
                          className="text-gray-700 text-sm font-bold border-none outline-none cursor-pointer bg-transparent flex-1"
                        >
                          <option value="en">English</option>
                          <option value="he">עברית</option>
                          <option value="fr">Français</option>
                        </select>
                      </div>
                    </div>
                    {user && (
                      <button onClick={() => { handleSyncNow(); setMobileMenuOpen(false); }} disabled={syncing} className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 ${syncError ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
                        {syncError
                          ? <AlertCircle size={16} className="text-red-500" />
                          : <RefreshCw size={16} className={`text-blue-500 ${syncing ? 'animate-spin' : ''}`} />}
                        {syncError ? t('header.syncNowRetry', 'Retry sync') : t('header.syncNow')}
                      </button>
                    )}
                    <button onClick={() => { handleExport(); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100">
                      <Download size={16} className="text-green-600" /> {t('header.downloadTooltip')}
                    </button>
                    <label className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 cursor-pointer">
                      <Upload size={16} className="text-blue-600" /> {t('header.uploadTooltip')}
                      <input type="file" accept=".json" onChange={e => { handleImport(e); setMobileMenuOpen(false); }} className="hidden" />
                    </label>
                    <button type="button" data-testid="open-templates" onClick={() => { setShowTemplates(true); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100">
                      <span>📚</span> {t('templates.titleTasks', 'Task Planning Prompts')}
                    </button>
                    <button onClick={() => { setShowGoalsFinder(true); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100">
                      <span>🎯</span> {t('ai.goalsAndTasks', 'Goals & Tasks')}
                    </button>
                    <button onClick={() => { setShowAISettings(true); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100">
                      <Settings size={16} className="text-gray-500" /> {t('header.aiSettings', 'AI Settings')}
                    </button>
                    <button onClick={() => { setShowTasksWelcome(true); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100">
                      <span>💡</span> {tt('board.viewTutorial', 'View welcome')}
                    </button>
                    {canInstall && (
                      <button
                        type="button"
                        onClick={() => { runInstall(t); setMobileMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100 border-t border-gray-100"
                      >
                        <Smartphone size={16} className="text-emerald-600" /> {t('header.installApp')}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        </div>

        {/* Tab bar */}
        <div className="flex px-2 sm:px-6 gap-0.5 sm:gap-1 mt-2 overflow-x-auto scrollbar-none">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => navigateTo(id)}
              className={`px-2 sm:px-4 py-1.5 sm:py-2.5 rounded-t-lg font-medium flex items-center gap-0.5 sm:gap-2 transition-colors whitespace-nowrap flex-shrink-0 text-[10px] sm:text-sm min-h-[34px] sm:min-h-[44px] touch-manipulation ${activeTab === id ? 'bg-gray-50 text-emerald-800' : 'bg-white/10 text-green-100 hover:bg-white/20 active:bg-white/25'}`}
            >
              <span className="hidden sm:inline-flex shrink-0"><Icon size={15} /></span>
              <span className="shrink-0">{label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {activeTab === 'board' && renderBoard()}
        {activeTab === 'list' && renderList()}
        {activeTab === 'timeline' && renderTimeline()}
        {activeTab === 'stats' && renderStats()}
        {activeTab === 'calendar' && (
          <div className="flex-1 overflow-auto calendar-page min-h-0">
            <Suspense fallback={<div className="p-8 text-center text-sm text-gray-400">…</div>}>
              <CalendarView
                events={calendarEvents}
                legendTypes={['task', 'step']}
                isRTL={isRTL}
                onEventClick={ev => { navigateTo('list', ev.parentId); }}
              />
            </Suspense>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white pl-5 pr-2.5 py-2.5 rounded-xl shadow-xl text-sm font-medium z-50 animate-fade-in flex items-center gap-3"
        >
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={dismissToastAndUndo}
              className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 font-bold text-emerald-300 transition-colors shrink-0"
            >
              {toast.undo.label}
            </button>
          )}
        </div>
      )}

      {reminderPrompt && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 w-[min(100%,24rem)] bg-amber-50 border border-amber-200 text-amber-950 px-4 py-3 rounded-xl shadow-xl z-50">
          <p className="text-sm font-semibold mb-1">{reminderPrompt.name}</p>
          <p className="text-xs text-amber-800 mb-3">{tt('reminder.prompt', 'Snooze this reminder?')}</p>
          <div className="flex flex-wrap gap-2">
            {SNOOZE_MINUTES.map(minutes => (
              <button
                key={minutes}
                type="button"
                onClick={() => handleSnoozeReminder(reminderPrompt.taskId, minutes)}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white border border-amber-300 hover:bg-amber-100"
              >
                {tt(`reminder.snooze${minutes}`, `${minutes} min`)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setReminderPrompt(null)}
              className="px-2.5 py-1 text-xs font-bold rounded-lg text-amber-700 hover:bg-amber-100"
            >
              {tt('reminder.dismiss', 'Dismiss')}
            </button>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        {showTasksWelcome && (
          <Onboarding
            t={t}
            i18n={i18n}
            isRTL={isRTL}
            onClose={() => setShowTasksWelcome(false)}
            openNewForm={() => { setShowTasksWelcome(false); openNewForm(); }}
            openAISettings={() => { setShowTasksWelcome(false); setShowAISettings(true); }}
          />
        )}

        {showAISettings && (
          <APIKeySettings
            t={t}
            onClose={() => setShowAISettings(false)}
          />
        )}

        {showTemplates && (
          <TemplateLibrary
            t={t}
            onClose={() => setShowTemplates(false)}
            onStartSimulation={handleStartSimulation}
          />
        )}

        {chatOpen && !simulationData && (
          <ChatModal
            key={`task-chat-${selectedTask?.id || 'general'}`}
            t={t}
            task={selectedTask}
            language={lang}
            sessionKey={`task-chat-${selectedTask?.id || 'general'}`}
            onClose={() => setChatOpen(false)}
            onOpenSettings={() => { setChatOpen(false); setShowAISettings(true); }}
            onSaveToTask={selectedTask ? handleSaveToTask : null}
          />
        )}

        {simulationData && (
          <ChatModal
            key={`task-sim-${simulationData.title}`}
            t={t}
            task={selectedTask}
            language={lang}
            sessionKey={simulationData.title}
            systemPromptOverride={simulationData.systemPrompt}
            simulationTitle={simulationData.title}
            autoStart={true}
            onClose={() => setSimulationData(null)}
            onOpenSettings={() => setShowAISettings(true)}
            onSaveToTask={selectedTask ? handleSaveToTask : null}
          />
        )}

        {showGoalsFinder && (
          <ChatModal
            key="goals-tasks-finder"
            t={t}
            language={lang}
            sessionKey="goals-tasks-finder"
            systemPromptOverride={getGoalsTasksSystemPrompt(tasks, lang)}
            simulationTitle={t('ai.goalsAndTasks', 'Goals & Tasks')}
            autoStart={true}
            onClose={() => setShowGoalsFinder(false)}
            onOpenSettings={() => { setShowGoalsFinder(false); setShowAISettings(true); }}
          />
        )}
      </Suspense>

      {!chatOpen && !simulationData && !showGoalsFinder && (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          title={t('chat.titleTasks', 'Task Coach')}
          className={`fixed ${isEditing ? 'bottom-20 sm:bottom-24' : 'bottom-4 sm:bottom-6'} right-4 sm:right-6 z-40 w-11 h-11 sm:w-12 sm:h-12 rounded-full shadow-lg flex items-center justify-center bg-gradient-to-br from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white hover:scale-110 transition-all`}
        >
          <Sparkles size={20} />
        </button>
      )}
    </div>
  );
}
