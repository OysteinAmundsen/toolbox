/**
 * Filtering Plugin Types
 *
 * Type definitions for the filtering feature.
 */

import type { ColumnConfig } from '../../core/types';

// ===== Module Augmentation =====
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

/** Configuration options for the filtering plugin */
export interface FilterConfig {
  /** Whether filtering is enabled (default: true) */
  enabled?: boolean;
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
