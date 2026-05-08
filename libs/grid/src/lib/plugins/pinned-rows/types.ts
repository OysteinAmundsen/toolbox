/**
 * Status Bar Plugin Types
 *
 * Type definitions for the status bar feature.
 * Includes both info bar functionality and aggregation row support.
 */

import type { ColumnConfig } from '../../core/types';

/**
 * Position of the status bar (info bar) relative to the grid body.
 *
 * - `'top'` — Renders above the grid header. Useful for summary toolbars.
 * - `'bottom'` — Renders below the grid body (default). Standard placement for status information.
 * @since 0.1.1
 */
export type PinnedRowsPosition = 'top' | 'bottom';

/**
 * Custom aggregation function signature.
 *
 * Receives all current rows, the target field name, and optionally the column config.
 * Should return a single aggregated value (number, string, etc.) for display in the
 * aggregation row cell.
 *
 * @example
 * ```typescript
 * const weightedAvg: AggregatorFn = (rows, field, column) => {
 *   const total = rows.reduce((sum, r) => sum + (r[field] * r.weight), 0);
 *   const weights = rows.reduce((sum, r) => sum + r.weight, 0);
 *   return weights ? total / weights : 0;
 * };
 * ```
 */
export type AggregatorFn = (rows: unknown[], field: string, column?: ColumnConfig) => unknown;

/**
 * Formats the computed aggregation value for display in the cell.
 *
 * Called after the aggregator function runs. Receives the raw computed value
 * and should return a display string (e.g. currency formatting, unit suffixes).
 *
 * @example
 * ```typescript
 * const currencyFormatter: AggregatorFormatter = (value) =>
 *   `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
 * ```
 * @since 0.2.6
 */
export type AggregatorFormatter = (value: unknown, field: string, column?: ColumnConfig) => string;

/**
 * Shorthand aggregator reference — either a built-in name or a custom function.
 *
 * Built-in names: `'sum'`, `'avg'`, `'min'`, `'max'`, `'count'`, `'first'`, `'last'`.
 * Pass a custom {@link AggregatorFn} for non-standard aggregations.
 *
 * Use {@link AggregatorConfig} instead when you also need a custom formatter.
 */
export type AggregatorRef = string | AggregatorFn;

/** Full aggregator config with optional formatter * @since 0.2.6
 */
export interface AggregatorConfig {
  /** The aggregator function or built-in key ('sum', 'avg', 'min', 'max', 'count', 'first', 'last') */
  aggFunc: AggregatorRef;
  /** Optional formatter to format the computed value for display */
  formatter?: AggregatorFormatter;
}

/** Aggregator definition - simple string/function or full config object * @since 0.2.6
 */
export type AggregatorDefinition = AggregatorRef | AggregatorConfig;

/**
 * Configuration for an aggregation row (footer/header row with computed values).
 * Replaces the core FooterRowConfig functionality.
 * @since 0.1.1
 */
export interface AggregationRowConfig {
  /** Optional identifier (useful for diffing or targeted updates) */
  id?: string;
  /** Position: 'top' renders above grid body, 'bottom' renders below (default: 'bottom') */
  position?: 'top' | 'bottom';
  /** If true, row rendered as single spanning cell with label */
  fullWidth?: boolean;
  /**
   * Row label. Can be a static string or a function that receives
   * the current rows and columns for dynamic content.
   *
   * In **full-width mode** (`fullWidth: true`), the label is displayed inline before
   * the aggregated values.
   *
   * In **per-column mode** (`fullWidth: false`, the default), the label renders as an
   * overlay positioned at the left edge of the row, independent of column alignment.
   * It does not truncate with column width.
   *
   * @example Static label
   * ```ts
   * { label: 'Totals', aggregators: { price: 'sum' } }
   * ```
   *
   * @example Dynamic label
   * ```ts
   * { label: (rows) => `Total: ${rows.length} rows` }
   * ```
   */
  label?: string | ((rows: unknown[], columns: ColumnConfig[]) => string);
  /** Static or computed cell values keyed by field */
  cells?: Record<string, unknown | string | ((rows: unknown[], field: string, column?: ColumnConfig) => unknown)>;
  /**
   * Per-field aggregator configuration.
   * Can be a simple string ('sum', 'avg', etc.), a function, or an object with aggFunc and formatter.
   * @example
   * aggregators: {
   *   quantity: 'sum',  // simple built-in
   *   price: { aggFunc: 'sum', formatter: (v) => `$${v.toFixed(2)}` }  // with formatter
   * }
   */
  aggregators?: Record<string, AggregatorDefinition>;
}

/** Configuration options for the status bar plugin * @since 0.1.1
 */
