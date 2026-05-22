/**
 * Calendar demo — sample event generator + date helpers
 *
 * Generates a deterministic-looking set of calendar entries scattered across
 * the visible date range and builds the per-week row array consumed by the
 * grid.
 */

import type { CalendarDay, CalendarEvent, CalendarWeek, CategoryId } from './types';
import { CATEGORIES, WEEKDAY_FIELDS } from './types';

// #region Date helpers
/** Start-of-day (local time). Returns a *new* Date. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Monday of the week the given date belongs to (Mon = 0 ... Sun = 6). */
export function startOfIsoWeek(date: Date): Date {
  const d = startOfDay(date);
  const dow = (d.getDay() + 6) % 7; // shift so Monday = 0
  d.setDate(d.getDate() - dow);
  return d;
}

/** Add `days` to a date and return a new Date. */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * ISO-8601 week number. Standard "Thursday of the week" algorithm.
 */
export function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

/** Same calendar day? */
export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
// #endregion

// #region Event generation
const TITLES: Record<CategoryId, string[]> = {
  work: ['Team standup', 'Sprint planning', '1:1 with manager', 'Client demo', 'Design review', 'Retro'],
  personal: ['Grocery run', 'Pick up kids', 'Laundry', 'Read', 'Pay bills'],
  travel: ['Flight LHR → JFK', 'Train to Oslo', 'Hotel check-in', 'Airport transfer'],
  health: ['Yoga', 'Run 5km', 'Dentist', 'Annual check-up', 'Therapy'],
  social: ['Coffee with Anna', 'Dinner @ Luigi’s', 'Birthday party', 'Movie night', 'Concert'],
};

/** Tiny seedable PRNG — keeps the demo reproducible across renders. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a stable set of events for the given month, plus a sprinkling in
 * the adjacent weeks so the leading/trailing days are not always empty.
 */
export function generateEvents(
  year: number,
  month: number,
): CalendarEvent[] & { byDate: Map<string, CalendarEvent[]> } {
  // Seed by year/month so navigating back to the same month shows the same
  // entries — this is a demo, not a real backend.
  const rand = mulberry32(year * 100 + month);
  const list: CalendarEvent[] = [];
  const byDate = new Map<string, CalendarEvent[]>();

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  // Extend by a week on each side so leading/trailing days look populated.
  const from = addDays(monthStart, -7);
  const to = addDays(monthEnd, 7);

  for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
    // Density: 0–3 events on most days, occasional 4.
    const count = Math.floor(rand() * 4) - (d < monthStart || d > monthEnd ? 1 : 0);
    if (count <= 0) continue;
    for (let i = 0; i < count; i++) {
      const category = CATEGORIES[Math.floor(rand() * CATEGORIES.length)].id;
      const titles = TITLES[category];
      const title = titles[Math.floor(rand() * titles.length)];
      const hour = 7 + Math.floor(rand() * 12);
      const minute = Math.floor(rand() * 4) * 15;
      const ev: CalendarEvent = {
        id: `${d.toISOString().slice(0, 10)}-${i}`,
        title,
        category,
        startTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      };
      list.push(ev);
      const key = isoKey(d);
      const bucket = byDate.get(key);
      if (bucket) bucket.push(ev);
      else byDate.set(key, [ev]);
    }
  }

  // Sort each day's events by start time so the cell renderer can iterate linearly.
  for (const bucket of byDate.values()) {
    bucket.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  return Object.assign(list, { byDate });
}

function isoKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Re-exported so callers that maintain their own event store (e.g. the
// dblclick "add event" dialog in `grid-factory.ts`) use the same keying
// scheme as `generateEvents`.
export { isoKey };
// #endregion

// #region Week-row construction
/**
 * Build the visible week rows for the given month. The grid always shows
 * full weeks (Mon–Sun); leading days from the previous month and trailing
 * days from the next month are marked `inMonth: false` so the renderer can
 * dim them.
 */
export function buildWeeks(year: number, month: number, byDate: ReadonlyMap<string, CalendarEvent[]>): CalendarWeek[] {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const firstWeekStart = startOfIsoWeek(monthStart);
  const lastWeekStart = startOfIsoWeek(monthEnd);
  const weekCount = Math.round((lastWeekStart.getTime() - firstWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;

  const rows: CalendarWeek[] = [];
  for (let w = 0; w < weekCount; w++) {
    const weekStart = addDays(firstWeekStart, w * 7);
    const days = WEEKDAY_FIELDS.map((_field, dayOffset) => {
      const date = addDays(weekStart, dayOffset);
      return {
        date,
        inMonth: date.getMonth() === month,
        events: byDate.get(isoKey(date)) ?? [],
      } satisfies CalendarDay;
    });
    rows.push({
      weekNumber: isoWeekNumber(weekStart),
      weekStart,
      mon: days[0],
      tue: days[1],
      wed: days[2],
      thu: days[3],
      fri: days[4],
      sat: days[5],
      sun: days[6],
    });
  }
  return rows;
}
// #endregion
