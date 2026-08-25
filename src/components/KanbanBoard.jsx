import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Calendar, GripVertical, AlertCircle, Repeat, Bell, Timer,
} from 'lucide-react';
import { STATUSES_TASKS } from '../statuses';
import { LabelChipsReadOnly } from './LabelPicker';
import {
  safeStr, getNextPendingStep, formatDate, formatDuration, isTaskOverdue,
} from '../utils/taskHelpers';
import { formatDueDateTime } from '../utils/reminders';
import { sortByBoardOrder } from '../utils/boardOrder';
import { scoreTask, getBandStyle } from '../utils/taskPriority';
import { DEFAULT_EFFORT_TIERS } from '../utils/effortScale';
import { EffortChip } from './EffortPicker';
import PriorityBadge from './PriorityBadge';

const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-orange-100 text-orange-700 border-orange-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
};

function columnDroppableId(statusId) {
  return `column:${statusId}`;
}

function BoardColumn({ statusId, colorClass, label, count, emptyLabel, children, itemIds }) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnDroppableId(statusId),
    data: { type: 'column', status: statusId },
  });

  return (
    <div
      ref={setNodeRef}
      data-board-column={statusId}
      role="region"
      aria-label={label}
      className={`board-column w-full sm:w-72 sm:flex-shrink-0 flex flex-col sm:h-full bg-white rounded-2xl shadow-sm border overflow-hidden ${
        isOver ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-gray-100'
      }`}
    >
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${colorClass}`}>
            {label}
          </span>
          <span className="text-gray-400 text-xs sm:text-sm font-medium">{count}</span>
        </div>
      </div>
      <div className="p-2 sm:p-3 space-y-2 sm:space-y-3 sm:flex-1 sm:overflow-y-auto sm:custom-scrollbar sm:min-h-[80px]">
        {count === 0 && (
          <div className="text-center text-xs text-gray-300 italic py-4">{emptyLabel}</div>
        )}
        <SortableContext
          id={columnDroppableId(statusId)}
          items={itemIds}
          strategy={verticalListSortingStrategy}
        >
          {children}
        </SortableContext>
      </div>
    </div>
  );
}

function SortableTaskCard({
  task, labels, lang, tt, t, onOpen, renderProgressBar,
  tiers = DEFAULT_EFFORT_TIERS, isRTL = false,
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({
    id: String(task.id),
    data: { type: 'task', status: task.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : undefined,
    ...(task.cardColor ? { backgroundColor: task.cardColor } : {}),
  };
  const overdue = isTaskOverdue(task);
  const next = getNextPendingStep(task);
  const priority = scoreTask(task, { tiers });

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-task-id={task.id}
      data-testid="board-task-card"
      aria-label={`${safeStr(task.name)}. ${tt('board.dragHandle', 'Drag to reorder')}`}
      onClick={() => onOpen(task.id)}
      className={`${task.cardColor ? '' : 'bg-white'} border rounded-xl p-2.5 sm:p-3 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-emerald-300 active:bg-emerald-50/50 transition-shadow group touch-manipulation ${
        isRTL ? 'border-r-4' : 'border-l-4'
      } ${getBandStyle(priority.band).stripe} ${
        overdue ? 'border-red-300' : 'border-gray-200'
      } ${isDragging ? 'z-10 shadow-lg' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-semibold text-gray-800 text-xs sm:text-sm leading-snug flex-1">{safeStr(task.name)}</p>
        <span
          className="text-gray-300 shrink-0 mt-0.5 p-0.5 rounded"
          aria-hidden="true"
          data-testid="board-drag-handle"
        >
          <GripVertical size={16} />
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <PriorityBadge priority={priority} tt={tt} />
        <EffortChip effort={task.effort?.value ? task.effort : task.duration} tt={tt} tiers={tiers} />
        {task.priority && (
          <span className={`inline-block text-xs px-1.5 py-0.5 rounded border font-medium ${PRIORITY_COLORS[task.priority]}`}>
            {t(`priority.${task.priority}`, task.priority)}
          </span>
        )}
      </div>
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
      {typeof renderProgressBar === 'function' ? renderProgressBar(task) : null}
      {next && (
        <div className="mt-2 text-xs text-gray-500 truncate">
          <span className="text-gray-400">{tt('detail.nextStep', 'Next')}: </span>
          {safeStr(next.title)}
        </div>
      )}
    </div>
  );
}

function resolveDropTarget(over, tasksById, activeStatus) {
  if (!over) return { toStatus: null, overId: null };
  const overIdRaw = String(over.id);

  if (overIdRaw.startsWith('column:')) {
    return { toStatus: overIdRaw.slice('column:'.length), overId: null };
  }

  const overTask = tasksById.get(overIdRaw);
  if (overTask) {
    return { toStatus: overTask.status, overId: overIdRaw };
  }

  const dataStatus = over.data?.current?.status;
  if (dataStatus) return { toStatus: dataStatus, overId: null };

  return { toStatus: activeStatus, overId: null };
}

/**
 * Kanban board with pointer + touch DnD (dnd-kit).
 * Reorder within a column or move across columns (status change).
 */
export default function KanbanBoard({
  tasks,
  labels,
  lang,
  t,
  tt,
  onOpenTask,
  onBoardDragEnd,
  renderProgressBar,
  tiers = DEFAULT_EFFORT_TIERS,
  isRTL = false,
}) {
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const tasksByStatus = useMemo(() => {
    const map = {};
    for (const status of STATUSES_TASKS) {
      map[status.id] = sortByBoardOrder(tasks.filter((task) => task.status === status.id));
    }
    return map;
  }, [tasks]);

  const tasksById = useMemo(() => {
    const map = new Map();
    tasks.forEach((task) => map.set(String(task.id), task));
    return map;
  }, [tasks]);

  const activeTask = activeId ? tasksById.get(String(activeId)) : null;

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeTaskId = String(active.id);
    const fromTask = tasksById.get(activeTaskId);
    if (!fromTask) return;

    const { toStatus, overId } = resolveDropTarget(over, tasksById, fromTask.status);
    if (!toStatus) return;

    onBoardDragEnd({
      activeId: activeTaskId,
      overId,
      toStatus,
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(event) => setActiveId(event.active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex-1 overflow-x-auto p-3 sm:p-6 bg-slate-50 min-h-0 flex flex-col sm:flex-row gap-4 sm:gap-6">
        {STATUSES_TASKS.map((status) => {
          const columnTasks = tasksByStatus[status.id] || [];
          const itemIds = columnTasks.map((task) => String(task.id));
          return (
            <BoardColumn
              key={status.id}
              statusId={status.id}
              colorClass={status.color}
              label={tt(`status.${status.id}`, status.id)}
              count={columnTasks.length}
              emptyLabel={tt('board.emptyColumn', 'Drop a task here')}
              itemIds={itemIds}
            >
              {columnTasks.map((task) => (
                <SortableTaskCard
                  key={task.id}
                  task={task}
                  labels={labels}
                  lang={lang}
                  tt={tt}
                  t={t}
                  onOpen={onOpenTask}
                  renderProgressBar={renderProgressBar}
                  tiers={tiers}
                  isRTL={isRTL}
                />
              ))}
            </BoardColumn>
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div
            className={`${activeTask.cardColor ? '' : 'bg-white'} border border-emerald-400 rounded-xl p-2.5 sm:p-3 shadow-xl cursor-grabbing max-w-[18rem]`}
            style={activeTask.cardColor ? { backgroundColor: activeTask.cardColor } : undefined}
          >
            <p className="font-semibold text-gray-800 text-sm">{safeStr(activeTask.name)}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
