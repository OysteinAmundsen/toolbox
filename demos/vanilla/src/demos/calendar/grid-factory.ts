/**
 * Calendar grid factory (vanilla)
 *
 * Wires `<tbw-grid>` to behave like a month-view calendar:
 *
 * - One row per visible ISO week (Mon–Sun), 4–6 rows depending on the month.
 * - Eight columns: a narrow fixed `week#` column + seven stretching weekday
 *   columns, all rendered with the same `renderDayCell` renderer that reads
 *   `CalendarDay` data via `valueAccessor`.
 * - The grid's built-in title is **disabled** (the title is text-only and we
 *   need a year dropdown), so the month name and year selector are mounted
 *   via `registerHeaderContent`. The prev/today/next nav buttons live in the
 *   shell's toolbar area on the right via `registerToolbarContent`, and the
 *   category color legend is rendered as a pinned-bottom row via the
 *   `pinnedRows` feature.
 * - A `ResizeObserver` on the wrapper toggles `data-density` on the grid
 *   host between `full`, `compact`, and `minimal`. The cell renderer always
 *   emits the same markup; CSS hides the parts that don't apply.
 */

import '@toolbox-web/grid';
// Pinned rows feature: registers the factory so `features.pinnedRows` works.
import '@toolbox-web/grid/features/pinned-rows';

import type { ColumnConfig, DataGridElement, GridConfig } from '@toolbox-web/grid';
import { createGrid } from '@toolbox-web/grid';

import { buildWeeks, generateEvents, isoKey } from './data';
import { renderDayCell } from './renderers';
import type { CalendarDay, CalendarEvent, CalendarWeek, WeekdayField } from './types';
import { CATEGORIES, WEEKDAY_FIELDS, WEEKDAY_HEADERS, WEEKDAY_HEADERS_FULL, WEEKDAY_HEADERS_MINI } from './types';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// Density breakpoints (px). Picked so each weekday column gets a sensible
// minimum amount of room:
//   ≥ 880 → full event list
//   480-880 → colored dots only
//   < 480 → date picker (numbers only)
const DENSITY_FULL_PX = 880;
const DENSITY_COMPACT_PX = 480;

// Default until the first ResizeObserver tick reports a real height.
const DEFAULT_ROW_HEIGHT_PX = 110;

// Year range offered by the year dropdown — current year ±5.
const YEAR_RANGE = 5;

export interface CalendarGridHandle {
  /** The grid element to append to the DOM. */
  grid: DataGridElement<CalendarWeek>;
  /** Tear down listeners and observers. Caller still has to `.remove()` the element. */
  destroy: () => void;
}

interface CalendarState {
  year: number;
  month: number; // 0-based, like Date#getMonth
}

