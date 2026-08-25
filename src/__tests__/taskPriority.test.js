import { describe, it, expect, afterEach } from 'vitest';
import {
  scoreTask,
  deriveUrgencyFromDate,
  getEffectiveUrgency,
  getScoringEffort,
  groupTasksByPriority,
  sortByScore,
  sortByDueDate,
  urgencyToDueDate,
} from '../utils/taskPriority';
import { sanitizeTaskRecords } from '../sanitize';

/** Fixed "now" so the tests don't drift with the wall clock. */
const NOW = new Date(2026, 7, 24, 10, 0, 0); // Mon 24 Aug 2026, 10:00 local

describe('deriveUrgencyFromDate', () => {
  it('returns nothing for a task with no due date', () => {
    expect(deriveUrgencyFromDate({}, NOW)).toBe('');
  });

  it('buckets by how far away the due date is', () => {
    expect(deriveUrgencyFromDate({ dueDate: '2026-08-24', dueTime: '23:00' }, NOW)).toBe('now');
    expect(deriveUrgencyFromDate({ dueDate: '2026-08-25' }, NOW)).toBe('today');
    expect(deriveUrgencyFromDate({ dueDate: '2026-08-30' }, NOW)).toBe('week');
    expect(deriveUrgencyFromDate({ dueDate: '2026-09-20' }, NOW)).toBe('month');
    expect(deriveUrgencyFromDate({ dueDate: '2027-05-01' }, NOW)).toBe('someday');
  });

  it('flags a past due date as overdue', () => {
    expect(deriveUrgencyFromDate({ dueDate: '2026-08-01', status: 'active' }, NOW)).toBe('overdue');
  });

  it('does not call a completed task overdue', () => {
    expect(deriveUrgencyFromDate({ dueDate: '2026-08-01', status: 'completed' }, NOW)).not.toBe('overdue');
  });
});

describe('deriveUrgencyFromDate across timezones', () => {
  const originalTZ = process.env.TZ;
  afterEach(() => {
    // Mirrors taskHelpers.test.js: assigning undefined stringifies to the
    // literal "undefined", which ICU silently resolves to UTC and corrupts
    // every later test in the process.
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  });

  it('uses the local calendar day in a negative-offset zone', () => {
    process.env.TZ = 'America/New_York';
    const now = new Date(2026, 7, 24, 10, 0, 0);
    expect(deriveUrgencyFromDate({ dueDate: '2026-08-25' }, now)).toBe('today');
  });

  it('uses the local calendar day in a positive-offset zone', () => {
    process.env.TZ = 'Pacific/Auckland';
    const now = new Date(2026, 7, 24, 10, 0, 0);
    expect(deriveUrgencyFromDate({ dueDate: '2026-08-25' }, now)).toBe('today');
  });
});

describe('getEffectiveUrgency', () => {
  it('uses the manual value when there is no date', () => {
    expect(getEffectiveUrgency({ urgency: 'week' }, NOW)).toBe('week');
  });

  it('uses the date when there is no manual value', () => {
    expect(getEffectiveUrgency({ dueDate: '2026-08-30' }, NOW)).toBe('week');
  });

  it('takes whichever of the two is more urgent', () => {
    // Hand-picked "now" beats a far-off date.
    expect(getEffectiveUrgency({ dueDate: '2026-12-01', urgency: 'now' }, NOW)).toBe('now');
    // ...and a near date beats a relaxed hand-picked value.
    expect(getEffectiveUrgency({ dueDate: '2026-08-24', dueTime: '23:00', urgency: 'someday' }, NOW)).toBe('now');
  });

  it('lets overdue win over any manual value', () => {
    expect(getEffectiveUrgency({ dueDate: '2026-01-01', status: 'active', urgency: 'month' }, NOW)).toBe('overdue');
  });

  it('ignores an unrecognised manual value', () => {
    expect(getEffectiveUrgency({ urgency: 'whenever' }, NOW)).toBe('');
  });
});

describe('getScoringEffort', () => {
  it('prefers the explicit effort', () => {
    const task = { effort: { value: 30, unit: 'minute' }, duration: { value: 5, unit: 'day' } };
    expect(getScoringEffort(task)).toEqual({ value: 30, unit: 'minute' });
  });

  it('falls back to the legacy duration so old tasks still rank', () => {
    const task = { effort: { value: '', unit: 'hour' }, duration: { value: 5, unit: 'day' } };
    expect(getScoringEffort(task)).toEqual({ value: 5, unit: 'day' });
  });
});

