import { Check, Ban } from 'lucide-react';
import { CARD_COLOR_PALETTE } from '../utils/labelColors';

/**
 * A compact row of swatches for choosing a card's background tint.
 * The first swatch (empty value) clears the color back to the default white card.
 */
export default function CardColorPicker({ value = '', onChange, noneLabel = 'None' }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {CARD_COLOR_PALETTE.map((color) => {
        const isNone = color === '';
        const selected = (value || '') === color;
        return (
          <button
            key={color || 'none'}
            type="button"
            onClick={() => onChange(color)}
            title={isNone ? noneLabel : color}
            aria-label={isNone ? noneLabel : color}
            className={`relative w-7 h-7 rounded-full border transition-all flex items-center justify-center ${
              selected ? 'ring-2 ring-offset-1 ring-gray-500 border-gray-400' : 'border-gray-200 hover:border-gray-400'
            }`}
            style={{ backgroundColor: color || '#ffffff' }}
          >
            {isNone && !selected && <Ban size={13} className="text-gray-400" />}
            {selected && <Check size={14} className="text-gray-700" />}
          </button>
        );
      })}
    </div>
  );
}
