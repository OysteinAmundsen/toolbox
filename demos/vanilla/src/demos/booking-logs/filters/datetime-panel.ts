/**
 * Custom date+**time** filter panel for the `timestamp` column.
 *
 * The grid's built-in `'date'` panel is `<input type="date">`-based and
 * therefore day-granular only. Logs land at 80 ms intervals, so users
 * routinely want to drill into a specific window like
 * "12:34:00 → 12:34:30 on April 30". This panel renders two
 * `<input type="datetime-local">` inputs and emits a millisecond-precision
 * range via `applyTextFilter('between', fromMs, toMs)`. Either bound may
 * be left blank to get an open-ended range:
 *
 * - From only → `applyTextFilter('greaterThanOrEqual', fromMs)`
 * - To   only → `applyTextFilter('lessThanOrEqual', toMs)`
 * - Both     → `applyTextFilter('between', fromMs, toMs)`
 *
 * The numeric ms-epoch value lines up with what `Date.parse(row.timestamp)`
 * produces during the client-side post-filter pass and what the mock API's
 * `tsFrom`/`tsTo` query parameters expect — no normalisation needed at
 * either end. The previous day-bucketing workaround on the column
 * (`filterValue: bucket-to-day`) is intentionally gone for this reason.
 */

import type { CustomPanelParams } from './panel-types';

export function renderDateTimePanel(container: HTMLElement, params: CustomPanelParams): void {
  const wrap = document.createElement('div');
  wrap.className = 'bl-datetime-filter';

  // datetime-local inputs accept `YYYY-MM-DDTHH:mm[:ss]` in *local* time and
  // expose `.valueAsNumber` already-converted to ms-since-epoch (UTC). That
  // means we can hand the result straight to `applyTextFilter` without any
  // timezone gymnastics — the grid stores the numeric value, the predicate
  // compares it against `Date.parse(row.timestamp)` (also a UTC ms epoch),
  // and "I want events from 12:34 local" Just Works.
  const msToInputValue = (ms: number | undefined): string => {
    if (typeof ms !== 'number' || !Number.isFinite(ms)) return '';
    const d = new Date(ms);
    // toISOString() is UTC; we need local. Build the string by hand.
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    );
  };

  const cur = params.currentFilter;
  const initialFrom =
    cur && (cur.operator === 'between' || cur.operator === 'greaterThanOrEqual')
      ? msToInputValue(typeof cur.value === 'number' ? cur.value : undefined)
      : '';
  const initialTo =
    cur && cur.operator === 'between'
      ? msToInputValue(typeof cur.valueTo === 'number' ? cur.valueTo : undefined)
      : cur && cur.operator === 'lessThanOrEqual'
        ? msToInputValue(typeof cur.value === 'number' ? cur.value : undefined)
        : '';

  const makeRow = (label: string, value: string): { row: HTMLLabelElement; input: HTMLInputElement } => {
    const row = document.createElement('label');
    row.className = 'bl-datetime-row';
    const lbl = document.createElement('span');
    lbl.className = 'bl-datetime-label';
    lbl.textContent = label;
    const input = document.createElement('input');
    input.type = 'datetime-local';
    // Reuse the built-in input class for consistent bg/border/focus ring.
    input.className = 'tbw-filter-search-input';
    // Step 1 second: the dataset's row interval is 80 ms but the native
    // picker UI only exposes seconds without a custom widget; second-level
    // granularity is plenty for a 10M-row dataset spanning years.
    input.step = '1';
    input.value = value;
    row.append(lbl, input);
    return { row, input };
  };

  const from = makeRow('From', initialFrom);
  const to = makeRow('To', initialTo);

  const buttons = document.createElement('div');
  buttons.className = 'tbw-filter-buttons';

  const apply = document.createElement('button');
  apply.type = 'button';
  apply.className = 'tbw-filter-apply-btn';
  apply.textContent = 'Apply';
  apply.addEventListener('click', () => {
    // valueAsNumber returns NaN when the input is empty.
    const f = from.input.valueAsNumber;
    const t = to.input.valueAsNumber;
    const hasF = Number.isFinite(f);
    const hasT = Number.isFinite(t);
    if (hasF && hasT) {
      // Allow either order; normalise to [lo, hi].
      const lo = Math.min(f, t);
      const hi = Math.max(f, t);
      params.applyTextFilter('between', lo, hi);
    } else if (hasF) {
      params.applyTextFilter('greaterThanOrEqual', f);
    } else if (hasT) {
      params.applyTextFilter('lessThanOrEqual', t);
    } else {
      params.clearFilter();
    }
  });

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'tbw-filter-clear-btn';
  clear.textContent = 'Clear';
  clear.addEventListener('click', () => {
    from.input.value = '';
    to.input.value = '';
    params.clearFilter();
  });

  buttons.append(apply, clear);

  // Enter on either input applies; Escape closes the panel.
  const keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Enter') apply.click();
    else if (e.key === 'Escape') params.closePanel();
  };
  from.input.addEventListener('keydown', keyHandler);
  to.input.addEventListener('keydown', keyHandler);

  wrap.append(from.row, to.row, buttons);
  container.appendChild(wrap);
  queueMicrotask(() => from.input.focus());
}