export function createCalendarGrid(): CalendarGridHandle {
  const today = new Date();
  const state: CalendarState = { year: today.getFullYear(), month: today.getMonth() };

  // Events the user adds via the "new entry" dialog. Persisted across
  // month navigations (the auto-generated demo events are re-derived from
  // a deterministic seed and would otherwise drown out user input).
  // Keyed by ISO date string (`YYYY-MM-DD`).
  const userEvents = new Map<string, CalendarEvent[]>();

  const grid = createGrid<CalendarWeek>();
  grid.className = 'calendar-demo__grid';
  // Start in `full` density; the ResizeObserver will adjust shortly.
  grid.setAttribute('data-density', 'full');

  // Kept in a closure because the `gridConfig` setter REPLACES rather than
  // merges (see ConfigManager.setGridConfig). When the ResizeObserver wants
  // to update `rowHeight` we re-assign `{ ...currentConfig, rowHeight }` so
  // columns / plugins / fitMode survive the update — otherwise the grid
  // falls back to inferred columns and loses the day renderer.
  const currentConfig: GridConfig<CalendarWeek> = buildConfig();
  grid.gridConfig = currentConfig;
  grid.rows = makeRows(state, userEvents);

  // === Custom header content (month name + year dropdown + nav buttons) ===
  //
  // The grid's built-in `shell.header.title` is text-only, and the spec
  // requires interactive controls in the header. Per the spec, we leave the
  // title unset and inject a custom header section instead. Registering the
  // section unconditionally renders the shell header bar (it renders as soon
  // as it has any content), so we don't need `shell.header.title` at all.
  let updateHeader: () => void = () => undefined;

  /**
   * Re-render the grid after `state` changed. Optionally restores cell focus.
   *
   * - `focusTarget.day`: focus the cell containing that day-of-month in the
   *   new view (used by arrow navigation crossing a month boundary).
   * - `focusTarget.position`: focus an explicit `(rowIndex, colIndex)` slot
   *   in the new view (used by PageUp/PageDown to preserve "same weekday in
   *   same week of month"). The row is clamped to the last available week.
   */
  function rerender(focusTarget?: { day: number } | { position: { rowIndex: number; colIndex: number } }): void {
    const nextRows = makeRows(state, userEvents);
    grid.rows = nextRows;
    updateHeader();
    // Week count can change (4 ↔ 5 ↔ 6) when navigating months —
    // recompute row height so the new row set still fills the viewport.
    applyRowHeight();
    if (!focusTarget) return;

    let pos: { rowIndex: number; colIndex: number } | null = null;
    if ('day' in focusTarget) {
      // Resolve the position from the freshly-built row data, NOT from
      // `grid.rows`. The grid setter triggers async processing (sort /
      // filter / virtualization) and the getter may briefly still return
      // the previous month's rows, so looking up the position there would
      // either fail or land on a stale cell.
      pos = findDayPosition(nextRows, state.year, state.month, focusTarget.day);
    } else {
      // Clamp the requested row to the last available week of the new
      // month so e.g. row 5 in a 6-week month maps to row 4 in a 5-week
      // month rather than disappearing.
      const lastRow = Math.max(nextRows.length - 1, 0);
      pos = {
        rowIndex: Math.min(focusTarget.position.rowIndex, lastRow),
        colIndex: focusTarget.position.colIndex,
      };
    }

    if (pos) {
      // Capture into a const so the microtask closure doesn't need the
      // non-null assertion that TS would otherwise require on `pos`.
      const target = pos;
      // Schedule the focus call so it runs after the grid has finished
      // patching its DOM in response to the rows assignment.
      queueMicrotask(() => grid.focusCell?.(target.rowIndex, target.colIndex));
    }
  }

  grid.ready?.().then(() => {
    updateHeader = mountNav(grid, state, (focusTarget) => rerender(focusTarget)).update;
    grid.refreshShellHeader?.();
    // Attach the viewport height observer now that the rows container exists.
    const viewport = grid.querySelector<HTMLElement>('.rows-viewport');
    if (viewport) {
      lastViewportHeight = viewport.clientHeight;
      applyRowHeight();
      heightRo.observe(viewport);
    }
  });

  // === Keyboard navigation across month boundaries ===
  //
  // The grid handles arrow keys within the visible cells natively. We only
  // intercept at the month boundaries (first / last day of the visible
  // month) and the always-on PageUp / PageDown shortcuts:
  //
  //   First day  ArrowLeft   → last day of previous month
  //   First day  ArrowUp     → same weekday, previous month (last occurrence)
  //   Last  day  ArrowRight  → first day of next month
  //   Last  day  ArrowDown   → same weekday, next month (first occurrence)
  //   Any   day  PageUp      → same day-of-month, previous month (clamped)
  //   Any   day  PageDown    → same day-of-month, next month (clamped)
  //
  // The listener runs in capture so it can suppress the grid's native arrow
  // behavior before it moves focus off the edge.
  //
  // Enter is also intercepted here (capture phase) to open the "add event"
  // dialog on the currently focused cell — same payload the dblclick path
  // resolves, just sourced from `grid.focusedCell` instead of the mouse
  // target. Capture phase keeps the grid's built-in Enter handling (which
  // would try to start inline editing) from firing first.
  const onKeydown = (ev: KeyboardEvent): void => {
    if (ev.key === 'Enter' && !ev.altKey && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey) {
      const focused = grid.focusedCell;
      if (focused && focused.field !== 'weekNumber') {
        const week = grid.rows?.[focused.rowIndex];
        const day = week?.[focused.field as (typeof WEEKDAY_FIELDS)[number]];
        if (day) {
          ev.preventDefault();
          ev.stopPropagation();
          dialogHandle.open(day);
          return;
        }
      }
    }
    handleKeydown(grid, state, rerender, ev);
  };
  grid.addEventListener('keydown', onKeydown, true);

  // === Double-click → "add event" dialog ===
  //
  // The grid's built-in editing plugin is for *inline* value editing of a
  // single primitive cell value, but here each cell is a `CalendarDay` with
  // an `events: CalendarEvent[]` array — there is no single value to edit.
  // A modal dialog is the right shape for "create a new entry", so we
  // bypass the editing plugin entirely.
  //
  // Implementation is trickier than it sounds:
  //  - We can't use `dblclick`: the grid rewrites the cell's *interior*
  //    markup (`.cal-cell` and below) on every focus/state change, so the
  //    second click of a real user double-click lands on a freshly-created
  //    child node. Browsers only fire `dblclick` when both clicks share a
  //    target node, so the event never fires for interior clicks.
  //  - We can't use `click` either: when the user presses on
  //    `.cal-cell__date`, the grid's own `mousedown` handler synchronously
  //    re-renders the interior to update focus styling. By the time
  //    `mouseup` happens, the target node is gone — and `click` only
  //    fires when mousedown and mouseup share the same node.
  //  - The stable element is `.cell` itself; only its children are
  //    replaced. So we count `mousedown` events in **capture phase**
  //    (runs before the grid's bubble-phase handler, before the re-render)
  //    and treat two mousedowns on the same `.cell` within 400 ms as a
  //    double-click.
  const dialogHandle = createEventDialog((newEvent, day) => {
    const key = isoKey(day.date);
    const bucket = userEvents.get(key);
    if (bucket) bucket.push(newEvent);
    else userEvents.set(key, [newEvent]);
    // Preserve focus position so the user can keep navigating after the dialog closes.
    const focused = grid.focusedCell;
    rerender(
      focused ? { position: { rowIndex: focused.rowIndex, colIndex: focused.colIndex } } : { day: day.date.getDate() },
    );
  });
  const DBLCLICK_MS = 400;
  let lastMousedownCell: HTMLElement | null = null;
  let lastMousedownTime = 0;
  const onMousedown = (ev: MouseEvent): void => {
    // Only main button counts as a "click".
    if (ev.button !== 0) return;
    const cell = (ev.target as HTMLElement | null)?.closest<HTMLElement>('.cell[data-col]');
    if (!cell) {
      lastMousedownCell = null;
      return;
    }
    const now = ev.timeStamp;
    if (lastMousedownCell === cell && now - lastMousedownTime < DBLCLICK_MS) {
      lastMousedownCell = null;
      lastMousedownTime = 0;
      const day = resolveDayFromCell(grid, cell);
      if (day) dialogHandle.open(day);
      return;
    }
    lastMousedownCell = cell;
    lastMousedownTime = now;
  };
  grid.addEventListener('mousedown', onMousedown, true);

  // === Responsive density + dynamic row height ===
  //
  // Two observers, each on the element it actually cares about:
  //   - Width  → observe the grid host; flip `data-density` (full /
  //     compact / minimal) via a CSS attribute selector.
  //   - Height → observe `.rows-viewport` (the scrollable rows area
  //     inside the grid); set `rowHeight = viewportHeight / weekCount`
  //     so every row is identical and `weekCount * rowHeight` exactly
  //     fills the viewport — no empty strip, no inner scrollbar.
  //
  // `gridConfig` is a merge target — re-assigning a partial just patches
  // the fields we name, so plugins / columns / fitMode are preserved.
  let lastDensity: 'full' | 'compact' | 'minimal' | null = null;
  let lastRowHeight = DEFAULT_ROW_HEIGHT_PX;
  let lastViewportHeight = 0;

  function applyRowHeight(): void {
    const weekCount = Math.max(grid.rows?.length ?? 0, 1);
    if (lastViewportHeight <= 0) return;
    // Math.floor avoids the fractional pixel that would otherwise push the
    // last row half a pixel past the bottom edge and trigger a scrollbar.
    const next = Math.floor(lastViewportHeight / weekCount);
    if (next > 0 && next !== lastRowHeight) {
      lastRowHeight = next;
      // Row visual height is driven by the `--tbw-row-height` CSS variable
      // (cells use `min-height: var(--tbw-row-height)`). Setting
      // `gridConfig.rowHeight` only updates the virtualization model, not
      // the actual cell size, so for visual sizing the CSS variable is the
      // source of truth. We also patch `gridConfig.rowHeight` to keep
      // virtualization aligned with reality.
      grid.style.setProperty('--tbw-row-height', `${next}px`);
      currentConfig.rowHeight = next;
      // Re-assign a fresh reference so the setter's identity short-circuit
      // (it bails when the SAME object is set twice) doesn't skip the update.
      grid.gridConfig = { ...currentConfig };
    }
  }

  // Width observer on the host — density breakpoints don't care about height.
  const widthRo = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    const width = entry.contentRect.width;
    const density = width >= DENSITY_FULL_PX ? 'full' : width >= DENSITY_COMPACT_PX ? 'compact' : 'minimal';
    if (density !== lastDensity) {
      grid.setAttribute('data-density', density);
      lastDensity = density;
    }
  });
  widthRo.observe(grid);

  // Height observer on `.rows-viewport`. The element is created when the
  // grid first renders, so we wait for `ready()` before attaching.
  const heightRo = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    const height = entry.contentRect.height;
    if (height === lastViewportHeight) return;
    lastViewportHeight = height;
    applyRowHeight();
  });

  return {
    grid,
    destroy: () => {
      widthRo.disconnect();
      heightRo.disconnect();
      grid.removeEventListener('keydown', onKeydown, true);
      grid.removeEventListener('mousedown', onMousedown, true);
      dialogHandle.destroy();
    },
  };

  // ===========================================================================
  // Helpers (closures so they capture `state`)
  // ===========================================================================

  function buildConfig(): GridConfig<CalendarWeek> {
    const weekdayColumns: ColumnConfig<CalendarWeek>[] = WEEKDAY_FIELDS.map((field) => ({
      field,
      // Plain-text fallback used by ARIA / a11y / export.
      header: WEEKDAY_HEADERS_FULL[field],
      // Visual label: three width variants in one node; CSS shows the right
      // one based on the grid host's `[data-density]` attribute.
      headerLabelRenderer: () => renderWeekdayHeader(field),
      // No `width` set → eligible for stretch under `fitMode: 'stretch'`.
      minWidth: 60,
      sortable: false,
      resizable: false,
      // Default accessor reads `row[field]` (a `CalendarDay`), so the
      // renderer just hands it straight to the day-cell renderer.
      renderer: (ctx) => renderDayCell(ctx.value as CalendarDay),
    }));

    return {
      fitMode: 'stretch',
      // Header gets a custom section; do not set a title (it would be the
      // only thing in the left slot and override our centered controls).
      shell: { header: { toolPanelToggle: false } },
      // Initial fallback; the ResizeObserver below recomputes this from
      // (host height − chrome) ÷ weekCount so the 4-6 visible weeks fill
      // the viewport like an Outlook calendar.
      rowHeight: DEFAULT_ROW_HEIGHT_PX,
      // Category color legend lives in a pinned-bottom panel row rather
      // than in the header — out of the way but always visible.
      features: {
        pinnedRows: {
          slots: [
            {
              id: 'calendar-legend',
              position: 'bottom',
              render: () => renderLegend(),
            },
          ],
        },
      },
      columns: [
        {
          field: 'weekNumber',
          header: 'W',
          width: 44,
          sortable: false,
          resizable: false,
          cellClass: () => 'cal-week-cell',
        },
        ...weekdayColumns,
      ],
    };
  }
}

