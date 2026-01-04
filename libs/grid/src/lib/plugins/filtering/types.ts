/**
 * Filtering Plugin Types
 *
 * Type definitions for the filtering feature.
 */

import type { ColumnConfig } from '../../core/types';

// #region Module Augmentation
// When this plugin is imported, ColumnConfig is augmented with filtering-specific properties
declare module '../../core/types' {
  interface BaseColumnConfig {
    /**
     * Whether this column can be filtered (only applicable when FilteringPlugin is enabled).
     * @default true
     */
    filterable?: boolean;
  }

  // Extend ColumnState to include filter state for persistence
  interface ColumnState {
    /**
     * Filter state for this column (only present when FilteringPlugin is used).
     * Stores the essential filter properties without the redundant 'field'.
     */
    filter?: {
      type: 'text' | 'number' | 'date' | 'set' | 'boolean';
      operator: string;
      value: unknown;
      valueTo?: unknown;
    };
  }
}
// #endregion

/** Supported filter types */
export type FilterType = 'text' | 'number' | 'date' | 'set' | 'boolean';

/** Filter operators for different filter types */
export type FilterOperator =
  // Text operators
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEquals'
  | 'startsWith'
  | 'endsWith'
  | 'blank'
  | 'notBlank'
  // Number/Date operators
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'between'
  // Set operators
  | 'in'
  | 'notIn';

/** Filter model representing a single filter condition */
export interface FilterModel {
  /** The field/column to filter on */
  field: string;
  /** The type of filter */
  type: FilterType;
  /** The filter operator */
  operator: FilterOperator;
  /** The filter value (type depends on operator) */
  value: unknown;
  /** Secondary value for 'between' operator */
  valueTo?: unknown;
}

/** Parameters passed to custom filter panel renderer */
export interface FilterPanelParams {
  /** The field being filtered */
  field: string;
  /** The column configuration */
  column: ColumnConfig;
  /** All unique values for this field */
  uniqueValues: unknown[];
  /** Currently excluded values (for set filter) */
  excludedValues: Set<unknown>;
  /** Current search text */
  searchText: string;
  /** Apply a set filter (exclude these values) */
  applySetFilter: (excludedValues: unknown[]) => void;
  /** Apply a text filter */
  applyTextFilter: (operator: FilterOperator, value: string, valueTo?: string) => void;
  /** Clear the filter for this field */
  clearFilter: () => void;
  /** Close the filter panel */
  closePanel: () => void;
}

/** Custom filter panel renderer function. Return undefined to use default panel for this column. */
export type FilterPanelRenderer = (container: HTMLElement, params: FilterPanelParams) => void | undefined;

/**
 * Async handler for fetching unique filter values from a server.
 *
 * For server-side datasets where not all values are available locally,
 * this handler is called when the filter panel opens to fetch all
 * possible values for the column.
 *
 * @param field - The field/column name
 * @param column - The column configuration
 * @returns Promise resolving to array of unique values
 *
 * @example
 * ```ts
 * valuesHandler: async (field, column) => {
 *   const response = await fetch(`/api/distinct/${field}`);
 *   return response.json(); // ['Engineering', 'Marketing', 'Sales', ...]
 * }
 * ```
 */
export type FilterValuesHandler = (field: string, column: ColumnConfig) => Promise<unknown[]>;

/**
 * Async handler for applying filters on a server.
 *
 * For server-side filtering, this handler is called when filters change.
 * It should fetch filtered data from the server and return the new rows.
 * The plugin will replace the grid's rows with the returned data.
 *
 * @param filters - Current active filter models
 * @param currentRows - Current row array (for reference/optimistic updates)
 * @returns Promise resolving to filtered rows
 *
 * @example
 * ```ts
 * filterHandler: async (filters) => {
 *   const params = new URLSearchParams();
 *   filters.forEach(f => params.append(f.field, `${f.operator}:${f.value}`));
 *   const response = await fetch(`/api/data?${params}`);
 *   return response.json();
 * }
 * ```
 */
export type FilterHandler<TRow = unknown> = (filters: FilterModel[], currentRows: TRow[]) => TRow[] | Promise<TRow[]>;

/** Configuration options for the filtering plugin */
export interface FilterConfig<TRow = unknown> {
  /** Debounce delay in ms for filter input (default: 300) */
  debounceMs?: number;
  /** Whether text filtering is case sensitive (default: false) */
  caseSensitive?: boolean;
  /** Whether to trim whitespace from filter input (default: true) */
  trimInput?: boolean;
  /** Use Web Worker for filtering large datasets >1000 rows (default: true) */
  useWorker?: boolean;
  /** Custom filter panel renderer (replaces default panel content) */
  filterPanelRenderer?: FilterPanelRenderer;

  /**
   * Async handler for fetching unique values from a server.
   * When provided, this is called instead of extracting values from local rows.
   * Useful for server-side datasets where not all data is loaded.
   */
  valuesHandler?: FilterValuesHandler;

  /**
   * Async handler for applying filters on a server.
   * When provided, filtering is delegated to the server instead of local filtering.
   * Should return the filtered rows from the server.
   *
   * Note: When using filterHandler, processRows() becomes a passthrough
   * and the returned rows replace the grid's data.
   */
  filterHandler?: FilterHandler<TRow>;
}

/** Internal state managed by the filtering plugin */
export interface FilterState {
  /** Map of field name to filter model */
  filters: Map<string, FilterModel>;
  /** Cached filtered result for performance */
  cachedResult: unknown[] | null;
  /** Cache key for invalidation */
  cacheKey: string | null;
  /** Currently open filter panel field (null if none open) */
  openPanelField: string | null;
  /** Reference to the open filter panel element */
  panelElement: HTMLElement | null;
  /** Current search text per field */
  searchText: Map<string, string>;
  /** Set of excluded values per field (for set filter) */
  excludedValues: Map<string, Set<unknown>>;
}

/** Event detail emitted when filters change */
export interface FilterChangeDetail {
  /** Current active filters */
  filters: FilterModel[];
  /** Number of rows after filtering */
  filteredRowCount: number;
}
