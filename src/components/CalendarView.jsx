import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Briefcase, BookOpen, CheckSquare, ListChecks, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const TYPE_STYLES = {
  interview: {
    bg: 'bg-blue-500',
    light: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    border: 'border-blue-300',
    icon: Briefcase,
  },
  assignment: {
    bg: 'bg-orange-500',
    light: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    border: 'border-orange-300',
    icon: BookOpen,
  },
  task: {
    bg: 'bg-green-500',
    light: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    border: 'border-green-300',
    icon: CheckSquare,
  },
  step: {
    bg: 'bg-blue-500',
    light: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    border: 'border-blue-300',
    icon: ListChecks,
  },
};

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DEFAULT_LEGEND_TYPES = ['interview', 'assignment', 'task'];

export default function CalendarView({ events = [], onEventClick, isRTL = false, legendTypes }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'he' ? 'he-IL' : i18n.language === 'fr' ? 'fr-FR' : 'en-US';

  const today = new Date();
  const todayStr = toLocalDateStr(today);

  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(null);

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(currentMonth),
    [currentMonth, locale]
  );

  const dayNames = useMemo(() => {
    const base = new Date(2024, 0, 7); // Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d);
    });
  }, [locale]);

  const eventsByDay = useMemo(() => {
    const map = {};
    events.forEach(ev => {
      if (!ev.date) return;
      const key = ev.date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [events]);

  const cells = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result = [];
    for (let i = 0; i < firstDay; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      result.push(new Date(year, month, d));
    }
    return result;
  }, [currentMonth]);

  const selectedEvents = selectedDay ? (eventsByDay[selectedDay] || []) : [];

  const legendEntries = useMemo(() => {
    const types = legendTypes ?? DEFAULT_LEGEND_TYPES;
    return types.filter((type) => TYPE_STYLES[type]);
  }, [legendTypes]);

  function prevMonth() {
    setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
    setSelectedDay(null);
  }
  function nextMonth() {
    setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));
    setSelectedDay(null);
  }
  function goToday() {
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDay(todayStr);
  }

  return (
    <div
      className="calendar-force-light flex flex-col md:flex-row gap-4 p-4 bg-white text-gray-900 rounded-xl"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Calendar grid */}
      <div className="flex-1 min-w-0">
        {/* Header — explicit light-theme colors for OS dark mode / smart invert */}
        <div className="flex items-center justify-between mb-4 gap-2">
          <button
            onClick={isRTL ? nextMonth : prevMonth}
            className="calendar-nav-btn p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 transition-colors shrink-0 touch-manipulation"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5 text-gray-800" style={{ color: '#1f2937' }} />
          </button>
          <div className="flex flex-col sm:flex-row items-center gap-2 min-w-0 flex-1 justify-center">
            <h2
              className="calendar-month-title text-base sm:text-lg font-semibold capitalize text-center leading-tight"
              style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
            >
              {monthLabel}
            </h2>
            <button
              type="button"
              onClick={goToday}
              className="calendar-today-btn text-xs px-2.5 py-1 rounded-md border border-gray-400 bg-white hover:bg-gray-50 font-medium transition-colors shrink-0"
              style={{ color: '#111827' }}
            >
              {t('calendar.today')}
            </button>
          </div>
          <button
            onClick={isRTL ? prevMonth : nextMonth}
            className="calendar-nav-btn p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 transition-colors shrink-0 touch-manipulation"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5 text-gray-800" style={{ color: '#1f2937' }} />
          </button>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 mb-1">
          {dayNames.map(name => (
            <div key={name} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1">
              {name}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden border border-gray-300">
          {cells.map((date, idx) => {
            if (!date) {
              return <div key={`empty-${idx}`} className="bg-gray-50 min-h-[72px]" />;
            }
            const key = toLocalDateStr(date);
            const dayEvents = eventsByDay[key] || [];
            const isToday = key === todayStr;
            const isSelected = key === selectedDay;
            const visible = dayEvents.slice(0, 3);
            const overflow = dayEvents.length - 3;

            return (
              <div
                key={key}
                onClick={() => setSelectedDay(isSelected ? null : key)}
                className={`bg-white min-h-[72px] p-1 cursor-pointer transition-colors
                  ${isSelected ? 'ring-2 ring-inset ring-blue-500' : 'hover:bg-blue-50'}
                `}
              >
                <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1
                  ${isToday ? 'bg-blue-600 text-white' : 'text-gray-800'}
                `}>
                  {date.getDate()}
                </div>
                <div className="space-y-px">
                  {visible.map((ev, i) => {
                    const style = TYPE_STYLES[ev.type] || TYPE_STYLES.task;
                    return (
                      <div
                        key={i}
                        onClick={(e) => { e.stopPropagation(); onEventClick && onEventClick(ev); }}
                        className={`text-xs px-1 rounded truncate cursor-pointer hover:opacity-75 ${style.light}`}
                        title={ev.title}
                      >
                        {ev.title}
                      </div>
                    );
                  })}
                  {overflow > 0 && (
                    <div className="text-xs text-gray-600 px-1">+{overflow} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          {legendEntries.map((type) => {
            const style = TYPE_STYLES[type];
            return (
              <div key={type} className="flex items-center gap-1 text-xs text-gray-700">
                <span className={`w-2 h-2 rounded-full ${style.bg}`} />
                <span className="capitalize">{t(`calendar.type.${type}`)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day detail panel */}
      <div className={`md:w-72 transition-all ${selectedDay ? 'block' : 'hidden md:block'}`}>
        <div className="bg-white rounded-lg border border-gray-300 text-gray-900 h-full [color-scheme:light]">
          {selectedDay ? (
            <>
              <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="font-medium text-sm text-gray-900 dark:text-white">
                    {new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(selectedDay + 'T00:00:00'))}
                  </span>
                </div>
                <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 space-y-2 overflow-y-auto max-h-[500px]">
                {selectedEvents.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('calendar.noEvents')}</p>
                ) : (
                  selectedEvents.map((ev, i) => {
                    const style = TYPE_STYLES[ev.type] || TYPE_STYLES.task;
                    const Icon = style.icon;
                    return (
                      <div
                        key={i}
                        onClick={() => onEventClick && onEventClick(ev)}
                        className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${style.light} ${style.border}`}
                      >
                        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{ev.title}</p>
                          <p className="text-xs opacity-70 capitalize">{t(`calendar.type.${ev.type}`)}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 dark:text-gray-500 p-4 text-center">
              <Calendar className="w-8 h-8 mb-2" />
              <p className="text-sm">{t('calendar.selectDay')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
