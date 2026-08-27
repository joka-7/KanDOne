import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Calendar } from 'lucide-react';
import { groupTasksByType, TYPE_GROUPS, UNTYPED, TYPE_ICONS } from '../utils/taskTypes';
import { scoreTask, getBandStyle } from '../utils/taskPriority';
import { DEFAULT_EFFORT_TIERS } from '../utils/effortScale';
import { EffortChip } from './EffortPicker';
import PriorityBadge from './PriorityBadge';
import { LabelChipsReadOnly } from './LabelPicker';
import { safeStr, formatDate } from '../utils/taskHelpers';

function TaskRow({ task, tiers, labels, onOpen, tt, lang, isRTL }) {
  const priority = scoreTask(task, { tiers });
  const style = getBandStyle(priority.band);
  const overdue = priority.urgency === 'overdue';
  return (
    <button
      type="button"
      onClick={() => onOpen(task.id)}
      data-testid="type-task-row"
      style={task.cardColor ? { backgroundColor: task.cardColor } : undefined}
      className={`w-full ${isRTL ? 'text-right border-r-4' : 'text-left border-l-4'} ${style.stripe} ${
        task.cardColor ? '' : 'bg-white hover:bg-emerald-50 active:bg-emerald-100'
      } border border-gray-200 rounded-lg px-3 py-2.5 min-h-[52px] transition-colors`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-gray-800 text-xs sm:text-sm leading-snug flex-1">
          {safeStr(task.name) || tt('priorityView.untitled', 'Untitled')}
        </p>
        <PriorityBadge priority={priority} tt={tt} showBise={false} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        <EffortChip effort={task.effort?.value ? task.effort : task.duration} tt={tt} tiers={tiers} />
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

/**
 * "By Type" view: every task bucketed under its action-verb type, so
 * everything of one kind — every "buy", every "call" — reads as one list
 * regardless of status or due date.
 */
export default function TypeView({
  tasks = [],
  labels = [],
  tiers = DEFAULT_EFFORT_TIERS,
  onOpenTask,
  isRTL = false,
}) {
  const { t, i18n } = useTranslation();
  const tt = (key, fallback) => t(`tasks.${key}`, fallback);

  const groups = useMemo(() => groupTasksByType(tasks), [tasks]);
  const total = tasks.length;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-5">
      <div className="max-w-3xl mx-auto space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-gray-800">
            {tt('typeView.title', 'By Type')}
          </h2>
          <p className="text-xs text-gray-500">
            {tt('typeView.subtitle', 'Every task grouped by what kind of action it is.')}
          </p>
        </div>

        {total === 0 ? (
          <p className="text-center text-sm text-gray-400 py-10">
            {tt('typeView.empty', 'No tasks yet.')}
          </p>
        ) : (
          TYPE_GROUPS.map((id) => {
            const entries = groups[id];
            if (entries.length === 0) return null;
            const Icon = TYPE_ICONS[id];
            return (
              <section key={id} className="space-y-1.5">
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
                  {Icon
                    ? <Icon size={14} className="text-gray-500" />
                    : <span className="w-[14px]" aria-hidden="true" />}
                  {id === UNTYPED ? tt('type.untyped', 'No type') : tt(`type.${id}`, id)}
                  <span className="text-gray-500 font-normal">({entries.length})</span>
                </h3>
                <div className="space-y-1.5">
                  {entries.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
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
