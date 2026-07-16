import { useState } from 'react';
import { Plus, X, Palette } from 'lucide-react';
import { LABEL_COLOR_PALETTE, readableTextColor } from '../utils/labelColors';

/** Read-only colored chips for board/list/detail views. */
export function LabelChipsReadOnly({ labels, labelIds, size = 'xs' }) {
  const items = (labelIds || []).map(id => labels.find(l => l.id === id)).filter(Boolean);
  if (items.length === 0) return null;
  const sizeClass = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';
  return (
    <div className="flex flex-wrap gap-1">
      {items.map(label => (
        <span
          key={label.id}
          className={`inline-block rounded-full font-semibold ${sizeClass}`}
          style={{ backgroundColor: label.color, color: readableTextColor(label.color) }}
        >
          {label.text}
        </span>
      ))}
    </div>
  );
}

function LabelChip({ label, selected, onClick, onColorPick, showColorButton, colorTitle }) {
  const [showPalette, setShowPalette] = useState(false);
  const bg = label.color;
  const fg = readableTextColor(bg);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold border transition-all ${selected ? 'ring-2 ring-offset-1 ring-gray-400' : 'opacity-50 hover:opacity-90'}`}
        style={{ backgroundColor: bg, color: fg, borderColor: bg }}
      >
        {showColorButton && (
          <span
            role="button"
            tabIndex={-1}
            title={colorTitle}
            onClick={(e) => { e.stopPropagation(); setShowPalette(v => !v); }}
            className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/85 hover:bg-white shrink-0"
          >
            <Palette size={10} style={{ color: bg }} />
          </span>
        )}
        {label.text}
      </button>
      {showPalette && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowPalette(false)} />
          <div className="absolute top-full mt-1 start-0 z-50 bg-white rounded-lg shadow-xl border border-gray-100 p-2 grid grid-cols-6 gap-1.5 w-40">
            {LABEL_COLOR_PALETTE.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => { onColorPick(c); setShowPalette(false); }}
                className={`w-5 h-5 rounded-full border-2 ${c === bg ? 'border-gray-700' : 'border-gray-200'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </>
      )}
    </span>
  );
}

/**
 * Interactive label picker: toggle labels on/off, create new ones, recolor,
 * and (in manage mode) delete labels from the shared library.
 */
export default function LabelPicker({
  labels, selectedIds = [], onToggle, onCreate, onColorChange, onDelete, t, compact = false,
}) {
  const [newLabel, setNewLabel] = useState('');
  const [manageMode, setManageMode] = useState(false);

  const handleCreate = () => {
    const text = newLabel.trim();
    if (!text) return;
    onCreate(text);
    setNewLabel('');
  };

  return (
    <div>
      {labels.length === 0 && (
        <p className="text-xs text-gray-400 italic mb-1.5">{t('form.noLabels', 'No labels yet.')}</p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {labels.map(label => (
          <span key={label.id} className="relative inline-flex items-center">
            <LabelChip
              label={label}
              selected={selectedIds.includes(label.id)}
              onClick={() => onToggle(label.id)}
              onColorPick={(color) => onColorChange(label.id, color)}
              showColorButton
              colorTitle={t('form.changeLabelColor', 'Change color')}
            />
            {manageMode && (
              <button
                type="button"
                onClick={() => onDelete(label.id)}
                className="ms-0.5 text-gray-400 hover:text-red-500 transition-colors"
                title={t('form.deleteLabel', 'Delete label')}
              >
                <X size={12} />
              </button>
            )}
          </span>
        ))}
      </div>
      {!compact && (
        <div className="flex items-center gap-1.5 mt-2">
          <input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
            placeholder={t('form.addLabelPlaceholder', 'New label name...')}
            className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <button
            type="button"
            onClick={handleCreate}
            className="px-2 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors shrink-0"
          >
            <Plus size={14} />
          </button>
          {labels.length > 0 && (
            <button
              type="button"
              onClick={() => setManageMode(v => !v)}
              className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${manageMode ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {manageMode ? t('form.doneManaging', 'Done') : t('form.manageLabels', 'Manage')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
