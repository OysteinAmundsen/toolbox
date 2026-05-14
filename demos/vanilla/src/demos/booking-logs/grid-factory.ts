/**
 * Booking-Logs Grid Factory (Vanilla)
 *
 * Builds a `<tbw-grid>` configured with three plugins:
 *
 * - **server-side**: pulls pages from `GET /api/logs` in infinite-scroll mode.
 * - **filtering**: provides per-column filter UI in the header. Filter state
 *   is forwarded to `dataSource.getRows` via `params.filterModel` (no manual
 *   wiring needed — the server-side plugin queries the filtering plugin every
 *   request).
 * - **pinned-rows**: bottom status bar showing dataset size.
 *
 * The filtering plugin owns all filter UI here. There is no external toolbar:
 *
 * | Column   | Filter UI                                                 |
 * | -------- | --------------------------------------------------------- |
 * | level    | built-in **set** filter (checkbox list, finite vocab)     |
 * | service  | built-in **set** filter (checkbox list, finite vocab)     |
 * | region   | built-in **set** filter (checkbox list, finite vocab)     |
 * | status   | **custom** devops panel: 2xx/3xx/4xx/5xx + specific code  |
 * | endpoint | built-in **text** filter (substring contains)             |
 * | traceId  | **custom** filter panel: single input, exact match        |
 * | timestamp| **custom** datetime range panel (datetime-local inputs)   |
 *
 * Static unique values for the three set filters are supplied via
 * `valuesHandler`. In a real server-side app this would `fetch` distinct
 * values from `/api/distinct/<field>`; here the vocabularies are finite so
 * we just return the static arrays. Same shape, no network round-trip.
 *
 * Cell renderers live in `./renderers/`; custom filter panels live in
 * `./filters/`. This file focuses on grid wiring: data source, plugin
 * config, event glue, and the `BookingLogsGridHandle` API exposed to the
 * route module.
 */

import '@toolbox-web/grid';
import '@toolbox-web/grid/features/filtering';
import '@toolbox-web/grid/features/pinned-rows';
import '@toolbox-web/grid/features/server-side';

import type { BookingLogEntry, BookingLogsResponse, BookingLogsScanProgress } from '@demo/shared/booking-logs';
import { DATASET_SIZE, LEVELS, REGIONS, SERVICES } from '@demo/shared/booking-logs';
import {
  ContextMenuPlugin,
  createGrid,
  type ContextMenuItem,
  type DataGridElement,
  type InternalGrid,
} from '@toolbox-web/grid/all';

import { renderDateTimePanel, renderStatusPanel, renderTraceIdPanel, type CustomPanelParams } from './filters';
import { COLUMNS, escapeHtml } from './renderers';
import type { DemoFilterModel } from './types';

/**
 * Translate the filtering plugin's `filterModel` into the API's query string.
 *
 * The vite middleware (`/api/logs`) accepts allow-lists for level/service/region
 * (`level=INFO,ERROR` means "include only these"). The filtering plugin's set
 * filter stores **excluded** values (`operator: 'notIn'`), so for the three
 * finite-vocab columns we compute `included = ALL \ excluded`. For text
 * (`endpoint`) we forward the substring; for the custom traceId panel we
 * forward the exact match (`operator: 'equals'`).
 */
