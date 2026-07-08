import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search, Copy, Check } from 'lucide-react';
import { TEMPLATES } from '../data/interviewTemplates';
import { TASK_TEMPLATES } from '../data/taskTemplates';
import { getLocalizedQuestions, getLocalizedCategoryLabel } from '../utils/templateQuestions';

const COLOR_MAP = {
  blue:   { pill: 'bg-blue-100 text-blue-800 border-blue-200',   active: 'bg-blue-600 text-white border-blue-600'   },
  purple: { pill: 'bg-purple-100 text-purple-800 border-purple-200', active: 'bg-purple-600 text-white border-purple-600' },
  yellow: { pill: 'bg-yellow-100 text-yellow-800 border-yellow-200', active: 'bg-yellow-500 text-white border-yellow-500' },
  orange: { pill: 'bg-orange-100 text-orange-800 border-orange-200', active: 'bg-orange-500 text-white border-orange-500' },
  green:  { pill: 'bg-green-100 text-green-800 border-green-200', active: 'bg-green-600 text-white border-green-600'  },
  indigo: { pill: 'bg-indigo-100 text-indigo-800 border-indigo-200', active: 'bg-indigo-600 text-white border-indigo-600' },
};

function CopyButton({ text, label, copiedLabel }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <button
      onClick={handleCopy}
      title={copied ? copiedLabel : label}
      className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border transition-all ${
        copied
          ? 'bg-green-100 text-green-700 border-green-300'
          : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200 hover:text-gray-700'
      }`}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? copiedLabel : label}
    </button>
  );
}

export default function TemplateLibrary({ t: tProp, onClose, onStartSimulation, isRecruiter, libraryMode }) {
  const { t: tI18n, i18n } = useTranslation();
  const t = tProp || tI18n;
  const isTasks = libraryMode === 'tasks';
  const templates = isTasks ? TASK_TEMPLATES : TEMPLATES;
  const categoryKeys = Object.keys(templates);
  const [activeCategory, setActiveCategory] = useState(categoryKeys[0]);
  const [searchQuery, setSearchQuery] = useState('');

  const localizedTemplates = useMemo(() => {
    const out = {};
    categoryKeys.forEach((key) => {
      const cat = templates[key];
      out[key] = {
        ...cat,
        label: getLocalizedCategoryLabel(t, isTasks, key, cat.label),
        questions: getLocalizedQuestions(t, isTasks, key, cat.questions),
      };
    });
    return out;
  }, [t, i18n.language, isTasks, templates, categoryKeys]);

  const isSearching = searchQuery.trim().length > 0;

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const q = searchQuery.trim().toLowerCase();
    const results = [];
    categoryKeys.forEach((key) => {
      const cat = localizedTemplates[key];
      cat.questions.forEach((question) => {
        if (question.toLowerCase().includes(q)) {
          results.push({
            question,
            categoryKey: key,
            categoryLabel: cat.label,
            categoryIcon: cat.icon,
            color: cat.color,
          });
        }
      });
    });
    return results;
  }, [searchQuery, localizedTemplates, categoryKeys, isSearching]);

  const activeTemplate = localizedTemplates[activeCategory];

  const copyLabel = t('templates.copy', 'Copy');
  const copiedLabel = t('templates.copied', 'Copied!');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r text-white flex-shrink-0 ${
          isTasks ? 'from-emerald-600 to-green-600' : isRecruiter ? 'from-amber-500 to-yellow-500' : 'from-indigo-600 to-blue-600'
        }`}>
          <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
            📚 {isTasks
              ? t('templates.titleTasks', 'Task Planning Prompts')
              : isRecruiter
                ? t('templates.titleRecruiter', 'Candidate Interview Guide')
                : t('templates.title', 'Interview Template Library')}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('templates.search', 'Search questions...')}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50"
            />
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar — category pills */}
          {!isSearching && (
            <aside className="w-44 flex-shrink-0 border-r border-gray-100 py-4 px-3 overflow-y-auto bg-gray-50 space-y-1">
              {categoryKeys.map((key) => {
                const cat = localizedTemplates[key];
                const colors = COLOR_MAP[cat.color] || COLOR_MAP.indigo;
                const isActive = activeCategory === key;
                return (
                  <div key={key} className="space-y-0.5">
                    <button
                      onClick={() => setActiveCategory(key)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium border transition-all flex items-center gap-2 ${
                        isActive ? colors.active : colors.pill + ' hover:opacity-80'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span className="leading-tight">{cat.label}</span>
                    </button>
                    {isActive && onStartSimulation && (
                      <button
                        type="button"
                        data-testid="template-start-simulation"
                        onClick={() => onStartSimulation(key)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all text-white flex items-center gap-1.5 ${
                          isTasks
                            ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600'
                            : isRecruiter
                              ? 'bg-amber-500 hover:bg-amber-600 border-amber-500'
                              : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-600'
                        }`}
                      >
                        🎭 {isTasks
                          ? t('templates.practiceButtonTasks', 'Practice with AI coach')
                          : isRecruiter
                            ? t('templates.practiceButtonRecruiter', 'Practice conducting')
                            : t('templates.practiceButton', 'Mock interview')}
                      </button>
                    )}
                  </div>
                );
              })}
            </aside>
          )}

          {/* Right content — questions list */}
          <main className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
            {isSearching ? (
              searchResults.length === 0 ? (
                <div className="text-center text-gray-400 py-12 text-sm">
                  {t('templates.noSearchResults', 'No questions match your search.')}
                </div>
              ) : (
                searchResults.map(({ question, categoryKey, categoryLabel, categoryIcon, color }, i) => {
                  const colors = COLOR_MAP[color] || COLOR_MAP.indigo;
                  return (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 leading-snug">{question}</p>
                        <span className={`inline-block mt-1.5 text-[11px] px-2 py-0.5 rounded-full font-semibold border ${colors.pill}`}>
                          {categoryIcon} {categoryLabel}
                        </span>
                      </div>
                      <CopyButton text={question} label={copyLabel} copiedLabel={copiedLabel} />
                    </div>
                  );
                })
              )
            ) : (
              <>
                <div className="flex items-center justify-between mb-3 px-1">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {activeTemplate.icon} {activeTemplate.label}
                    <span className="ml-2 font-normal normal-case">({activeTemplate.questions.length})</span>
                  </p>
                  {onStartSimulation && (
                    <button
                      type="button"
                      data-testid="template-start-simulation"
                      onClick={() => onStartSimulation(activeCategory)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-bold rounded-lg transition-colors ${
                        isTasks
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : isRecruiter
                            ? 'bg-amber-500 hover:bg-amber-600'
                            : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      🎭 {isTasks
                        ? t('templates.practiceButtonTasks', 'Practice with AI coach')
                        : isRecruiter
                          ? t('templates.practiceButtonRecruiter', 'Practice conducting')
                          : t('templates.practiceButton', 'Mock interview')}
                    </button>
                  )}
                </div>
                {activeTemplate.questions.map((question, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <p className="flex-1 text-sm text-gray-800 leading-snug">{question}</p>
                    <CopyButton text={question} label={copyLabel} copiedLabel={copiedLabel} />
                  </div>
                ))}
              </>
            )}
          </main>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <p className="text-xs text-gray-500 text-center">
            {isTasks
              ? t('templates.footerTasks', 'Use these prompts when planning, breaking down, or reviewing tasks.')
              : t('templates.footer', 'Use these to practice. Behavioral answers should follow the STAR format.')}
          </p>
        </div>
      </div>
    </div>
  );
}
