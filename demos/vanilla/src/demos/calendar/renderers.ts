/**
 * Calendar demo — day-cell renderer
 *
 * The same renderer is reused for all seven weekday columns. Layout responds
 * to three densities driven by the host element's `data-density` attribute:
 *
 * | density   | shows                                                       |
 * | --------- | ----------------------------------------------------------- |
 * | `full`    | date number + list of events with title and start time      |
 * | `compact` | date number + colored dots per event (one per category)     |
 * | `minimal` | date number only (degrades to a plain date picker)          |
 *
 * The density attribute lives on the grid host element (`<tbw-grid>`); the
 * renderer reads it via `closest('tbw-grid')` so a single ResizeObserver in
 * the factory can flip the mode for every cell at once.
 */

import type { CalendarDay, CategoryId } from '@demo/shared/calendar';
import { CATEGORIES } from '@demo/shared/calendar';

const CATEGORY_LABEL: Record<CategoryId, string> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label])) as Record<
  CategoryId,
  string
>;

/**
 * Cached "today" timestamp — `renderDayCell` runs once per visible cell per
 * re-render (up to 7×6 = 42 calls). Memoising avoids a `new Date()` +
 * three field reads per cell. Refreshed lazily after one minute so the
 * "today" highlight tracks midnight rollover.
 */
let todayYmd = computeToday();
let todayComputedAt = Date.now();

function computeToday(): { y: number; m: number; d: number } {
  const t = new Date();
  return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() };
}

function isToday(date: Date): boolean {
  if (Date.now() - todayComputedAt > 60_000) {
    todayYmd = computeToday();
    todayComputedAt = Date.now();
  }
  return date.getFullYear() === todayYmd.y && date.getMonth() === todayYmd.m && date.getDate() === todayYmd.d;
}

export function renderDayCell(day: CalendarDay): HTMLElement {
  const root = document.createElement('div');
  root.className = 'cal-cell';
  if (!day.inMonth) root.classList.add('cal-cell--out-of-month');

  if (isToday(day.date)) {
    root.classList.add('cal-cell--today');
  }

  const dateNum = document.createElement('div');
  dateNum.className = 'cal-cell__date';
  dateNum.textContent = String(day.date.getDate());
  root.appendChild(dateNum);

  // Event area — populated for `full` and `compact`; hidden by CSS in `minimal`.
  const events = document.createElement('div');
  events.className = 'cal-cell__events';

  // Full list (visible at full density).
  const list = document.createElement('ul');
  list.className = 'cal-cell__list';
  for (const ev of day.events) {
    const li = document.createElement('li');
    li.className = `cal-event cal-event--${ev.category}`;
    li.title = `${ev.startTime} — ${ev.title} (${CATEGORY_LABEL[ev.category]})`;
    const time = document.createElement('span');
    time.className = 'cal-event__time';
    time.textContent = ev.startTime;
    const title = document.createElement('span');
    title.className = 'cal-event__title';
    title.textContent = ev.title;
    li.append(time, title);
    list.appendChild(li);
  }
  events.appendChild(list);

  // Color-coded dots (visible at compact density). One dot per event,
  // capped at 6 — past that we render a "+N" badge.
  const dots = document.createElement('div');
  dots.className = 'cal-cell__dots';
  const DOT_CAP = 6;
  const dotEvents = day.events.slice(0, DOT_CAP);
  for (const ev of dotEvents) {
    const dot = document.createElement('span');
    dot.className = `cal-dot cal-dot--${ev.category}`;
    dot.title = `${ev.startTime} — ${ev.title}`;
    dots.appendChild(dot);
  }
  if (day.events.length > DOT_CAP) {
    const more = document.createElement('span');
    more.className = 'cal-dot__more';
    more.textContent = `+${day.events.length - DOT_CAP}`;
    dots.appendChild(more);
  }
  events.appendChild(dots);

  root.appendChild(events);
  return root;
}
