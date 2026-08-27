import { Ban } from 'lucide-react';
import { TASK_TYPES, TYPE_ICONS, getTypeStyle } from '../utils/taskTypes';

/**
 * Icon-button picker for the fixed type taxonomy. A radiogroup (like
 * EffortPicker) rather than a native <select>, since a plain <option> can't
 * carry an icon — and the icon is most of the point here.
 */
export default function TypePicker({ value, onChange, tt, label }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      )}
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="radiogroup"
        aria-label={label || tt('form.type', 'Type')}
      >
        <button
          type="button"
          role="radio"
          aria-checked={!value}
          onClick={() => onChange('')}
          title={tt('type.none', 'No type')}
          aria-label={tt('type.none', 'No type')}
          className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all ${
            !value
              ? 'bg-gray-200 text-gray-700 border-gray-400 ring-2 ring-gray-400'
              : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
          }`}
        >
          <Ban size={14} />
        </button>
        {TASK_TYPES.map((type) => {
          const Icon = TYPE_ICONS[type];
          const selected = value === type;
          const label2 = tt(`type.${type}`, type);
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(type)}
              title={label2}
              aria-label={label2}
              className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border font-semibold transition-all ${getTypeStyle(type)} ${
                selected ? 'ring-2 ring-offset-1 ring-gray-700' : 'hover:brightness-95'
              }`}
            >
              <Icon size={13} />
              {label2}
            </button>
          );
        })}
      </div>
    </div>
  );
}
