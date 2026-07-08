import React, { useState } from 'react';
import { X, Layout, List, Activity, BarChart2, Lightbulb, ChevronRight, ChevronLeft, Upload, Plus, CheckCircle2, Clock, Calendar } from 'lucide-react';
import AppBrandMark from './AppBrandMark';
import { STORAGE_KEYS } from '../storageKeys.js';

const TASKS_STEPS = [
  {
    icon: '👋',
    titleKey: 'tasksWelcome',
    defaults: { title: 'Welcome to Task Manager!', subtitle: 'Plan work, track progress, get things done' },
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
          { icon: <Calendar size={20} className="text-orange-500" />, text: t('onboarding.tasksFeatureTimeline', 'Timeline & due dates') },
          { icon: <BarChart2 size={20} className="text-purple-500" />, text: t('onboarding.tasksFeatureStats', 'Progress statistics') },
        ].map(({ icon, text }, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            {icon}
            <span className="text-sm text-gray-700">{text}</span>
          </div>
        ))}
      </div>
    </div>
  ),
  tasksBoard: (t) => (
    <div className="space-y-4">
      <p className="text-gray-600 leading-relaxed">
        {t('onboarding.tasksBoardDesc', 'Each task appears as a card in its status column. Drag cards between columns to update status instantly.')}
      </p>
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-2">
        {[
          { color: 'bg-blue-500', label: 'Active', title: t('onboarding.tasksBoardEx1', 'Design new homepage'), priority: '🔴' },
          { color: 'bg-yellow-500', label: 'Paused', title: t('onboarding.tasksBoardEx2', 'Write tests'), priority: '🟡' },
          { color: 'bg-green-500', label: 'Done', title: t('onboarding.tasksBoardEx3', 'Deploy to production'), priority: '🟢' },
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
      <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <Lightbulb size={16} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">{t('onboarding.tasksStepsTip', 'If a step\'s due date is later than the task due date, you\'ll get a warning on the Timeline.')}</p>
      </div>
    </div>
  ),
  tasksAI: (t, _o, _f, openAISettings) => (
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

const STEPS = [
  {
    icon: '👋',
    titleKey: 'welcome',
    defaults: { title: 'Welcome to JobFlowTracker!', subtitle: 'Your personal job search command center' },
  },
  {
    icon: '📋',
    titleKey: 'board',
    defaults: { title: 'Status Board', subtitle: 'Visualize your pipeline with drag & drop' },
  },
  {
    icon: '✏️',
    titleKey: 'list',
    defaults: { title: 'List & Edit', subtitle: 'Manage companies and track interviews' },
  },
  {
    icon: '🤖',
    titleKey: 'ai',
    defaults: { title: 'AI Assistant', subtitle: 'Get personalized prep tips powered by Claude' },
  },
  {
    icon: '⌨️',
    titleKey: 'shortcuts',
    defaults: { title: 'Keyboard Shortcuts', subtitle: 'Work faster with shortcuts' },
  },
];

const stepContent = {
  welcome: (t, _o, _f, _a, isRecruiter) => (
    <div className="space-y-4 text-center">
      <p className="text-gray-600 text-lg leading-relaxed">
        {isRecruiter
          ? t('onboarding.recruiterWelcomeDesc', 'Manage your candidates pipeline — track every applicant, interview, and decision in one place.')
          : t('onboarding.welcomeDesc', 'Track every company, interview, and rejection — all in one place. Your data stays private in your browser.')}
      </p>
      <div className="grid grid-cols-2 gap-3 mt-6 text-left">
        {(isRecruiter ? [
          { icon: <Layout size={20} className="text-blue-500" />, text: t('onboarding.recruiterFeatureBoard', 'Kanban board with drag & drop') },
          { icon: <List size={20} className="text-purple-500" />, text: t('onboarding.recruiterFeatureList', 'Detailed candidate profiles') },
          { icon: <Activity size={20} className="text-green-500" />, text: t('onboarding.recruiterFeatureTimeline', 'Hiring timeline') },
          { icon: <BarChart2 size={20} className="text-orange-500" />, text: t('onboarding.recruiterFeatureStats', 'Pipeline stats') },
        ] : [
          { icon: <Layout size={20} className="text-blue-500" />, text: t('onboarding.featureBoard', 'Kanban board with drag & drop') },
          { icon: <List size={20} className="text-purple-500" />, text: t('onboarding.featureList', 'Detailed company profiles') },
          { icon: <Activity size={20} className="text-green-500" />, text: t('onboarding.featureTimeline', 'Interview timeline') },
          { icon: <BarChart2 size={20} className="text-orange-500" />, text: t('onboarding.featureStats', 'Stats & upcoming events') },
        ]).map(({ icon, text }, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            {icon}
            <span className="text-sm text-gray-700">{text}</span>
          </div>
        ))}
      </div>
    </div>
  ),
  board: (t) => (
    <div className="space-y-4">
      <p className="text-gray-600 leading-relaxed">
        {t('onboarding.boardDesc', 'Each company appears as a card in its status column. Drag cards between columns to update their status instantly.')}
      </p>
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-2">
        <div className="flex items-center gap-3 p-2 bg-blue-50 rounded-lg border border-blue-100">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">AC</div>
          <div>
            <div className="font-bold text-sm text-gray-800">Acme Corp</div>
            <div className="text-xs text-gray-500">Senior Engineer</div>
          </div>
          <div className="ml-auto flex gap-1">
            <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded font-medium">HR</span>
            <span className="text-gray-300 text-[10px]">›</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded font-medium">Tech</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 text-center">{t('onboarding.dragHint', '↑ Interview journey chips show your progress')}</p>
      </div>
      <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
        <Lightbulb size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-700">{t('onboarding.boardTip', 'Tip: Download a JSON backup daily from the top bar to never lose your data.')}</p>
      </div>
    </div>
  ),
  list: (t, openNewForm, triggerFileInput) => (
    <div className="space-y-4">
      <p className="text-gray-600 leading-relaxed">
        {t('onboarding.listDesc', 'The List tab is your editing hub. Click any company to view details, or add interviews and rejection notes.')}
      </p>
      <div className="grid grid-cols-1 gap-3">
        <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Upload size={16} className="text-indigo-600" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-800">{t('onboarding.importTitle', 'Import existing data')}</div>
            <div className="text-xs text-gray-500">{t('onboarding.importDesc', 'Load a JSON backup you saved previously')}</div>
          </div>
          <button
            onClick={triggerFileInput}
            className="ml-auto text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
          >
            {t('onboarding.load', 'Load')}
          </button>
        </div>
        <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <Plus size={16} className="text-green-600" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-800">{t('onboarding.addTitle', 'Start fresh')}</div>
            <div className="text-xs text-gray-500">{t('onboarding.addDesc', 'Add your first company manually')}</div>
          </div>
          <button
            onClick={openNewForm}
            className="ml-auto text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors"
          >
            {t('onboarding.add', 'Add')}
          </button>
        </div>
      </div>
    </div>
  ),
  ai: (t, _o, _f, openAISettings) => (
    <div className="space-y-4">
      <p className="text-gray-600 leading-relaxed">
        {t('onboarding.aiDesc', 'The AI Assistant reads your company data and gives you personalized interview prep tips and rejection analysis — powered by Claude.')}
      </p>
      <div className="space-y-2">
        {[
          { emoji: '🎯', text: t('onboarding.aiFeature1', 'Interview prep: 3 targeted tips before each interview') },
          { emoji: '📊', text: t('onboarding.aiFeature2', 'Rejection analysis: learn what to improve') },
          { emoji: '🔍', text: t('onboarding.aiFeature3', 'Pattern analysis: spot trends in your job hunt') },
        ].map(({ emoji, text }, i) => (
          <div key={i} className="flex items-center gap-3 p-2.5 bg-purple-50 rounded-lg border border-purple-100">
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
          <button
            onClick={openAISettings}
            className="ml-auto text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            {t('onboarding.setKey', 'Set Key')}
          </button>
        )}
      </div>
    </div>
  ),
  shortcuts: (t) => (
    <div className="space-y-3">
      <p className="text-gray-600">{t('onboarding.shortcutsDesc', 'Use keyboard shortcuts to navigate faster:')}</p>
      <div className="space-y-2">
        {[
          { key: 'N', desc: t('onboarding.shortcutN', 'Add a new company') },
          { key: 'Esc', desc: t('onboarding.shortcutEsc', 'Close company detail / cancel edit') },
          { key: '⌘S', desc: t('onboarding.shortcutSave', 'Auto-saved to browser every change') },
        ].map(({ key, desc }) => (
          <div key={key} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-sm font-mono font-bold shadow-sm min-w-[36px] text-center">{key}</kbd>
            <span className="text-sm text-gray-700">{desc}</span>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg border border-green-100 mt-4">
        <Lightbulb size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-green-700">{t('onboarding.finalTip', "You're all set! Add rejection notes to every rejection — the AI can spot patterns to help you improve.")}</p>
      </div>
    </div>
  ),
};

export default function Onboarding({ t, i18n, isRTL, onClose, openNewForm, triggerFileInput, openAISettings, isRecruiter = false, isTasks = false }) {
  const [step, setStep] = useState(0);

  const steps = isTasks ? TASKS_STEPS : STEPS;
  const content_map = isTasks ? tasksStepContent : stepContent;

  const isFirst = step === 0;
  const isLast = step === steps.length - 1;
  const Back = isRTL ? ChevronRight : ChevronLeft;
  const Next = isRTL ? ChevronLeft : ChevronRight;

  const storageKey = isTasks ? STORAGE_KEYS.tasksWelcome : isRecruiter ? STORAGE_KEYS.recruiterOnboarding : STORAGE_KEYS.jobSeekerOnboarding;

  const handleClose = () => {
    localStorage.setItem(storageKey, '1');
    onClose();
  };

  const handleLangChange = (lang) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('appLanguage', lang);
  };

  const current = steps[step];
  const contentFn = content_map[current.titleKey];
  const content = contentFn ? contentFn(t, openNewForm, triggerFileInput, openAISettings, isRecruiter) : null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className={`bg-gradient-to-r ${isTasks ? 'from-green-600 to-emerald-700' : 'from-blue-600 to-indigo-700'} p-6 text-white`}>
          <div className="flex justify-between items-start mb-4">
            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white/20 rounded-lg p-0.5">
                {[['en','EN'],['he','עב'],['fr','FR']].map(([code, label]) => (
                  <button
                    key={code}
                    onClick={() => handleLangChange(code)}
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
              <button onClick={handleClose} className="text-white/70 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
          </div>
          {current.titleKey === 'welcome' ? (
            <div className="mb-3"><AppBrandMark size={48} /></div>
          ) : (
            <div className="text-4xl mb-3">{current.icon}</div>
          )}
          <h2 className="text-2xl font-bold">{t(`onboarding.${current.titleKey}Title`, current.defaults.title)}</h2>
          <p className="text-blue-200 text-sm mt-1">{t(`onboarding.${current.titleKey}Subtitle`, current.defaults.subtitle)}</p>
        </div>

        <div className="p-6">
          {content}
        </div>

        <div className={`px-6 pb-6 gap-2 items-center ${isFirst ? 'grid grid-cols-3' : 'flex justify-between'}`}>
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
              className={`flex items-center gap-2 px-6 py-2 ${isTasks ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white font-bold rounded-lg transition-colors justify-self-end`}
            >
              {t('onboarding.getStarted', "Let's go!")} 🚀
            </button>
          ) : (
            <button
              onClick={() => setStep(s => s + 1)}
              className={`flex items-center gap-2 px-6 py-2 ${isTasks ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white font-bold rounded-lg transition-colors justify-self-end`}
            >
              {t('onboarding.next', 'Next')} <Next size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