// #region Filter → query string
function appendFilterParams(params: URLSearchParams, filterModel: Record<string, DemoFilterModel> | undefined): void {
  if (!filterModel) return;
  const setColumns: Array<{ field: 'level' | 'service' | 'region'; vocab: readonly string[] }> = [
    { field: 'level', vocab: LEVELS },
    { field: 'service', vocab: SERVICES },
    { field: 'region', vocab: REGIONS },
  ];
  for (const { field, vocab } of setColumns) {
    const f = filterModel[field];
    if (!f) continue;
    if (f.operator === 'in' && Array.isArray(f.value) && f.value.length) {
      params.set(field, (f.value as string[]).join(','));
    } else if (f.operator === 'notIn' && Array.isArray(f.value) && f.value.length) {
      const excluded = new Set(f.value as string[]);
      const included = vocab.filter((v) => !excluded.has(v));
      // If everything is excluded the result is intentionally empty so the
      // API returns no rows rather than the unfiltered dataset.
      params.set(field, included.join(','));
    }
  }
  const endpoint = filterModel['endpoint'];
  if (endpoint && typeof endpoint.value === 'string' && endpoint.value.trim()) {
    params.set('endpoint', endpoint.value.trim());
  }
  const status = filterModel['statusCode'];
  if (status && typeof status.value === 'number') {
    // Built-in number panel emits operator: 'equals' | 'lessThan' | 'lessThanOrEqual'
    // | 'greaterThan' | 'greaterThanOrEqual' | 'between'. Map each to the API's
    // inclusive [min, max] envelope.
    const v = status.value;
    const v2 = typeof status.valueTo === 'number' ? status.valueTo : undefined;
    switch (status.operator) {
      case 'equals':
        params.set('statusCodeMin', String(v));
        params.set('statusCodeMax', String(v));
        break;
      case 'lessThan':
        params.set('statusCodeMax', String(v - 1));
        break;
      case 'lessThanOrEqual':
        params.set('statusCodeMax', String(v));
        break;
      case 'greaterThan':
        params.set('statusCodeMin', String(v + 1));
        break;
      case 'greaterThanOrEqual':
        params.set('statusCodeMin', String(v));
        break;
      case 'between':
        if (v2 !== undefined) {
          params.set('statusCodeMin', String(Math.min(v, v2)));
          params.set('statusCodeMax', String(Math.max(v, v2)));
        }
        break;
    }
  }
  const traceId = filterModel['traceId'];
  if (traceId && typeof traceId.value === 'string' && traceId.value.trim()) {
    params.set('traceId', traceId.value.trim());
  }
  // Custom date+time filter panel (registered via `filterPanelRenderer`)
  // emits ms-since-epoch numbers via `applyTextFilter`. We translate those
  // into the API's `tsFrom`/`tsTo` envelope. No bucketing or timezone
  // gymnastics needed — the panel is the single source of truth.
  const ts = filterModel['timestamp'];
  if (ts) {
    const v = typeof ts.value === 'number' && Number.isFinite(ts.value) ? ts.value : undefined;
    const v2 = typeof ts.valueTo === 'number' && Number.isFinite(ts.valueTo) ? ts.valueTo : undefined;
    if (v !== undefined) {
      switch (ts.operator) {
        case 'greaterThanOrEqual':
          params.set('tsFrom', String(v));
          break;
        case 'lessThanOrEqual':
          params.set('tsTo', String(v));
          break;
        case 'between':
          if (v2 !== undefined) {
            params.set('tsFrom', String(Math.min(v, v2)));
            params.set('tsTo', String(Math.max(v, v2)));
          }
          break;
      }
    }
  }
}

function buildQueryString(
  start: number,
  end: number,
  filterModel: Record<string, DemoFilterModel> | undefined,
): string {
  const params = new URLSearchParams();
  params.set('start', String(start));
  params.set('end', String(end));
  appendFilterParams(params, filterModel);
  return params.toString();
}
// #endregion

// #region Public types & local constants
/** Result of {@link createBookingLogsGrid}. */
export interface BookingLogsGridHandle {
  grid: DataGridElement<BookingLogEntry>;
  /**
   * Subscribe to row-activation for the side detail panel. "Activation"
   * means an explicit user gesture: a double-click on the row, pressing
   * Enter while a cell in the row has keyboard focus, or selecting "Show
   * details" from the right-click context menu. A plain single click only
   * focuses the row (no drawer); this matches the desktop-grid convention
   * used by Excel, Datadog, Kibana etc., where single click is navigation
   * and double click / Enter / explicit menu is "open".
   */
  onRowActivate(handler: (entry: BookingLogEntry) => void): () => void;
  /** Subscribe to filter-change events (e.g. to hide the side detail panel on change). */
  onFilterChange(handler: () => void): () => void;
  /**
   * Apply (or clear) the trace-ID filter. Centralised here so both the
   * context-menu "View trace" action and the detail-panel "Show trace"
   * button funnel through the same code path.
   */
  showTrace(traceId: string | null): void;
}

/** Vocabularies served by `valuesHandler` so the set-filter checkboxes know what to render. */
const VOCAB: Record<string, readonly string[]> = {
  level: LEVELS,
  service: SERVICES,
  region: REGIONS,
};

/** Page size for the server-side plugin. See README in this folder for tuning rationale. */
const API_PAGE_SIZE = 100;
const CACHE_BLOCK_SIZE = 50;
// #endregion

