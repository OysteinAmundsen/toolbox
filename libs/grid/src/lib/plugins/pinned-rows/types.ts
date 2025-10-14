/**
 * Status Bar Plugin Types
 *
 * Type definitions for the status bar feature.
 * Includes both info bar functionality and aggregation row support.
 */

import type { ColumnConfig } from '../../core/types';

/** Position of the status bar relative to the grid */
export type PinnedRowsPosition = 'top' | 'bottom';

/** Aggregator reference - string key for built-in or custom function */
export type AggregatorRef = string | ((rows: unknown[], field: string, column?: ColumnConfig) => unknown);

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
  /** Label when in fullWidth mode */
  label?: string;
  /** Static or computed cell values keyed by field */
  cells?: Record<string, unknown | string | ((rows: unknown[], field: string, column?: ColumnConfig) => unknown)>;
  /** Per-field aggregator override; string maps to registered aggregator key */
  aggregators?: Record<string, AggregatorRef>;
}

/** Configuration options for the status bar plugin */
export interface PinnedRowsConfig {
  /** Whether the status bar is enabled (default: false) */
  enabled?: boolean;
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
