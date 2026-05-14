/**
 * Column definitions for the booking-logs grid.
 *
 * Each column owns its own cell renderer; helpers live in `./format.ts`.
 * The `traceId` column returns a `DocumentFragment` (not an HTML string)
 * so the hover-revealed 🔗 button survives the grid's HTML sanitiser.
 */

import type { BookingLogEntry } from '@demo/shared/booking-logs';
import type { GridConfig } from '@toolbox-web/grid/all';

import {
  PLACEHOLDER,
  durationClass,
  escapeHtml,
  formatTimestamp,
  formatTimestampDate,
  isEmpty,
  statusClass,
} from './format';

export const COLUMNS: GridConfig<BookingLogEntry>['columns'] = [
  {
    field: 'timestamp',
    header: 'Time',
    width: 110,
    sortable: false,
    filterable: true,
    // Filter UI is provided by the custom date+time panel registered via
    // `filterPanelRenderer` in `grid-factory.ts`. The panel emits
    // **ms-since-epoch numbers** via `applyTextFilter('between', fromMs, toMs)`.
    // The grid's client-side post-filter pass also runs the same predicate
    // on each row — and a row's `timestamp` field is an ISO string, not a
    // number. `filterValue` is the column's escape hatch for that mismatch:
    // we convert the row's ISO timestamp to its numeric ms equivalent so
    // the `between` comparison stays purely numerical on both sides. We
    // do **not** bucket to start-of-day (the previous workaround) — full
    // ms precision is what the picker offers and what the API accepts.
    filterValue: (value) => {
      if (typeof value !== 'string') return value;
      const t = Date.parse(value);
      return Number.isFinite(t) ? t : value;
    },
    // Returns a `Node` so the wrapper span can establish a CSS container
    // (`container-type: inline-size`). The date child is hidden by default
    // and revealed via `@container` in `demo-styles.css` once the user
    // drags the column wide enough — single source of truth (no JS
    // resize listener, no per-row layout cost).
    renderer: ({ value }) => {
      if (isEmpty(value)) return PLACEHOLDER;
      const iso = String(value);
      const wrap = document.createElement('span');
      wrap.className = 'bl-timestamp';
      const date = document.createElement('span');
      date.className = 'bl-timestamp-date';
      date.textContent = formatTimestampDate(iso);
      const time = document.createElement('span');
      time.className = 'bl-timestamp-time';
      time.textContent = formatTimestamp(iso);
      wrap.append(date, time);
      return wrap;
    },
  },
  {
    field: 'level',
    header: 'Level',
    width: 90,
    sortable: false,
    filterable: true,
    filterType: 'set',
    renderer: ({ value }) => {
      if (isEmpty(value)) return PLACEHOLDER;
      const v = String(value);
      return `<span class="bl-level lvl-${escapeHtml(v)}">${escapeHtml(v)}</span>`;
    },
  },
  {
    field: 'method',
    header: 'Method',
    width: 80,
    sortable: false,
    filterable: false,
    renderer: ({ value }) => {
      if (isEmpty(value)) return PLACEHOLDER;
      const v = String(value);
      return `<span class="bl-method m-${escapeHtml(v)}">${escapeHtml(v)}</span>`;
    },
  },
  {
    field: 'statusCode',
    header: 'Status',
    width: 90,
    type: 'number',
    sortable: false,
    filterable: true,
    renderer: ({ value }) => {
      if (isEmpty(value)) return PLACEHOLDER;
      const v = Number(value);
      return `<span class="bl-status ${statusClass(v)}">${v}</span>`;
    },
  },
  {
    field: 'endpoint',
    header: 'Endpoint',
    minWidth: 280,
    sortable: false,
    filterable: true,
    filterType: 'text',
    renderer: ({ value }) =>
      isEmpty(value) ? PLACEHOLDER : `<span class="bl-endpoint">${escapeHtml(String(value))}</span>`,
  },
  {
    field: 'durationMs',
    header: 'Duration',
    width: 90,
    type: 'number',
    sortable: false,
    filterable: false,
    renderer: ({ value }) => {
      if (isEmpty(value)) return PLACEHOLDER;
      const v = Number(value);
      return `<span class="bl-duration ${durationClass(v)}">${v} ms</span>`;
    },
  },
  {
    field: 'service',
    header: 'Service',
    width: 130,
    sortable: false,
    filterable: true,
    filterType: 'set',
    renderer: ({ value }) => (isEmpty(value) ? PLACEHOLDER : escapeHtml(String(value))),
  },
  {
    field: 'region',
    header: 'Region',
    width: 130,
    sortable: false,
    filterable: true,
    filterType: 'set',
    renderer: ({ value }) => (isEmpty(value) ? PLACEHOLDER : escapeHtml(String(value))),
  },
  {
    field: 'traceId',
    header: 'Trace ID',
    width: 160,
    sortable: false,
    filterable: true,
    // The hover-revealed 🔗 button mirrors the context-menu "View trace"
    // item and the detail-panel "Show trace" pivot — three surfaces, one
    // action. CSS in `demo-styles.css` keeps the button hidden unless the
    // row is hovered or the button itself is focused (keyboard a11y).
    // tabindex=-1 on the button keeps it out of the tab sequence (the
    // context-menu / detail-panel surfaces are the keyboard paths); we
    // still allow focus via click for the focus-visible outline.
    //
    // Returns a `Node` (not an HTML string) because the grid's HTML
    // sanitiser strips `<button>` from string output as a defensive
    // measure against renderer-injected content. DOM nodes built by the
    // renderer itself are trusted and rendered as-is.
    renderer: ({ value }) => {
      if (isEmpty(value)) return PLACEHOLDER;
      const id = String(value);
      const wrapper = document.createDocumentFragment();
      const span = document.createElement('span');
      span.className = 'bl-trace';
      span.textContent = id;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bl-trace-cell-show';
      btn.dataset.action = 'show-trace';
      btn.dataset.traceId = id;
      btn.tabIndex = -1;
      btn.title = 'Show only spans of this trace';
      btn.setAttribute('aria-label', `Show trace ${id}`);
      btn.textContent = '🔗';
      wrapper.append(span, btn);
      return wrapper;
    },
  },
];