// #region Shell header (title + year dropdown + nav buttons)
/**
 * Register the calendar's shell-header content: month title and year
 * dropdown in the left/center, prev/today/next buttons in the toolbar slot
 * on the right. Returns an `update()` that re-syncs the title + dropdown to
 * the current `state` after each `rerender()`.
 */
function mountNav(
  grid: DataGridElement<CalendarWeek>,
  state: CalendarState,
  onChange: (focusTarget?: { day: number }) => void,
): { update: () => void } {
  let titleEl: HTMLSpanElement | null = null;
  let yearEl: HTMLSelectElement | null = null;

  grid.registerHeaderContent?.({
    id: 'calendar-nav',
    order: 0,
    render: (container) => {
      container.classList.add('cal-header');

      titleEl = document.createElement('span');
      titleEl.className = 'cal-header__title';
      container.appendChild(titleEl);

      const select = document.createElement('select');
      select.className = 'cal-header__year';
      select.setAttribute('aria-label', 'Year');
      const currentYear = new Date().getFullYear();
      for (let y = currentYear - YEAR_RANGE; y <= currentYear + YEAR_RANGE; y++) {
        const opt = document.createElement('option');
        opt.value = String(y);
        opt.textContent = String(y);
        select.appendChild(opt);
      }
      select.value = String(state.year);
      select.addEventListener('change', () => {
        state.year = parseInt(select.value, 10);
        onChange();
      });
      container.appendChild(select);
      yearEl = select;

      update();
    },
  });

  grid.registerToolbarContent?.({
    id: 'calendar-nav-buttons',
    order: 0,
    render: (container) => {
      container.classList.add('cal-toolbar-nav');
      container.append(
        makeBtn('‹', 'Previous month', () => {
          shiftMonth(state, -1);
          onChange();
        }),
        makeBtn('Today', 'Jump to current month', () => {
          const now = new Date();
          state.year = now.getFullYear();
          state.month = now.getMonth();
          // Focus today's cell after rerender so keyboard navigation picks
          // up from where the user visually expects it.
          onChange({ day: now.getDate() });
        }),
        makeBtn('›', 'Next month', () => {
          shiftMonth(state, 1);
          onChange();
        }),
      );
    },
  });

  function update(): void {
    // Year is shown in the adjacent dropdown — no need to repeat it here.
    if (titleEl) titleEl.textContent = MONTH_NAMES[state.month] ?? '';
    if (yearEl) yearEl.value = String(state.year);
  }

  return { update };
}

