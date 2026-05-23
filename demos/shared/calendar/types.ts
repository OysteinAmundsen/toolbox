/**
 * Calendar demo — types
 *
 * A calendar demo built on top of `<tbw-grid>`. One row per visible week,
 * one column per weekday plus a narrow leading column for the ISO week
 * number.
 */

/** A single calendar entry (the user-visible "event" in a day cell). */
export interface CalendarEvent {
  id: string;
  title: string;
  /** Visual category — drives the color swatch. */
  category: CategoryId;
  /** Start time on the event's date (24h HH:mm, local). Display-only. */
  startTime: string;
}

/**
 * Canonical category list. Single source of truth used by:
 * - the event generator (random pick)
 * - the legend rendered in the pinned-bottom panel
 * - the "new entry" dialog category dropdown
 * - tooltips on rendered event chips / dots
 *
 * Adding a category here automatically requires a matching `--cal-cat-<id>`
 * CSS variable in `styles.css` and an `.cal-event--<id>` / `.cal-dot--<id>`
 * color rule.
 */
export const CATEGORIES = [
  { id: 'work', label: 'Work' },
  { id: 'personal', label: 'Personal' },
  { id: 'travel', label: 'Travel' },
  { id: 'health', label: 'Health' },
  { id: 'social', label: 'Social' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

/** Per-cell payload — the `valueAccessor` returns this for each day column. */
export interface CalendarDay {
  date: Date;
  /** True when this date belongs to the currently-displayed month. */
  inMonth: boolean;
  events: CalendarEvent[];
}

/** One row of the calendar grid (a week). */
export interface CalendarWeek {
  /** ISO-8601 week number (1-53). */
  weekNumber: number;
  /** Monday of the week (used as a stable row identity). */
  weekStart: Date;
  /** Day cells, Monday → Sunday. */
  mon: CalendarDay;
  tue: CalendarDay;
  wed: CalendarDay;
  thu: CalendarDay;
  fri: CalendarDay;
  sat: CalendarDay;
  sun: CalendarDay;
}

export type WeekdayField = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const WEEKDAY_FIELDS: readonly WeekdayField[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const WEEKDAY_HEADERS: Record<WeekdayField, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

/** Full weekday names (used at the `full` density tier, ≥534 px). */
export const WEEKDAY_HEADERS_FULL: Record<WeekdayField, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

/** Single-letter weekday names (used at the `minimal` density tier, <480 px). */
export const WEEKDAY_HEADERS_MINI: Record<WeekdayField, string> = {
  mon: 'M',
  tue: 'T',
  wed: 'W',
  thu: 'T',
  fri: 'F',
  sat: 'S',
  sun: 'S',
};
