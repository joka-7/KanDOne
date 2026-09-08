import { useState, useRef, useCallback } from 'react';
import { X, Layout, List, BarChart2, Lightbulb, ChevronRight, ChevronLeft, CheckCircle2, Clock, Cloud, Timer, Tag, Palette, Repeat, Bell, Zap } from 'lucide-react';
import AppBrandMark from './AppBrandMark';
import { STORAGE_KEYS } from '../storageKeys.js';
import { useModalA11y } from '../hooks/useModalA11y';

const CloudSyncNote = (t) => (
  <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100 mt-4 text-left">
    <Cloud size={20} className="text-blue-500 shrink-0 mt-0.5" />
    <div>
      <p className="text-sm text-blue-800 font-medium">{t('onboarding.cloudTitle', 'Cloud sync (optional)')}</p>
      <p className="text-xs text-blue-600">{t('onboarding.cloudDesc', 'Sign in with Google to back up your data and sync it across all your devices — or keep everything local and use JSON backups.')}</p>
    </div>
  </div>
);

const TASKS_STEPS = [
  {
    icon: '👋',
    titleKey: 'tasksWelcome',
    defaults: { title: 'Welcome to KanDOne!', subtitle: 'Plan work, track progress, get things done' },
  },
  {
    icon: '📋',
    titleKey: 'tasksBoard',
    defaults: { title: 'Status Board', subtitle: 'Visualize tasks by status with drag & drop' },
  },
  {
    icon: '✅',
    titleKey: 'tasksSteps',
    defaults: { title: 'Steps & Due Dates', subtitle: 'Break tasks into steps and set deadlines' },
  },
  {
    icon: '🔁',
    titleKey: 'tasksRoutines',
    defaults: { title: 'Routines & Reminders', subtitle: 'Repeat tasks and get notified' },
  },
  {
    icon: '🤖',
    titleKey: 'tasksAI',
    defaults: { title: 'AI Coach', subtitle: 'Get help planning and breaking down tasks' },
  },
  {
    icon: '⌨️',
    titleKey: 'tasksShortcuts',
    defaults: { title: 'Keyboard Shortcuts', subtitle: 'Work faster with shortcuts' },
  },
];

