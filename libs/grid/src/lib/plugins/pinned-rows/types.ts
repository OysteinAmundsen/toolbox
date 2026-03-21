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

/** Full aggregator config with optional formatter */
export interface AggregatorConfig {
  /** The aggregator function or built-in key ('sum', 'avg', 'min', 'max', 'count', 'first', 'last') */
  aggFunc: AggregatorRef;
  /** Optional formatter to format the computed value for display */
  formatter?: AggregatorFormatter;
}

/** Aggregator definition - simple string/function or full config object */
export type AggregatorDefinition = AggregatorRef | AggregatorConfig;

/**
 * Configuration for an aggregation row (footer/header row with computed values).
 * Replaces the core FooterRowConfig functionality.
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

/** Configuration options for the status bar plugin */
export interface PinnedRowsConfig {
  /** Position of the info bar (default: 'bottom') */
  position?: PinnedRowsPosition;
  /** Show total row count in info bar (default: true) */
  showRowCount?: boolean;
  /** Show selected row count in info bar (default: true) */
  showSelectedCount?: boolean;
  /** Show filtered row count when filter is active (default: true) */
  showFilteredCount?: boolean;
  /** Custom panels to display in the info bar */
  customPanels?: PinnedRowsPanel[];
  /** Aggregation rows (footer/header rows with computed values) */
  aggregationRows?: AggregationRowConfig[];
  /**
   * Default fullWidth mode for all aggregation rows.
   * When true, each aggregation row renders as a single spanning cell with label and
   * aggregated values inline. When false (default), rows render per-column cells aligned
   * to the grid template. Individual `AggregationRowConfig.fullWidth` overrides this.
   * @default false
   */
  fullWidth?: boolean;
}

/** Custom panel definition for the status bar */
export interface PinnedRowsPanel {
  /** Unique identifier for the panel */
  id: string;
  /** Position within the status bar */
  position: 'left' | 'center' | 'right';
  /** Render function for the panel content */
  render: (context: PinnedRowsContext) => HTMLElement | string;
}

/** Context provided to panel renderers */
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
