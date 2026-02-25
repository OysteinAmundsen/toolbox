/**
 * Multi-Sort Plugin Types
 *
 * Type definitions for the multi-column sorting feature.
 */

/** Represents a single column sort configuration */
export interface SortModel {
  /** The field key to sort by */
  field: string;
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/** Configuration options for the multi-sort plugin */
export interface MultiSortConfig {
  /** Maximum number of columns to sort by (default: 3) */
  maxSortColumns?: number;
  /** Whether to show sort order badges (1, 2, 3) on headers (default: true) */
  showSortIndex?: boolean;
}

/** Internal state managed by the multi-sort plugin */
export interface MultiSortState {
  /** Current sort model - ordered list of sort columns */
  sortModel: SortModel[];
}

// Module Augmentation - Register plugin name for type-safe getPluginByName()
declare module '../../core/types' {
  interface PluginNameMap {
    multiSort: import('./MultiSortPlugin').MultiSortPlugin;
  }
}