/** Shift `state` by `delta` months, normalizing year/month via JS Date overflow. */
function shiftMonth(state: CalendarState, delta: number): void {
  const d = new Date(state.year, state.month + delta, 1);
  state.year = d.getFullYear();
  state.month = d.getMonth();
}

/** Build the category color legend DOM for the pinned-bottom panel slot. */
function renderLegend(): HTMLElement {
  const legend = document.createElement('div');
  legend.className = 'cal-legend';
  for (const c of CATEGORIES) {
    const item = document.createElement('span');
    item.className = 'cal-legend__item';
    const swatch = document.createElement('span');
    swatch.className = 'cal-legend__swatch';
    swatch.style.background = `var(--cal-cat-${c.id})`;
    const label = document.createElement('span');
    label.textContent = c.label;
    item.append(swatch, label);
    legend.appendChild(item);
  }
  return legend;
}

/**
 * Build the weekday header label node with three width variants in one DOM.
 * CSS shows one based on the grid host's `[data-density]`:
 * `full` → "Monday", `compact` → "Mon", `minimal` → "M".
 */
function renderWeekdayHeader(field: WeekdayField): HTMLElement {
  const root = document.createElement('span');
  root.className = 'cal-wday';
  for (const [variant, label] of [
    ['full', WEEKDAY_HEADERS_FULL[field]],
    ['short', WEEKDAY_HEADERS[field]],
    ['mini', WEEKDAY_HEADERS_MINI[field]],
  ] as const) {
    const span = document.createElement('span');
    span.className = `cal-wday__${variant}`;
    span.textContent = label;
    root.appendChild(span);
  }
  return root;
}

