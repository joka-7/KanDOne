import { Repeat, Bell } from 'lucide-react';
import { DEFAULT_ROUTINE } from '../utils/recurrence.js';
import { DEFAULT_REMINDER, REMINDER_MINUTES } from '../utils/reminders.js';

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export default function RoutineReminderFields({ formData, setFormData, tt, onReminderEnable }) {
  const routine = formData.routine || DEFAULT_ROUTINE;
  const reminder = formData.reminder || DEFAULT_REMINDER;

  const setRoutine = (patch) => {
    setFormData(prev => ({ ...prev, routine: { ...(prev.routine || DEFAULT_ROUTINE), ...patch } }));
  };

  const setReminder = (patch) => {
    setFormData(prev => ({ ...prev, reminder: { ...(prev.reminder || DEFAULT_REMINDER), ...patch } }));
  };

  const toggleWeekday = (day) => {
    const current = routine.weekdays || DEFAULT_ROUTINE.weekdays;
    const next = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day].sort();
    setRoutine({ weekdays: next.length > 0 ? next : [day] });
  };

  const handleReminderToggle = async (enabled) => {
    if (enabled && onReminderEnable) await onReminderEnable();
    setReminder({ enabled });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          {tt('form.dueTime', 'Due Time')}
        </label>
        <input
          type="time"
          value={formData.dueTime || ''}
          onChange={e => setFormData(prev => ({ ...prev, dueTime: e.target.value }))}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">{tt('form.dueTimeHint', 'Optional time for due dates and reminders')}</p>
      </div>

      <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(routine.enabled)}
            onChange={e => setRoutine({ enabled: e.target.checked })}
            className="rounded border-gray-300 text-violet-600 focus:ring-violet-400"
          />
          <Repeat size={16} className="text-violet-600" />
          <span className="text-sm font-semibold text-gray-800">{tt('form.routine', 'Routine task')}</span>
        </label>
        {routine.enabled && (
          <div className="space-y-3 pl-1">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{tt('form.routineFrequency', 'Repeats')}</label>
                <select
                  value={routine.frequency || 'weekly'}
                  onChange={e => setRoutine({ frequency: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white"
                >
                  <option value="daily">{tt('routine.daily', 'Daily')}</option>
                  <option value="weekly">{tt('routine.weekly', 'Weekly')}</option>
                  <option value="monthly">{tt('routine.monthly', 'Monthly')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{tt('form.routineInterval', 'Every')}</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={routine.interval || 1}
                  onChange={e => setRoutine({ interval: Number(e.target.value) || 1 })}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white"
                />
              </div>
            </div>
            {routine.frequency === 'weekly' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">{tt('form.routineWeekdays', 'On days')}</label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_KEYS.map((key, day) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleWeekday(day)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors ${
                        (routine.weekdays || []).includes(day)
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
                      }`}
                    >
                      {tt(`routine.weekday.${key}`, key)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-500 mb-1">{tt('form.routineEndDate', 'End date (optional)')}</label>
              <input
                type="date"
                value={routine.endDate || ''}
                onChange={e => setRoutine({ endDate: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white"
              />
            </div>
            <p className="text-xs text-violet-700">{tt('form.routineHint', 'When marked done, the task resets and schedules the next due date.')}</p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(reminder.enabled)}
            onChange={e => handleReminderToggle(e.target.checked)}
            className="rounded border-gray-300 text-amber-600 focus:ring-amber-400"
          />
          <Bell size={16} className="text-amber-600" />
          <span className="text-sm font-semibold text-gray-800">{tt('form.reminder', 'Reminder')}</span>
        </label>
        {reminder.enabled && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">{tt('form.reminderWhen', 'Notify')}</label>
            <select
              value={reminder.minutesBefore ?? DEFAULT_REMINDER.minutesBefore}
              onChange={e => setReminder({ minutesBefore: Number(e.target.value) })}
              className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white"
            >
              {REMINDER_MINUTES.map(minutes => (
                <option key={minutes} value={minutes}>
                  {tt(`reminder.${minutes}`, minutes === 0 ? 'At due time' : `${minutes} min before`)}
                </option>
              ))}
            </select>
            <p className="text-xs text-amber-700 mt-2">{tt('form.reminderHint', 'Browser notifications while KanDOne is open (or installed as a PWA).')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