describe('scoreTask', () => {
  it('scores a big-impact small-effort task as BISE', () => {
    const p = scoreTask({ impact: 'high', effort: { value: 30, unit: 'minute' }, urgency: 'today' }, { now: NOW });
    expect(p.isBise).toBe(true);
    expect(p.quadrant).toBe('bise');
    expect(p.band).toBe('critical');
  });

  it('does not call a big-impact big-effort task a quick win', () => {
    const p = scoreTask({ impact: 'high', effort: { value: 2, unit: 'month' } }, { now: NOW });
    expect(p.isBise).toBe(false);
    expect(p.quadrant).toBe('bigProject');
  });

  it('ranks BISE above the same task with large effort', () => {
    const base = { impact: 'high', urgency: 'week' };
    const quick = scoreTask({ ...base, effort: { value: 1, unit: 'hour' } }, { now: NOW });
    const slow = scoreTask({ ...base, effort: { value: 3, unit: 'month' } }, { now: NOW });
    expect(quick.score).toBeGreaterThan(slow.score);
  });

  it('ranks a more urgent task above a less urgent identical one', () => {
    const base = { impact: 'medium', effort: { value: 1, unit: 'hour' } };
    const soon = scoreTask({ ...base, urgency: 'now' }, { now: NOW });
    const later = scoreTask({ ...base, urgency: 'month' }, { now: NOW });
    expect(soon.score).toBeGreaterThan(later.score);
  });

  it('produces a score in 0–100 for every combination', () => {
    for (const impact of ['high', 'medium', 'low']) {
      for (const urgency of ['now', 'today', 'week', 'month', 'someday', '']) {
        for (const effort of [{ value: 1, unit: 'minute' }, { value: 5, unit: 'day' }, { value: 5, unit: 'year' }]) {
          const { score } = scoreTask({ impact, urgency, effort }, { now: NOW });
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it('defaults a task with nothing filled in rather than throwing', () => {
    const p = scoreTask({}, { now: NOW });
    expect(p.impact).toBe('medium');
    expect(p.effortTier).toBe('medium');
    expect(Number.isFinite(p.score)).toBe(true);
  });

  it('honours custom effort tiers', () => {
    const task = { impact: 'high', effort: { value: 1, unit: 'day' } };
    expect(scoreTask(task, { now: NOW }).isBise).toBe(false);
    expect(scoreTask(task, { now: NOW, tiers: { smallMaxIndex: 8, mediumMaxIndex: 12 } }).isBise).toBe(true);
  });
});

describe('groupTasksByPriority', () => {
  it('puts a due-today task in Do Now even when its quadrant says otherwise', () => {
    const tasks = [{ id: 'a', impact: 'low', effort: { value: 5, unit: 'year' }, dueDate: '2026-08-24' }];
    const groups = groupTasksByPriority(tasks, { now: NOW });
    expect(groups.doNow.map(e => e.task.id)).toEqual(['a']);
    expect(groups.later).toHaveLength(0);
  });

  it('separates the four quadrants', () => {
    const tasks = [
      { id: 'bise', impact: 'high', effort: { value: 30, unit: 'minute' } },
      { id: 'big', impact: 'high', effort: { value: 6, unit: 'month' } },
      { id: 'fill', impact: 'low', effort: { value: 10, unit: 'minute' } },
      { id: 'later', impact: 'low', effort: { value: 2, unit: 'year' } },
    ];
    const groups = groupTasksByPriority(tasks, { now: NOW });
    expect(groups.bise.map(e => e.task.id)).toEqual(['bise']);
    expect(groups.bigProject.map(e => e.task.id)).toEqual(['big']);
    expect(groups.fillIn.map(e => e.task.id)).toEqual(['fill']);
    expect(groups.later.map(e => e.task.id)).toEqual(['later']);
  });

  it('sorts each group by score descending', () => {
    const tasks = [
      { id: 'lo', impact: 'high', effort: { value: 1, unit: 'hour' }, urgency: 'month' },
      { id: 'hi', impact: 'high', effort: { value: 1, unit: 'hour' }, urgency: 'week' },
    ];
    expect(groupTasksByPriority(tasks, { now: NOW }).bise.map(e => e.task.id)).toEqual(['hi', 'lo']);
  });

  it('tolerates a non-array input', () => {
    expect(groupTasksByPriority(null, { now: NOW }).doNow).toEqual([]);
  });
});

describe('sortByScore', () => {
  it('breaks a score tie in favour of the quick win', () => {
    // Same score, different quadrant: the cheap one should come first.
    // (BISE at 'someday' and a big-project at 'month' both land on 62.)
    const bise = { id: 'b', impact: 'high', effort: { value: 1, unit: 'hour' }, urgency: 'someday' };
    const other = { id: 'a', impact: 'high', effort: { value: 5, unit: 'hour' }, urgency: 'month' };
    const scores = [bise, other].map(t => scoreTask(t, { now: NOW }).score);
    expect(scores[0]).toBe(scores[1]); // guard: the fixture really is a tie
    expect(sortByScore([other, bise], { now: NOW }).map(t => t.id)).toEqual(['b', 'a']);
  });

  it('does not mutate the input array', () => {
    const tasks = [{ id: 'a' }, { id: 'b' }];
    sortByScore(tasks, { now: NOW });
    expect(tasks.map(t => t.id)).toEqual(['a', 'b']);
  });
});

describe('sortByDueDate', () => {
  it('sorts ascending and sinks undated tasks', () => {
    const tasks = [{ id: 'none' }, { id: 'late', dueDate: '2026-09-01' }, { id: 'soon', dueDate: '2026-08-25' }];
    expect(sortByDueDate(tasks).map(t => t.id)).toEqual(['soon', 'late', 'none']);
  });
});

describe('urgencyToDueDate', () => {
  it('maps the quick-picks onto real dates', () => {
    expect(urgencyToDueDate('today', NOW).dueDate).toBe('2026-08-24');
    expect(urgencyToDueDate('week', NOW).dueDate).toBe('2026-08-31');
    expect(urgencyToDueDate('month', NOW).dueDate).toBe('2026-09-23');
  });

  it('gives "now" a time so the reminder has something to fire on', () => {
    expect(urgencyToDueDate('now', NOW)).toEqual({ dueDate: '2026-08-24', dueTime: '10:15' });
  });

  it('leaves the date alone for someday', () => {
    expect(urgencyToDueDate('someday', NOW)).toBeNull();
    expect(urgencyToDueDate('', NOW)).toBeNull();
  });
});

describe('persistence round-trip', () => {
  it('keeps effort, impact and urgency through the sanitizer', () => {
    // sanitize.js whitelists fields — anything missing there is silently lost
    // on every save/load, so this is the regression guard for the new fields.
    const [task] = sanitizeTaskRecords([{
      id: 'x', name: 'Ship it', impact: 'high', urgency: 'week',
      effort: { value: 30, unit: 'minute' },
      steps: [{ title: 'step', effort: { value: 10, unit: 'minute' } }],
    }]);
    expect(task.impact).toBe('high');
    expect(task.urgency).toBe('week');
    expect(task.effort).toEqual({ value: 30, unit: 'minute' });
    expect(task.steps[0].effort).toEqual({ value: 10, unit: 'minute' });
  });

  it('snaps an off-ladder stored effort onto the ladder', () => {
    const [task] = sanitizeTaskRecords([{ id: 'x', name: 'n', effort: { value: 3, unit: 'hour' } }]);
    expect(task.effort).toEqual({ value: 2, unit: 'hour' });
  });

  it('gives a pre-existing task safe defaults instead of dropping it', () => {
    const [task] = sanitizeTaskRecords([{ id: 'old', name: 'Legacy task' }]);
    expect(task.impact).toBe('medium');
    expect(task.urgency).toBe('');
    expect(task.effort).toEqual({ value: '', unit: 'hour' });
    expect(() => scoreTask(task, { now: NOW })).not.toThrow();
  });

  it('rejects hostile values from an imported file', () => {
    const [task] = sanitizeTaskRecords([{
      id: 'z', name: 'n', impact: '<script>', urgency: 'whenever', effort: 'nope',
    }]);
    expect(task.impact).toBe('medium');
    expect(task.urgency).toBe('');
    expect(task.effort).toEqual({ value: '', unit: 'hour' });
  });
});
