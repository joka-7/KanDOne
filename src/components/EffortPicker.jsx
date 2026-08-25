import { useMemo } from 'react';
import { Ban } from 'lucide-react';
import {
  EFFORT_UNITS,
  getTicksForUnit,
  getEffortTickClass,
  findTickIndex,
  snapToTick,
  resolveEffortTier,
  DEFAULT_EFFORT_TIERS,
} from '../utils/effortScale';

/**
 * Quantized effort picker: a unit row, then the ticks for that unit as chips
 * coloured bright (quick) → dim (long).
 *
 * Rendered as a radiogroup rather than a row of buttons so the whole ladder is
 * one tab stop and arrow keys move between ticks — the colour ramp carries a
 * lot of the meaning here, so the accessible name has to carry it too.
 */
export default function EffortPicker({
  value,
  onChange,
  tiers = DEFAULT_EFFORT_TIERS,
  tt,
  label,
  noneLabel = 'None',
  size = 'md',
  allowNone = true,
}) {
  const selectedIndex = findTickIndex(value);
  const snapped = selectedIndex === -1 ? snapToTick(value) : null;

  // An off-ladder legacy duration still has to show *somewhere* sensible, so
  // fall back to whichever tick it snaps to.
  const activeIndex = selectedIndex !== -1 ? selectedIndex : (snapped?.index ?? -1);
  const activeUnit = activeIndex === -1 ? 'hour' : (snapped?.unit || value?.unit || 'hour');

  const ticks = useMemo(() => getTicksForUnit(activeUnit), [activeUnit]);
  const chipSize = size === 'sm' ? 'text-[10px] px-1.5 py-0.5 min-w-[28px]' : 'text-xs px-2 py-1 min-w-[34px]';

  const selectUnit = (unit) => {
    // Keep the same rung within the new unit where possible, so switching
    // hour → day lands on a comparable position rather than resetting.
    const unitTicks = getTicksForUnit(unit);
    const withinUnit = activeIndex === -1
      ? 0
      : Math.min(unitTicks.length - 1, ticks.findIndex((t) => t.index === activeIndex));
    const target = unitTicks[Math.max(0, withinUnit)];
    onChange({ value: target.value, unit: target.unit });
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      )}
      <div className="flex flex-wrap gap-1" role="tablist" aria-label={tt('effort.unitGroup', 'Effort unit')}>
        {EFFORT_UNITS.map((unit) => (
          <button
            key={unit}
            type="button"
            role="tab"
            aria-selected={unit === activeUnit}
            onClick={() => selectUnit(unit)}
            className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold transition-colors ${
              unit === activeUnit
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            }`}
          >
            {tt(`duration.${unit}`, unit)}
          </button>
        ))}
      </div>
      <div
        className="flex flex-wrap items-center gap-1"
        role="radiogroup"
        aria-label={label || tt('form.effort', 'Effort')}
      >
        {allowNone && (
        <button
          type="button"
          role="radio"
          aria-checked={activeIndex === -1}
          onClick={() => onChange({ value: '', unit: activeUnit })}
          title={noneLabel}
          aria-label={noneLabel}
          className={`flex items-center justify-center rounded-md border transition-all ${chipSize} ${
            activeIndex === -1
              ? 'bg-gray-200 text-gray-700 border-gray-400 ring-2 ring-gray-400'
              : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
          }`}
        >
          <Ban size={11} />
        </button>
        )}
        {ticks.map((tick) => {
          const selected = tick.index === activeIndex;
          const tier = resolveEffortTier(tick, tiers);
          return (
            <button
              key={tick.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange({ value: tick.value, unit: tick.unit })}
              // Colour alone must never be the signal — name the tier too.
              aria-label={`${tick.value} ${tt(`duration.${tick.unit}`, tick.unit)} — ${tt(`effort.tier.${tier}`, tier)}`}
              className={`rounded-md border font-semibold transition-all ${chipSize} ${getEffortTickClass(tick.index)} ${
                selected ? 'ring-2 ring-offset-1 ring-gray-700' : 'opacity-70 hover:opacity-100'
              }`}
            >
              {tick.value}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Read-only effort chip for cards and list rows. */
export function EffortChip({ effort, tt, tiers = DEFAULT_EFFORT_TIERS, className = '' }) {
  const tick = snapToTick(effort);
  if (!tick) return null;
  const tier = resolveEffortTier(tick, tiers);
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border font-semibold ${getEffortTickClass(tick.index)} ${className}`}
      title={`${tt('form.effort', 'Effort')}: ${tick.value} ${tt(`duration.${tick.unit}`, tick.unit)} (${tt(`effort.tier.${tier}`, tier)})`}
    >
      {tick.value}{tt(`duration.short.${tick.unit}`, tick.unit.charAt(0))}
    </span>
  );
}
