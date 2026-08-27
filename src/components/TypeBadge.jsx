import { TYPE_ICONS, getTypeStyle } from '../utils/taskTypes';

/** Read-only type chip for cards, list rows and the detail header. Renders
 * nothing for an untyped task — type is optional, unlike status/priority. */
export default function TypeBadge({ type, tt, className = '' }) {
  const Icon = TYPE_ICONS[type];
  if (!Icon) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-semibold ${getTypeStyle(type)} ${className}`}
    >
      <Icon size={10} />
      {tt(`type.${type}`, type)}
    </span>
  );
}