// #region Factory
export function createBookingLogsGrid(): BookingLogsGridHandle {
  const grid = createGrid<BookingLogEntry>();
  grid.id = 'booking-logs-grid';
  grid.className = 'demo-grid booking-logs-grid';

  // Shell — title + center-slot freetext search. The search input applies a
  // `text contains` filter on the `endpoint` column via the filtering plugin
  // (which the server-side plugin then forwards to `/api/logs?endpoint=…`).
  // No tool buttons or tool panel are configured — the filtering plugin
  // already owns all per-column UI in the headers.
  const header = document.createElement('tbw-grid-header');
  header.setAttribute('title', 'Booking Logs');
  const headerContent = document.createElement('tbw-grid-header-content');
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'bl-shell-search';
  search.placeholder = 'Search endpoints…';
  search.spellcheck = false;
  search.autocomplete = 'off';
  search.setAttribute('aria-label', 'Search log endpoints');
  headerContent.appendChild(search);

  // Trace-mode banner. Hidden by default; surfaces when the `traceId` filter
  // is active (e.g. via the right-click “View trace” action). Shows the
  // active trace ID + a “Show all” button to clear the filter, so users
  // never feel “stuck” in the filtered view. Render is fed by the
  // `filter-change` listener wired below — we keep this element pre-built
  // so showing/hiding it doesn't churn the headerContent layout.
  const traceBanner = document.createElement('div');
  traceBanner.className = 'bl-trace-banner';
  traceBanner.hidden = true;
  traceBanner.setAttribute('role', 'status');
  traceBanner.setAttribute('aria-live', 'polite');
  headerContent.appendChild(traceBanner);

  header.appendChild(headerContent);
  grid.appendChild(header);

  // Debounced search → filtering plugin. We mirror the plugin's own debounceMs
  // (250) so typing feels identical to using the column header text filter.
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  search.addEventListener('input', () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const filtering = grid.getPluginByName?.('filtering') as
        | {
            setFilter?: (field: string, model: DemoFilterModel | null) => void;
            clearFieldFilter?: (field: string) => void;
          }
        | undefined;
      const v = search.value.trim();
      if (!filtering) return;
      if (v) {
        filtering.setFilter?.('endpoint', {
          field: 'endpoint',
          type: 'text',
          operator: 'contains',
          value: v,
        });
      } else {
        filtering.clearFieldFilter?.('endpoint');
      }
    }, 250);
  });

  // Track loading state for the pinned-rows footer. Updated by the
  // `datasource:loading` event below; the panel renderers read this flag.
  // We mirror it onto `grid.loading` so the built-in loading overlay shows
  // while the data source is in flight (and, critically, suppresses the
  // "No data" overlay when a fresh filter has wiped the cache and is about
  // to refill it — otherwise the user sees a discouraging empty state for
  // the duration of the round-trip).
  let loading = false;

  // Row-activation handlers, fired by both the dblclick/Enter path and the
  // context-menu "Show details" item. A shared Set is the simplest way to
  // route both gestures through the same downstream subscriber (the side
  // detail panel) without leaking grid internals to the route module.
  const activateHandlers = new Set<(entry: BookingLogEntry) => void>();
  function fireActivate(entry: BookingLogEntry): void {
    for (const h of activateHandlers) h(entry);
  }

  // Latest server-reported scan progress. The `/api/logs` endpoint returns
  // it on every filtered response so we can show "matched so far" while the
  // backend is still scanning the dataset (instead of a useless `?`).
  // Cleared on filter-change so stale numbers don't bleed across queries.
  let scanProgress: BookingLogsScanProgress | undefined;

  const dataSource = {
    async getRows(params: {
      startNode: number;
      endNode: number;
      signal: AbortSignal;
      filterModel?: Record<string, DemoFilterModel>;
    }): Promise<{ rows: BookingLogEntry[]; totalNodeCount: number; lastNode?: number }> {
      const qs = buildQueryString(params.startNode, params.endNode, params.filterModel);
      const res = await fetch(`/api/logs?${qs}`, { signal: params.signal });
      if (!res.ok) throw new Error(`/api/logs ${res.status}`);
      const body = (await res.json()) as BookingLogsResponse;
      scanProgress = body.scanProgress;
      return body;
    },
  };

  grid.gridConfig = {
    columns: COLUMNS,
    // Pin `rowHeight` to the actual rendered height (34 px). Badge content
    // (status pills, level chips, duration text) pushes data rows above
    // the 28 px `--tbw-row-height` default, while server-side placeholder
    // rows render at the shorter default. Without an explicit pin the
    // measure path can latch onto whichever row type is observed first
    // (commonly the placeholder) and leave a visible gap before the
    // pinned footer once data rows arrive — see grid commit ba89e2b6.
    // The previous value of 32 underflowed the real 34 and made the last
    // ~6% of the dataset unreachable via scroll.
    rowHeight: 34,
    plugins: [
      // Right-click any row cell that has a traceId → “View trace” pivots
      // the grid to show only spans that share the row's traceId. The
      // server-side plugin re-fetches with the new filter; the trace-mode
      // banner (above) provides the escape hatch back to the full dataset.
      // Header right-clicks (params.isHeader) and rows whose data hasn't
      // loaded yet (no row, or no traceId) get an empty array → the plugin
      // treats that as “no menu” and the browser's native menu wins, which
      // is the right behaviour: there's nothing useful to offer.
      new ContextMenuPlugin({
        items: (params) => {
          if (params.isHeader) return [];
          const row = params.row as BookingLogEntry | undefined;
          // Need a real loaded row (with a numeric id) for both items. A
          // placeholder row has no id yet — clicking either menu entry
          // would do nothing, so we just hide the menu in that case.
          if (!row || typeof row.id !== 'number') return [];
          const traceId = row.traceId;
          const items: ContextMenuItem[] = [
            {
              id: 'show-details',
              name: 'Show details',
              icon: '📋',
              action: () => fireActivate(row),
            },
          ];
          if (traceId && typeof traceId === 'string') {
            items.push({
              id: 'view-trace',
              name: `View trace ${traceId.slice(0, 8)}…`,
              icon: '🔗',
              action: () => showTrace(traceId),
            });
          }
          return items;
        },
      }),
    ],
    features: {
      serverSide: {
        pageSize: API_PAGE_SIZE,
        cacheBlockSize: CACHE_BLOCK_SIZE,
        loadThreshold: Math.floor(CACHE_BLOCK_SIZE / 2),
        maxConcurrentRequests: 4,
        dataSource,
      },
      filtering: {
        debounceMs: 250,
        // Static finite vocabularies — no fetch needed. Same shape as a real
        // `valuesHandler` that would call `/api/distinct/<field>`.
        valuesHandler: async (field) => (VOCAB[field] ? [...VOCAB[field]] : []),
        // Custom panels for `statusCode` (devops triage UI), `traceId` (exact
        // match input), and `timestamp` (datetime range). Returning
        // `undefined` for any other field falls through to the built-in
        // panel (set checkboxes / text input).
        filterPanelRenderer: (container, panelParams) => {
          const p: CustomPanelParams = panelParams;
          if (p.field === 'statusCode') return renderStatusPanel(container, p, grid);
          if (p.field === 'traceId') return renderTraceIdPanel(container, p);
          if (p.field === 'timestamp') return renderDateTimePanel(container, p);
          return undefined;
        },
      },
      pinnedRows: {
        position: 'bottom',
        showRowCount: false,
        customPanels: [
          {
            id: 'dataset-info',
            position: 'left',
            render: () => {
              const ss = grid.getPluginByName?.('serverSide') as
                | { getTotalNodeCount?: () => number; getLoadedBlockCount?: () => number }
                | undefined;
              const filtering = grid.getPluginByName?.('filtering') as { getFilters?: () => unknown[] } | undefined;
              const total = DATASET_SIZE;
              // `getTotalNodeCount()` returns the server-reported total for
              // the current filter (or 0 before the first response).
              const reported = ss?.getTotalNodeCount?.() ?? 0;
              // Approximate "currently loaded into the cache" as
              // loadedBlocks × cacheBlockSize, clamped to whatever total we
              // know about. Slightly overcounts on the last partial block —
              // good enough for a status counter at this dataset size.
              const blocks = ss?.getLoadedBlockCount?.() ?? 0;
              const loadedRaw = blocks * CACHE_BLOCK_SIZE;
              const hasFilter = (filtering?.getFilters?.() ?? []).length > 0;
              const fmt = (n: number) => n.toLocaleString('en-US');
              if (hasFilter) {
                if (reported > 0) {
                  // Server has fully scanned and reported the exact filtered total.
                  const loaded = Math.min(loadedRaw, reported);
                  return `${fmt(loaded)}/${fmt(reported)} of ${fmt(total)}`;
                }
                if (scanProgress) {
                  // Mid-scan: show the lower bound the server already found,
                  // suffixed with `+` so it's clear more matches may come.
                  // A tooltip-friendly progress fraction sits beside it.
                  const matched = scanProgress.matchedSoFar;
                  // Guard against `datasetSize === 0` (e.g. an unfiltered
                  // partial scan window where the server reports zero scanned
                  // bounds): division would yield NaN and render "scanned
                  // NaN%", which looks broken. Treat any non-finite ratio
                  // as zero progress so the footer always reads cleanly.
                  const rawRatio = scanProgress.scannedRows / scanProgress.datasetSize;
                  const ratio = Number.isFinite(rawRatio) ? rawRatio : 0;
                  // Round to a sensible precision: integer % when ≥1%,
                  // else 2 decimals so the user sees motion at large
                  // dataset sizes (10M rows / 500k scan budget = 5%/req
                  // peak, but a high match rate stops the scan early
                  // and ratios can be well below 1% per request).
                  const pct = ratio >= 0.01 ? `${Math.round(ratio * 100)}%` : `${(ratio * 100).toFixed(2)}%`;
                  const loaded = Math.min(loadedRaw, matched);
                  return `${fmt(loaded)}/${fmt(matched)}+ of ${fmt(total)} · scanned ${pct}`;
                }
                return `${fmt(loadedRaw)}/? of ${fmt(total)}`;
              }
              const loaded = Math.min(loadedRaw, total);
              return `${fmt(loaded)}/${fmt(total)}`;
            },
          },
          {
            id: 'hint',
            position: 'right',
            render: () =>
              loading ? '<em>Loading rows… Double-click to inspect</em>' : '<em>Double-click to inspect</em>',
          },
        ],
      },
    },
  };

  // Refresh the footer whenever the loading state flips so the right-hand
  // hint and the left-hand counters track real fetches. We deliberately do
  // NOT also refresh on `data-change`: the grid emits that event whenever
  // any pass replaces placeholders with real rows, which `pinnedRows.refresh()`
  // itself triggers — a feedback loop that re-renders the header cells
  // ~12×/sec and prevents the filter buttons from being clickable (the
  // button under the cursor is recreated between mousedown and mouseup).
  // `datasource:loading` fires once per fetch start/end which is the only
  // moment our footer counters actually need to update.
  grid.addEventListener('datasource:loading', (event) => {
    const detail = (event as CustomEvent<{ loading: boolean }>).detail;
    loading = !!detail?.loading;
    // Drive the grid's built-in loading overlay so the user sees a spinner
    // (and not the "No data" overlay) while a fresh filter is fetching its
    // first page. The overlay setter is idempotent on repeated `true`/`false`,
    // so back-to-back fetches don't flicker.
    grid.loading = loading;
    grid.getPluginByName?.('pinnedRows')?.refresh?.();
  });

  function onRowActivate(handler: (entry: BookingLogEntry) => void): () => void {
    activateHandlers.add(handler);
    // Mouse path: the grid emits `row-click` for every click. The browser
    // sets `MouseEvent.detail` to the click count, so we can fish dblclick
    // out of the same stream by gating on `detail >= 2` — no need for a
    // separate `dblclick` listener (which would race the click and risk
    // firing twice). The single click in a dblclick still falls through
    // here as a no-op, which is the desired behaviour: select-only.
    const clickListener = (event: Event) => {
      const detail = (event as CustomEvent<{ row?: BookingLogEntry; originalEvent?: MouseEvent }>).detail;
      const original = detail?.originalEvent;
      if (!original || (original.detail ?? 0) < 2) return;
      // Skip placeholder rows — they have no `id` (or an undefined one) yet.
      if (detail?.row && typeof detail.row.id === 'number') handler(detail.row);
    };
    grid.addEventListener('row-click', clickListener);

    // Keyboard path: Enter while a cell in a row is focused. We read the
    // grid's internal `_focusRow`/`_rows` instead of replicating cell-row
    // resolution: those fields are already updated by the grid's keyboard
    // navigation as the user arrows around, so by the time Enter lands
    // they're guaranteed to point at the focused row.
    const keyListener = (rawEvent: Event) => {
      const event = rawEvent as KeyboardEvent;
      if (event.key !== 'Enter' || event.altKey || event.ctrlKey || event.metaKey) return;
      // Don't hijack Enter inside an editor / filter input. Editors live
      // in the grid shadow DOM as input/select/textarea/contenteditable —
      // the original target before retargeting tells us the truth.
      const path = event.composedPath();
      const inEditable = path.some((node) => {
        if (!(node instanceof HTMLElement)) return false;
        const tag = node.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || node.isContentEditable;
      });
      if (inEditable) return;
      // `InternalGrid` is the documented public type for reading plugin-accessible
      // (`_`-prefixed) state from outside the plugin system — see `AsInternalGrid`
      // in `@toolbox-web/grid` and `.github/instructions/typescript-conventions.md`.
      const internal = grid as InternalGrid<BookingLogEntry>;
      const focusRow = internal._focusRow;
      const rows = internal._rows;
      if (focusRow == null || focusRow < 0 || !rows) return;
      const row = rows[focusRow];
      if (row && typeof row.id === 'number') {
        event.preventDefault();
        handler(row);
      }
    };
    grid.addEventListener('keydown', keyListener);

    return () => {
      activateHandlers.delete(handler);
      grid.removeEventListener('row-click', clickListener);
      grid.removeEventListener('keydown', keyListener);
    };
  }

  /**
   * Apply (or clear with `null`) the trace-ID filter. Centralised so the
   * context-menu "View trace" action and the detail-panel "Show trace"
   * button funnel through the same code path — and the trace banner state
   * stays consistent regardless of which surface initiated the pivot.
   */
  function showTrace(traceId: string | null): void {
    const filtering = grid.getPluginByName?.('filtering') as
      | {
          setFilter?: (field: string, model: DemoFilterModel | null) => void;
          clearFieldFilter?: (field: string) => void;
        }
      | undefined;
    if (!filtering) return;
    if (traceId && traceId.trim()) {
      filtering.setFilter?.('traceId', {
        field: 'traceId',
        type: 'text',
        operator: 'equals',
        value: traceId.trim(),
      });
    } else {
      filtering.clearFieldFilter?.('traceId');
    }
  }

  function onFilterChange(handler: () => void): () => void {
    const listener = () => {
      // Clear stale progress so the footer doesn't show the previous
      // filter's match count while the new query is still in flight.
      scanProgress = undefined;
      handler();
      updateTraceBanner();
      // Refresh the pinned-rows panel so the "Filtered view…" / "10M rows"
      // label reflects the new filter state.
      grid.getPluginByName?.('pinnedRows')?.refresh?.();
    };
    grid.addEventListener('filter-change', listener);
    return () => grid.removeEventListener('filter-change', listener);
  }

  /**
   * Re-render the trace-mode banner from the current `traceId` filter state.
   * Called from the `filter-change` listener; safe to call any time.
   */
  function updateTraceBanner(): void {
    const filtering = grid.getPluginByName?.('filtering') as
      | {
          getFilter?: (field: string) => DemoFilterModel | undefined;
          clearFieldFilter?: (field: string) => void;
        }
      | undefined;
    const f = filtering?.getFilter?.('traceId');
    if (f && f.operator === 'equals' && typeof f.value === 'string' && f.value.trim()) {
      const id = f.value.trim();
      traceBanner.hidden = false;
      traceBanner.innerHTML =
        `<span class="bl-trace-banner-icon" aria-hidden="true">🔗</span>` +
        `<span class="bl-trace-banner-label">Viewing trace</span>` +
        `<code class="bl-trace-banner-id">${escapeHtml(id)}</code>` +
        `<button type="button" class="bl-trace-banner-clear" data-action="clear-trace">Show all</button>`;
    } else {
      traceBanner.hidden = true;
      traceBanner.innerHTML = '';
    }
  }

  traceBanner.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-action="clear-trace"]')) {
      const filtering = grid.getPluginByName?.('filtering') as
        | { clearFieldFilter?: (field: string) => void }
        | undefined;
      filtering?.clearFieldFilter?.('traceId');
    }
  });

  // Delegated click handler for the 🔗 icon button rendered in the
  // `traceId` cell. We intercept at the grid level so the click never
  // reaches the cell's row-activate path (which would open the detail
  // panel for an unrelated row). `stopPropagation` prevents the grid's
  // own row-click handler from also firing.
  grid.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const btn = target.closest<HTMLElement>('.bl-trace-cell-show[data-action="show-trace"]');
    if (!btn) return;
    event.stopPropagation();
    const id = btn.getAttribute('data-trace-id');
    if (id) showTrace(id);
  });

  return { grid, onRowActivate, onFilterChange, showTrace };
}
// #endregion
