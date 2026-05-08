/**
 * Multi-Sort Plugin Types
 *
 * Type definitions for the multi-column sorting feature.
 */

/**
 * Represents a single column's sort configuration within a multi-sort model.
 *
 * The **order** of `SortModel` entries in the array determines sort precedence:
 * the first entry is the primary sort, the second breaks ties in the primary, and so on.
 *
 * @example
 * ```typescript
 * // Primary: department ascending, secondary: salary descending
 * const sortModel: SortModel[] = [
 *   { field: 'department', direction: 'asc' },
 *   { field: 'salary', direction: 'desc' },
 * ];
 * ```
 * @since 0.1.1
 */
export interface SortModel {
  /** The column field key to sort by. Must match a `field` in the grid's column configuration. */
  field: string;
  /** Sort direction: `'asc'` for ascending (A→Z, 0→9), `'desc'` for descending (Z→A, 9→0). */
  direction: 'asc' | 'desc';
}

/**
 * Configuration options for the multi-sort plugin.
 *
 * Multi-sort allows users to sort by multiple columns simultaneously.
 * Users add sort columns by Shift+clicking column headers; the headers
 * display numbered badges (1, 2, 3…) indicating sort precedence.
 *
 * @example
 * ```typescript
 * new MultiSortPlugin({ maxSortColumns: 5, showSortIndex: true })
 * ```
 * @since 0.1.1
 */
export interface MultiSortConfig {
  /**
   * Maximum number of columns that can be sorted simultaneously.
   * Once the limit is reached, adding a new sort column replaces the oldest one.
   * @default 3
   */
  maxSortColumns?: number;
  /**
   * Whether to show numbered badges (1, 2, 3…) on sorted column headers
   * to indicate sort precedence. Disable for a cleaner look when precedence
   * is not important to the user.
   * @default true
   */
  showSortIndex?: boolean;
}

/** Internal state managed by the multi-sort plugin */
export interface MultiSortState {
  /** Current sort model - ordered list of sort columns */
  sortModel: SortModel[];
}

/** Event detail emitted by multi-sort's `sort-change` event. Replaces the core `SortChangeDetail` with the full sort model. * @since 1.25.0
 */
export interface MultiSortChangeDetail {
  /** The complete sort model — ordered list of sort columns by precedence. */
  sortModel: SortModel[];
}

// Module Augmentation - Register plugin name for type-safe getPluginByName()
declare module '../../core/types' {
  interface PluginNameMap {
    multiSort: import('./MultiSortPlugin').MultiSortPlugin;
  }
}