function makeBtn(label: string, ariaLabel: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cal-header__btn';
  btn.textContent = label;
  btn.setAttribute('aria-label', ariaLabel);
  btn.title = ariaLabel;
  btn.addEventListener('click', onClick);
  return btn;
}
// #endregion

// #region Row construction (event source + week builder)
function makeRows(state: CalendarState, userEvents: ReadonlyMap<string, CalendarEvent[]>): CalendarWeek[] {
  const generated = generateEvents(state.year, state.month);
  // Merge user-added events with the deterministic demo events. We mutate
  // a shallow-cloned map rather than touching `generated.byDate` directly so
  // a future caller could pass an immutable map without surprises.
  const byDate = new Map(generated.byDate);
  for (const [key, evs] of userEvents) {
    const existing = byDate.get(key);
    const merged = existing ? [...existing, ...evs] : [...evs];
    // Keep the cell renderer's "ordered by start time" invariant.
    merged.sort((a, b) => a.startTime.localeCompare(b.startTime));
    byDate.set(key, merged);
  }
  return buildWeeks(state.year, state.month, byDate);
}
// #endregion

// #region "Add event" dialog
/**
 * Resolve the `CalendarDay` payload for the cell that was dbl-clicked.
 *
 * Reads coordinates from the cell DOM (rather than `grid.focusedCell`) so
 * we are robust to any ordering quirk between the grid's mousedown→focus
 * pipeline and the bubbling dblclick. Returns `null` for the read-only
 * week-number column.
 */