export interface PinnedRowsConfig {
  /**
   * Unified ordered list of pinned-row slots. When provided, `aggregationRows`,
   * `customPanels`, `position`, `showRowCount`, `showSelectedCount` and
   * `showFilteredCount` are ignored — slots are rendered in declared order
   * within their `position` ('top' or 'bottom', default 'bottom').
   *
   * When omitted, the plugin synthesizes a slot list from the legacy fields so
   * existing consumers keep their current DOM byte-identical.
   *
   * @example Mixed slots, top placement
   * ```ts
   * import { rowCountPanel, selectedCountPanel } from '@toolbox-web/grid/plugins/pinned-rows';
   *
   * new PinnedRowsPlugin({
   *   slots: [
   *     { position: 'top', render: rowCountPanel() },
   *     { position: 'top', aggregators: { price: 'sum' }, label: 'Total' },
   *     { position: 'bottom', render: selectedCountPanel() },
   *   ],
   * });
   * ```
   */
  slots?: PinnedRowSlot[];
  /**
   * Position of the info bar (default: 'bottom').
   * @deprecated Use {@link PinnedRowsConfig.slots} with per-slot `position`.
   */
  position?: PinnedRowsPosition;
  /**
   * Show total row count in info bar (default: true).
   * @deprecated Use {@link PinnedRowsConfig.slots} with the exported `rowCountPanel()` render function.
   */
  showRowCount?: boolean;
  /**
   * Show selected row count in info bar (default: true).
   * @deprecated Use {@link PinnedRowsConfig.slots} with the exported `selectedCountPanel()` render function.
   */
  showSelectedCount?: boolean;
  /**
   * Show filtered row count when filter is active (default: true).
   * @deprecated Use {@link PinnedRowsConfig.slots} with the exported `filteredCountPanel()` render function.
   */
  showFilteredCount?: boolean;
  /**
   * Custom panels to display in the info bar.
   * @deprecated Use {@link PinnedRowsConfig.slots} with `PanelSlot` entries.
   */
  customPanels?: PinnedRowsPanel[];
  /**
   * Aggregation rows (footer/header rows with computed values).
   * @deprecated Use {@link PinnedRowsConfig.slots} with `AggregationSlot` entries (any slot
   * without a `render` field is treated as an aggregation slot).
   */
  aggregationRows?: AggregationRowConfig[];
  /**
   * Default fullWidth mode for all aggregation rows.
   * When true, each aggregation row renders as a single spanning cell with label and
   * aggregated values inline. When false (default), rows render per-column cells aligned
   * to the grid template. Individual `AggregationRowConfig.fullWidth` (or `AggregationSlot.fullWidth`)
   * overrides this.
   * @default false
   */
  fullWidth?: boolean;
}

/**
 * A unified pinned-row slot. Discriminated by the presence of `render`:
 * - With `render`  ⇒ {@link PanelSlot} (a status-panel row)
 * - Without `render` ⇒ {@link AggregationSlot} (an aggregation row)
 *
 * Each slot occupies one DOM row inside its `position` area, in declared order.
 * @since 2.6.0
 */
export type PinnedRowSlot = PanelSlot | AggregationSlot;

/** Horizontal zone within a panel slot row. * @since 2.6.0
 */
export type PanelZone = 'left' | 'center' | 'right';

/**
 * Render function for a panel slot.
 * Return `null` to skip rendering (used by the built-in count panels for
 * conditional display, e.g. only show "Selected: N" when N > 0).
 * @since 2.6.0
 */
export type PanelRender = (context: PinnedRowsContext) => HTMLElement | null;

/** Render function plus optional zone within the panel row. * @since 2.6.0
 */
export interface ZonedPanelRender {
  /** Horizontal zone within the row (default: 'left') */
  zone?: PanelZone;
  /** Render function */
  render: PanelRender;
}

/** A status-panel slot. Each slot becomes its own `.tbw-pinned-rows` row. * @since 2.6.0
 */
export interface PanelSlot {
  /** Optional identifier for diffing/targeted updates */
  id?: string;
  /** Position relative to the grid body (default: 'bottom') */
  position?: PinnedRowsPosition;
  /**
   * Render function (or array of zoned render functions).
   * - Single `PanelRender` ⇒ rendered into the `'left'` zone.
   * - Array of `ZonedPanelRender` ⇒ each entry rendered into its declared zone.
   */
  render: PanelRender | ZonedPanelRender[];
}

/**
 * An aggregation slot (row of computed values). Equivalent to {@link AggregationRowConfig}
 * but lives in the unified `slots[]` ordering.
 * @since 2.6.0
 */
export type AggregationSlot = AggregationRowConfig;

/**
 * Custom panel definition for the legacy info bar.
 * @deprecated Use {@link PinnedRowSlot} via {@link PinnedRowsConfig.slots}.
 * @since 0.1.1
 */
export interface PinnedRowsPanel {
  /** Unique identifier for the panel */
  id: string;
  /** Position within the status bar */
  position: PanelZone;
  /** Render function for the panel content */
  render: (context: PinnedRowsContext) => HTMLElement | string;
}

/** Context provided to panel renderers * @since 0.1.1
 */
export interface PinnedRowsContext {
  /** Total number of rows in the grid */
  totalRows: number;
  /** Number of rows after filtering */
  filteredRows: number;
  /** Number of selected rows */
  selectedRows: number;
  /** Current column configuration */
  columns: ColumnConfig[];
  /** Current row data */
  rows: unknown[];
  /** Reference to the grid element */
  grid: HTMLElement;
}

/** Internal state managed by the status bar plugin */
export interface PinnedRowsState {
  /** The info bar DOM element */
  infoBarElement: HTMLElement | null;
  /** Top aggregation rows container */
  topAggregationContainer: HTMLElement | null;
  /** Bottom aggregation rows container */
  bottomAggregationContainer: HTMLElement | null;
  /** Footer wrapper for sticky bottom elements */
  footerWrapper: HTMLElement | null;
}

// Module Augmentation - Register plugin name for type-safe getPluginByName()
declare module '../../core/types' {
  interface PluginNameMap {
    pinnedRows: import('./PinnedRowsPlugin').PinnedRowsPlugin;
  }
}
