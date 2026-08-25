import { Zap } from 'lucide-react';
import { getBandStyle } from '../utils/taskPriority';

/**
 * Score pill plus the BISE marker, shared by the board, the list rows, the
 * task detail header and the Priority view.
 *
 * Kept in its own module rather than alongside PriorityView so that the board
 * and list can show a score without pulling the lazy-loaded Priority tab into
 * the initial bundle.
 */
export default function PriorityBadge({ priority, tt, showBise = true }) {
  const style = getBandStyle(priority.band);
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`inline-block text-[10px] px-1.5 py-0.5 rounded border font-bold tabular-nums ${style.pill}`}
        title={tt('priorityView.scoreTitle', 'Priority score')}
      >
        {priority.score}
      </span>
      {showBise && priority.isBise && (
        <span
          className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border font-bold bg-amber-100 text-amber-700 border-amber-200"
          title={tt('priorityView.biseTitle', 'Big impact, small effort — do these first')}
        >
          <Zap size={9} />
          {tt('priorityView.bise', 'BISE')}
        </span>
      )}
    </span>
  );
}