function resolveDayFromCell(grid: DataGridElement<CalendarWeek>, cell: HTMLElement): CalendarDay | null {
  const colIndexAttr = cell.getAttribute('data-col');
  if (colIndexAttr === null) return null;
  const colIndex = Number(colIndexAttr);
  // Column 0 is the week-number column — no day to attach an event to.
  if (colIndex <= 0) return null;
  const rowEl = cell.closest<HTMLElement>('.data-grid-row');
  if (!rowEl) return null;
  // `aria-rowindex` is 1-based and includes the single header row, so
  // subtract 2 to land on the 0-based row index in `grid.rows`.
  const ariaRowIndex = Number(rowEl.getAttribute('aria-rowindex'));
  if (!Number.isFinite(ariaRowIndex)) return null;
  const rowIndex = ariaRowIndex - 2;
  const week = grid.rows?.[rowIndex];
  if (!week) return null;
  // colIndex 1..7 → 'mon'..'sun'
  const field = WEEKDAY_FIELDS[colIndex - 1];
  if (!field) return null;
  return week[field] ?? null;
}

interface EventDialogHandle {
  open: (day: CalendarDay) => void;
  destroy: () => void;
}

/**
 * Build a single reusable `<dialog>` element with a small "new entry" form.
 *
 * - Lives outside the grid host so it can render above all density variants
 *   without fighting their `overflow: hidden`.
 * - `<dialog>` element provides modality, ESC-to-close, and focus trap for
 *   free — no need for a custom overlay/z-index dance.
 * - On submit: pass the new event back to `onSubmit` and close. The caller
 *   owns persistence + rerender.
 */
