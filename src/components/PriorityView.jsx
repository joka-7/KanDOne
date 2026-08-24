import { useMemo, useState } from 'react';
import { Flame, Zap, Hammer, Brush, Moon, Settings2, Calendar, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { groupTasksByPriority, PRIORITY_GROUPS, getBandStyle } from '../utils/taskPriority';
import { DEFAULT_EFFORT_TIERS, EFFORT_TICKS } from '../utils/effortScale';
import EffortPicker, { EffortChip } from './EffortPicker';
import PriorityBadge from './PriorityBadge';
import { LabelChipsReadOnly } from './LabelPicker';
import { safeStr, formatDate } from '../utils/taskHelpers';

/**
 * Ranked "what do I do next" view.
 *
 * Order is deliberate: anything with a deadline on it comes first, then the
 * quick wins (big impact, small effort) — the bucket that a plain date-sorted
 * list buries.
 */
const GROUP_META = {
  doNow: { icon: Flame, accent: 'text-red-500', fallback: 'Do Now' },
  bise: { icon: Zap, accent: 'text-amber-500', fallback: 'Quick Wins' },
  bigProject: { icon: Hammer, accent: 'text-indigo-500', fallback: 'Big Projects' },
  fillIn: { icon: Brush, accent: 'text-sky-500', fallback: 'Fill-ins' },
  later: { icon: Moon, accent: 'text-gray-400', fallback: 'Later' },
};

const IMPACT_STYLES = {
  high: 'bg-purple-100 text-purple-700 border-purple-200',
  medium: 'bg-gray-100 text-gray-600 border-gray-200',
  low: 'bg-gray-50 text-gray-500 border-gray-200',
};

function TaskRow({ task, priority, tiers, labels, onOpen, tt, lang, isRTL }) {
  const style = getBandStyle(priority.band);
  const overdue = priority.urgency === 'overdue';
  return (
    <button
      type="button"
      onClick={() => onOpen(task.id)}
      data-testid="priority-task-row"
      style={task.cardColor ? { backgroundColor: task.cardColor } : undefined}
      className={`w-full ${isRTL ? 'text-right border-r-4' : 'text-left border-l-4'} ${style.stripe} ${
        task.cardColor ? '' : 'bg-white hover:bg-emerald-50 active:bg-emerald-100'
      } border border-gray-200 rounded-lg px-3 py-2.5 min-h-[52px] transition-colors`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-gray-800 text-xs sm:text-sm leading-snug flex-1">
          {safeStr(task.name) || tt('priorityView.untitled', 'Untitled')}
        </p>
        <PriorityBadge priority={priority} tt={tt} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${IMPACT_STYLES[priority.impact]}`}>
          {tt('form.impact', 'Impact')}: {tt(`impact.${priority.impact}`, priority.impact)}
        </span>
        <EffortChip effort={task.effort?.value ? task.effort : task.duration} tt={tt} tiers={tiers} />
        {priority.urgency && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${
            overdue ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-500 border-gray-200'
          }`}>
            {tt(`urgency.${priority.urgency}`, priority.urgency)}
          </span>
        )}
        {task.dueDate && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] ${overdue ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
            {overdue ? <AlertCircle size={9} /> : <Calendar size={9} />}
            {formatDate(task.dueDate, lang)}
          </span>
        )}
      </div>
      {(task.labelIds || []).length > 0 && (
        <div className="mt-1.5">
          <LabelChipsReadOnly labels={labels} labelIds={task.labelIds} />
        </div>
      )}
    </button>
  );
}

/** Two cut-point pickers that define what "small" and "medium" effort mean. */
function TierSettings({ tiers, onChange, tt }) {
  const tickAt = (index) => EFFORT_TICKS[index];
  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-3">
      <p className="text-xs text-gray-500">
        {tt('effort.tiersHint', 'Choose where small and medium effort end. Everything above is a big task.')}
      </p>
      <EffortPicker
        label={tt('effort.smallUpTo', 'Small effort — up to')}
        value={tickAt(tiers.smallMaxIndex)}
        onChange={(next) => onChange({ ...tiers, smallMaxIndex: next })}
        tiers={tiers}
        tt={tt}
        size="sm"
        allowNone={false}
      />
      <EffortPicker
        label={tt('effort.mediumUpTo', 'Medium effort — up to')}
        value={tickAt(tiers.mediumMaxIndex)}
        onChange={(next) => onChange({ ...tiers, mediumMaxIndex: next })}
        tiers={tiers}
        tt={tt}
        size="sm"
        allowNone={false}
      />
    </div>
  );
}

export default function PriorityView({
  tasks = [],
  labels = [],
  tiers = DEFAULT_EFFORT_TIERS,
  onTiersChange,
  onOpenTask,
  isRTL = false,
}) {
  const { t, i18n } = useTranslation();
  const tt = (key, fallback) => t(`tasks.${key}`, fallback);
  const [showSettings, setShowSettings] = useState(false);

  const groups = useMemo(() => groupTasksByPriority(tasks, { tiers }), [tasks, tiers]);
  const total = PRIORITY_GROUPS.reduce((sum, id) => sum + groups[id].length, 0);

  // The pickers hand back a {value, unit}; the cut-points are stored as indexes.
  const handleTierChange = ({ smallMaxIndex, mediumMaxIndex, ...rest }) => {
    const toIndex = (next, current) => {
      if (typeof next === 'number') return next;
      const found = EFFORT_TICKS.findIndex(tick => tick.unit === next?.unit && tick.value === next?.value);
      return found === -1 ? current : found;
    };
    onTiersChange({
      smallMaxIndex: toIndex(smallMaxIndex, tiers.smallMaxIndex),
      mediumMaxIndex: toIndex(mediumMaxIndex, tiers.mediumMaxIndex),
      ...rest,
    });
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-5">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-800">
              {tt('priorityView.title', 'What to do next')}
            </h2>
            <p className="text-xs text-gray-500">
              {tt('priorityView.subtitle', 'Ranked by urgency, impact and effort.')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings(v => !v)}
            aria-expanded={showSettings}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 min-h-[34px]"
          >
            <Settings2 size={14} />
            {tt('effort.tiersButton', 'Effort sizes')}
          </button>
        </div>

        {showSettings && (
          <TierSettings tiers={tiers} onChange={handleTierChange} tt={tt} />
        )}

        {total === 0 ? (
          <p className="text-center text-sm text-gray-400 py-10">
            {tt('priorityView.empty', 'No tasks to rank yet.')}
          </p>
        ) : (
          PRIORITY_GROUPS.map((id) => {
            const entries = groups[id];
            if (entries.length === 0) return null;
            const { icon: Icon, accent, fallback } = GROUP_META[id];
            return (
              <section key={id} className="space-y-1.5">
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
                  <Icon size={14} className={accent} />
                  {tt(`priorityView.group.${id}`, fallback)}
                  <span className="text-gray-500 font-normal">({entries.length})</span>
                </h3>
                <div className="space-y-1.5">
                  {entries.map(({ task, priority }) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      priority={priority}
                      tiers={tiers}
                      labels={labels}
                      onOpen={onOpenTask}
                      tt={tt}
                      lang={i18n.language}
                      isRTL={isRTL}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