const tasksStepContent = {
  tasksWelcome: (t) => (
    <div className="space-y-4 text-center">
      <p className="text-gray-600 text-lg leading-relaxed">
        {t('onboarding.tasksWelcomeDesc', 'Create tasks, break them into steps, track progress — all in one place. Your data stays private in your browser.')}
      </p>
      <div className="grid grid-cols-2 gap-3 mt-6 text-left">
        {[
          { icon: <Layout size={20} className="text-emerald-500" />, text: t('onboarding.tasksFeatureBoard', 'Kanban board with drag & drop') },
          { icon: <CheckCircle2 size={20} className="text-blue-500" />, text: t('onboarding.tasksFeatureSteps', 'Steps with status tracking') },
          { icon: <Zap size={20} className="text-amber-500" />, text: t('onboarding.tasksFeaturePriority', 'Priority ranking — what to do next') },
          { icon: <Tag size={20} className="text-orange-500" />, text: t('onboarding.tasksFeatureType', 'Group by type: fix, buy, call, and more') },
          { icon: <BarChart2 size={20} className="text-purple-500" />, text: t('onboarding.tasksFeatureStats', 'Progress statistics') },
          { icon: <Palette size={20} className="text-pink-500" />, text: t('onboarding.tasksFeatureLabels', 'Custom labels with your own colors') },
          { icon: <Repeat size={20} className="text-violet-500" />, text: t('onboarding.tasksFeatureRoutine', 'Recurring routine tasks') },
          { icon: <Bell size={20} className="text-amber-600" />, text: t('onboarding.tasksFeatureReminder', 'Due-date reminders with snooze') },
        ].map(({ icon, text }, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            {icon}
            <span className="text-sm text-gray-700">{text}</span>
          </div>
        ))}
      </div>
      {CloudSyncNote(t)}
    </div>
  ),
  tasksBoard: (t) => (
    <div className="space-y-4">
      <p className="text-gray-600 leading-relaxed">
        {t('onboarding.tasksBoardDesc', 'Each task appears as a card in its status column. Drag cards between columns to update status instantly.')}
      </p>
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-2">
        {[
          { color: 'bg-blue-500', label: t('tasks.status.active', 'Active'), title: t('onboarding.tasksBoardEx1', 'Design new homepage'), priority: '🔴' },
          { color: 'bg-yellow-500', label: t('tasks.status.on_hold', 'Paused'), title: t('onboarding.tasksBoardEx2', 'Write tests'), priority: '🟡' },
          { color: 'bg-green-500', label: t('tasks.status.completed', 'Done'), title: t('onboarding.tasksBoardEx3', 'Deploy to production'), priority: '🟢' },
        ].map(({ color, label, title, priority }, i) => (
          <div key={i} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-100">
            <div className={`w-2 h-6 rounded-full ${color}`} />
            <span className="text-xs text-gray-500 w-14">{label}</span>
            <span className="text-sm text-gray-800 flex-1">{title}</span>
            <span className="text-xs">{priority}</span>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
        <Lightbulb size={16} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-700">{t('onboarding.tasksBoardTip', 'Tip: Use the N key to quickly add a new task from anywhere.')}</p>
      </div>
      <div className="flex items-start gap-2 p-3 bg-pink-50 rounded-lg border border-pink-100">
        <Palette size={16} className="text-pink-500 shrink-0 mt-0.5" />
        <p className="text-sm text-pink-700">{t('onboarding.tasksBoardColorTip', 'Tip: Give a task its own card color from the edit form to make it stand out on the board.')}</p>
      </div>
    </div>
  ),
  tasksSteps: (t) => (
    <div className="space-y-4">
      <p className="text-gray-600 leading-relaxed">
        {t('onboarding.tasksStepsDesc', 'Break every task into small steps. Each step has a status, description, and due date — and appears on the Timeline.')}
      </p>
      <div className="space-y-2">
        {[
          { icon: <CheckCircle2 size={16} className="text-green-500" />, label: t('onboarding.tasksStepDone', 'Done'), bg: 'bg-green-50 border-green-100' },
          { icon: <Clock size={16} className="text-blue-500" />, label: t('onboarding.tasksStepInProgress', 'In progress'), bg: 'bg-blue-50 border-blue-100' },
          { icon: <List size={16} className="text-gray-400" />, label: t('onboarding.tasksStepTodo', 'To do'), bg: 'bg-gray-50 border-gray-100' },
        ].map(({ icon, label, bg }, i) => (
          <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg border ${bg}`}>
            {icon}
            <span className="text-sm text-gray-700">{label}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 p-2.5 bg-cyan-50 rounded-lg border border-cyan-100">
          <Timer size={16} className="text-cyan-500 shrink-0" />
          <span className="text-xs text-gray-700">{t('onboarding.tasksStepsDuration', 'Estimate duration: minutes, hours, days or months')}</span>
        </div>
        <div className="flex items-center gap-2 p-2.5 bg-pink-50 rounded-lg border border-pink-100">
          <Tag size={16} className="text-pink-500 shrink-0" />
          <span className="text-xs text-gray-700">{t('onboarding.tasksStepsLabels', 'Add colored labels to tasks and steps')}</span>
        </div>
      </div>
      <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <Lightbulb size={16} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">{t('onboarding.tasksStepsTip', 'If a step\'s due date is later than the task due date, you\'ll get a warning on the Timeline.')}</p>
      </div>
    </div>
  ),
  tasksRoutines: (t) => (
    <div className="space-y-4">
      <p className="text-gray-600 leading-relaxed">
        {t('onboarding.tasksRoutinesDesc', 'Set an optional due time, turn tasks into routines, and get browser reminders before they are due. Snooze a reminder if you need a few more minutes.')}
      </p>
      <div className="space-y-2">
        {[
          { icon: <Clock size={16} className="text-blue-500" />, text: t('onboarding.tasksRoutinesDueTime', 'Add a due time for finer scheduling'), bg: 'bg-blue-50 border-blue-100' },
          { icon: <Repeat size={16} className="text-violet-500" />, text: t('onboarding.tasksRoutinesRepeat', 'Daily, weekly, or monthly routines with an optional end date'), bg: 'bg-violet-50 border-violet-100' },
          { icon: <Bell size={16} className="text-amber-500" />, text: t('onboarding.tasksRoutinesNotify', 'Reminders from 15 minutes to 1 day before due'), bg: 'bg-amber-50 border-amber-100' },
        ].map(({ icon, text, bg }, i) => (
          <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg border ${bg}`}>
            {icon}
            <span className="text-sm text-gray-700">{text}</span>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
        <Lightbulb size={16} className="text-emerald-500 shrink-0 mt-0.5" />
        <p className="text-sm text-emerald-700">{t('onboarding.tasksRoutinesSnoozeTip', 'When a reminder appears, snooze it from the task detail or the prompt banner. Mark a routine done to schedule the next occurrence — or stop it with an end date.')}</p>
      </div>
    </div>
  ),
  tasksAI: (t, _o, openAISettings) => (
    <div className="space-y-4">
      <p className="text-gray-600 leading-relaxed">
        {t('onboarding.tasksAIDesc', 'The AI coach helps you plan tasks, break down complex work, and stay focused — powered by Claude.')}
      </p>
      <div className="space-y-2">
        {[
          { emoji: '🎯', text: t('onboarding.tasksAIFeature1', 'Break a vague goal into concrete steps') },
          { emoji: '📊', text: t('onboarding.tasksAIFeature2', 'Estimate time and prioritize work') },
          { emoji: '💡', text: t('onboarding.tasksAIFeature3', 'Get unstuck when you don\'t know where to start') },
        ].map(({ emoji, text }, i) => (
          <div key={i} className="flex items-center gap-3 p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
            <span className="text-lg">{emoji}</span>
            <span className="text-sm text-gray-700">{text}</span>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <span className="text-blue-500 text-lg">🔑</span>
        <div>
          <p className="text-sm text-blue-800 font-medium">{t('onboarding.aiKeyTitle', 'Bring your own API key')}</p>
          <p className="text-xs text-blue-600">{t('onboarding.aiKeyDesc', 'You need a free Anthropic API key. Click the ⚙️ icon in the header to add it.')}</p>
        </div>
        {openAISettings && (
          <button onClick={openAISettings} className="ml-auto text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors whitespace-nowrap">
            {t('onboarding.setKey', 'Set Key')}
          </button>
        )}
      </div>
    </div>
  ),
  tasksShortcuts: (t) => (
    <div className="space-y-3">
      <p className="text-gray-600">{t('onboarding.shortcutsDesc', 'Use keyboard shortcuts to navigate faster:')}</p>
      <div className="space-y-2">
        {[
          { key: 'N', desc: t('onboarding.tasksShortcutN', 'Add a new task') },
          { key: 'Esc', desc: t('onboarding.tasksShortcutEsc', 'Close task detail / cancel edit') },
          { key: '⌘S', desc: t('onboarding.shortcutSave', 'Auto-saved to browser every change') },
        ].map(({ key, desc }) => (
          <div key={key} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-sm font-mono font-bold shadow-sm min-w-[36px] text-center">{key}</kbd>
            <span className="text-sm text-gray-700">{desc}</span>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-100 mt-4">
        <Lightbulb size={16} className="text-emerald-500 shrink-0 mt-0.5" />
        <p className="text-sm text-emerald-700">{t('onboarding.tasksFinalTip', "You're all set! Start by adding your first task and breaking it into steps.")}</p>
      </div>
    </div>
  ),
};

export default function Onboarding({ t, i18n, isRTL, onClose, openNewForm, openAISettings }) {
  const [step, setStep] = useState(0);

  const steps = TASKS_STEPS;

  const isFirst = step === 0;
  const isLast = step === steps.length - 1;
  const Back = isRTL ? ChevronRight : ChevronLeft;
  const Next = isRTL ? ChevronLeft : ChevronRight;

  const handleClose = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.tasksWelcome, '1');
    onClose();
  }, [onClose]);

  const handleLangChange = (lang) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('appLanguage', lang);
  };

  const current = steps[step];
  const contentFn = tasksStepContent[current.titleKey];
  const content = contentFn ? contentFn(t, openNewForm, openAISettings) : null;
  const dialogRef = useRef(null);
  useModalA11y(dialogRef, handleClose);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden outline-none"
      >
        <div className="bg-gradient-to-r from-green-600 to-emerald-700 p-6 text-white shrink-0">
          <div className="flex justify-between items-start mb-4">
            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setStep(i)}
                  aria-label={`${t('onboarding.step', 'Step')} ${i + 1}`}
                  aria-current={i === step ? 'step' : undefined}
                  className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white/20 rounded-lg p-0.5" role="group" aria-label={t('header.language', 'Language')}>
                {[['en','EN'],['he','עב'],['fr','FR']].map(([code, label]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleLangChange(code)}
                    aria-pressed={i18n.language === code}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                      i18n.language === code
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-white/80 hover:text-white hover:bg-white/20'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={handleClose} aria-label={t('chat.close', 'Close')} className="text-white/70 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
          </div>
          {current.titleKey === 'tasksWelcome' ? (
            <div className="mb-3"><AppBrandMark size={48} /></div>
          ) : (
            <div className="text-4xl mb-3" aria-hidden="true">{current.icon}</div>
          )}
          <h2 id="onboarding-title" className="text-2xl font-bold">{t(`onboarding.${current.titleKey}Title`, current.defaults.title)}</h2>
          <p className="text-blue-200 text-sm mt-1">{t(`onboarding.${current.titleKey}Subtitle`, current.defaults.subtitle)}</p>
        </div>

        <div className="p-6 overflow-y-auto flex-1 min-h-0" tabIndex={0}>
          {content}
        </div>

        <div className={`px-6 pb-6 pt-4 gap-2 items-center shrink-0 border-t border-gray-100 ${isFirst ? 'grid grid-cols-3' : 'flex justify-between'}`}>
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={isFirst}
            className={`flex items-center gap-1 px-4 py-2 rounded-lg font-medium transition-colors justify-self-start ${isFirst ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <Back size={16} /> {t('onboarding.back', 'Back')}
          </button>

          {isFirst ? (
            <button
              type="button"
              onClick={handleClose}
              className="text-sm font-medium text-gray-500 hover:text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors justify-self-center"
            >
              {t('onboarding.skip', 'Skip tutorial')}
            </button>
          ) : <span />}

          {isLast ? (
            <button
              onClick={handleClose}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg transition-colors justify-self-end"
            >
              {t('onboarding.getStarted', "Let's go!")} 🚀
            </button>
          ) : (
            <button
              onClick={() => setStep(s => s + 1)}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg transition-colors justify-self-end"
            >
              {t('onboarding.next', 'Next')} <Next size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