function createEventDialog(onSubmit: (event: CalendarEvent, day: CalendarDay) => void): EventDialogHandle {
  const dialog = document.createElement('dialog');
  dialog.className = 'cal-event-dialog';

  const form = document.createElement('form');
  form.method = 'dialog';
  form.className = 'cal-event-dialog__form';

  const title = document.createElement('h2');
  title.className = 'cal-event-dialog__title';
  form.appendChild(title);

  const titleField = field('Title', () => {
    const i = document.createElement('input');
    i.type = 'text';
    i.name = 'title';
    i.required = true;
    i.placeholder = 'e.g. Team sync';
    return i;
  });
  const categoryField = field('Category', () => {
    const s = document.createElement('select');
    s.name = 'category';
    for (const c of CATEGORIES) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.label;
      s.appendChild(opt);
    }
    return s;
  });
  const timeField = field('Start time', () => {
    const i = document.createElement('input');
    i.type = 'time';
    i.name = 'startTime';
    i.required = true;
    i.value = '09:00';
    return i;
  });
  form.append(titleField.wrapper, categoryField.wrapper, timeField.wrapper);

  const actions = document.createElement('div');
  actions.className = 'cal-event-dialog__actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'cal-header__btn';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => dialog.close());
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'cal-header__btn cal-header__btn--primary';
  submit.textContent = 'Add entry';
  actions.append(cancel, submit);
  form.appendChild(actions);

  dialog.appendChild(form);
  document.body.appendChild(dialog);

  let currentDay: CalendarDay | null = null;

  form.addEventListener('submit', (ev) => {
    // method=dialog already prevents the default form-submit navigation,
    // but we still need to read values *before* the dialog closes (some
    // browsers clear inputs on close).
    ev.preventDefault();
    if (!currentDay) {
      dialog.close();
      return;
    }
    const newEvent: CalendarEvent = {
      id: `user-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      title: titleField.input.value.trim() || 'Untitled',
      category: categoryField.input.value as CalendarEvent['category'],
      startTime: timeField.input.value || '09:00',
    };
    const day = currentDay;
    dialog.close();
    onSubmit(newEvent, day);
  });

  return {
    open: (day) => {
      currentDay = day;
      const dateLabel = day.date.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      title.textContent = `New entry — ${dateLabel}`;
      titleField.input.value = '';
      categoryField.input.value = CATEGORIES[0].id;
      timeField.input.value = '09:00';
      dialog.showModal();
      // Focus the title input after the browser hands control back; calling
      // focus() synchronously inside showModal() can be overridden by the
      // dialog's own initial-focus logic.
      queueMicrotask(() => titleField.input.focus());
    },
    destroy: () => {
      if (dialog.open) dialog.close();
      dialog.remove();
    },
  };
}

function field<T extends HTMLInputElement | HTMLSelectElement>(
  labelText: string,
  build: () => T,
): { wrapper: HTMLLabelElement; input: T } {
  const wrapper = document.createElement('label');
  wrapper.className = 'cal-event-dialog__field';
  const span = document.createElement('span');
  span.textContent = labelText;
  const input = build();
  wrapper.append(span, input);
  return { wrapper, input };
}
// #endregion

// #region Keyboard navigation across month boundaries
/**
 * Arrow-key → day-of-month delta. Anything else is left to the grid's
 * native arrow handling (or to the dedicated PageUp/PageDown branch below).
 */
const ARROW_DAY_DELTA: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

/**
 * Date-based navigation: every cell represents a date, so navigation reduces
 * to date arithmetic. The visible 4–6 weeks contain leading / trailing
 * out-of-month days, and the user's mental model is "move by a day / week /
 * month", not "move to the next cell" — so e.g. Sunday → ArrowRight goes to
 * the following Monday (which is in the row below), not to "no-op at the
 * right edge".
 *
 *   ArrowLeft  → date − 1
 *   ArrowRight → date + 1
 *   ArrowUp    → date − 7
 *   ArrowDown  → date + 7
 *   PageUp     → same day-of-month, previous month (clamped)
 *   PageDown   → same day-of-month, next month (clamped)
 *
 * If the target date is in the currently-viewed month we just move focus
 * within the existing grid. Otherwise we switch view to the target's month
 * and focus the in-month cell for that date after re-render.
 *
 * Runs in capture phase so it can override the grid's native arrow handling
 * (which only sees cells, not dates, and would stop at the row edges).
 */
function handleKeydown(
  grid: DataGridElement<CalendarWeek>,
  state: CalendarState,
  rerender: (focusTarget?: { day: number } | { position: { rowIndex: number; colIndex: number } }) => void,
  ev: KeyboardEvent,
): void {
  if (ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
  const focused = grid.focusedCell;
  if (!focused) return;
  // Column 0 is the read-only `week#` column — let the grid handle arrows
  // there natively.
  if (focused.field === 'weekNumber') return;
  const week = grid.rows?.[focused.rowIndex];
  if (!week) return;
  const day = week[focused.field as (typeof WEEKDAY_FIELDS)[number]];
  if (!day) return;

  // PageUp / PageDown preserve the "same weekday in same week-of-month"
  // position rather than the date — the user thinks of them as "flip the
  // calendar page", so the focused cell should stay in the same visual
  // slot. `rerender` clamps the row when the new month has fewer weeks.
  if (ev.key === 'PageUp' || ev.key === 'PageDown') {
    ev.preventDefault();
    ev.stopPropagation();
    shiftMonth(state, ev.key === 'PageUp' ? -1 : 1);
    rerender({ position: { rowIndex: focused.rowIndex, colIndex: focused.colIndex } });
    return;
  }

  const delta = ARROW_DAY_DELTA[ev.key];
  if (delta === undefined) return;
  const target = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate() + delta);

  ev.preventDefault();
  ev.stopPropagation();

  const targetYear = target.getFullYear();
  const targetMonth = target.getMonth();
  const targetDay = target.getDate();

  if (targetYear === state.year && targetMonth === state.month) {
    // Target is in the currently-viewed month — find its cell in the
    // existing grid and move focus. `grid.rows` is the trustworthy
    // source here because we have NOT just reassigned it.
    const pos = findDayPosition(grid.rows ?? [], targetYear, targetMonth, targetDay);
    if (pos) grid.focusCell?.(pos.rowIndex, pos.colIndex);
    return;
  }

  state.year = targetYear;
  state.month = targetMonth;
  rerender({ day: targetDay });
}

/**
 * Locate the `(rowIndex, colIndex)` of an in-month day in the given week
 * rows. Called with the freshly-built rows (not `grid.rows`, whose getter
 * may briefly still return the previous month's data after assignment).
 */
function findDayPosition(
  rows: readonly CalendarWeek[],
  year: number,
  month: number,
  dayOfMonth: number,
): { rowIndex: number; colIndex: number } | null {
  for (let r = 0; r < rows.length; r++) {
    for (let i = 0; i < WEEKDAY_FIELDS.length; i++) {
      const d = rows[r][WEEKDAY_FIELDS[i]];
      if (
        d.inMonth &&
        d.date.getFullYear() === year &&
        d.date.getMonth() === month &&
        d.date.getDate() === dayOfMonth
      ) {
        // Column 0 is `week#`, weekday columns start at index 1.
        return { rowIndex: r, colIndex: i + 1 };
      }
    }
  }
  return null;
}
// #endregion
