/**
 * Column Visibility Plugin Types
 *
 * Type definitions for the column visibility feature.
 */

/**
 * Configuration for the column visibility plugin.
 *
 * Controls the visibility sidebar panel that lets users show/hide individual columns.
 * The sidebar is toggled via a button in the grid toolbar or programmatically.
 *
 * @example
 * ```typescript
 * new VisibilityPlugin({ allowHideAll: false })
 * ```
 * @since 0.1.1
 */
export interface VisibilityConfig {
  /**
   * Whether users are allowed to hide every column.
   * When `false`, the last visible column's toggle is disabled to prevent an empty grid.
   * @default false
   */
  allowHideAll?: boolean;
}

/** Internal state managed by the visibility plugin */
export interface VisibilityState {
  /** Set of field names for currently hidden columns */
  hiddenColumns: Set<string>;
  /** Whether the sidebar is currently open */
  isOpen: boolean;
  /** Reference to the sidebar element */
  sidebar: HTMLElement | null;
  /** Reference to the toggle button element */
  toggleBtn: HTMLElement | null;
  /** Reference to the column list container */
  columnList: HTMLElement | null;
}

/** Event detail emitted when column visibility changes * @since 0.1.1
 */
export interface ColumnVisibilityDetail {
  /** The field that changed visibility (undefined for bulk operations) */
  field?: string;
  /** Whether the column is now visible (undefined for bulk operations) */
  visible?: boolean;
  /** List of all currently visible column fields */
  visibleColumns: string[];
}

/**
 * Column grouping info returned by the `getColumnGrouping` plugin query.
 * Plugins like GroupingColumnsPlugin respond with this to describe
 * how columns are organized into groups for the visibility panel.
 *
 * **Important:** This type describes group *membership* — which fields belong
 * to which group. For authoritative display order, use `grid.getAllColumns()`
 * or `grid.getColumnOrder()` from the ConfigManager, which reflects the
 * current column positions after any reordering.
 * @since 1.15.0
 */
export interface ColumnGroupInfo {
  /** Unique group identifier */
  id: string;
  /** Display label for the group */
  label: string;
  /**
   * Column field names belonging to this group.
   *
   * The order of fields is best-effort (sorted by current display order when
   * available), but consumers should **not** rely on it for rendering.
   * Use `grid.getAllColumns()` for authoritative display order and filter
   * by group membership using this array.
   */
  fields: string[];
}

/**
 * Detail for `column-reorder-request` events emitted when users drag-drop
 * columns in the visibility sidebar panel.
 *
 * This event is consumed by `ReorderPlugin` to actually perform the column
 * move; if `ReorderPlugin` is not loaded, the event is informational only.
 * @since 2.6.0
 */
export interface ColumnReorderRequestDetail {
  /** The field name of the column to move. */
  field: string;
  /** The source index in the column order (before the move). */
  fromIndex: number;
  /** The target index in the column order (after the move). */
  toIndex: number;
}

// Module Augmentation - Register events and plugin name for type-safe lookups.
declare module '../../core/types' {
  interface DataGridEventMap {
    /**
     * Fired when the user drag-reorders columns in the visibility sidebar panel.
     * Consumed by `ReorderPlugin` to perform the actual column move.
     * @group Visibility Events
     */
    'column-reorder-request': ColumnReorderRequestDetail;

    /**
     * Fired when a column is shown or hidden — either via the visibility
     * sidebar, `grid.toggleColumnVisibility(field)`, `grid.setColumnVisible(field, visible)`,
     * or `grid.showAllColumns()`. The `field` and `visible` properties are
     * present for single-column toggles and undefined for bulk operations
     * (`showAllColumns`); `visibleColumns` always lists the current set.
     * @group Visibility Events
     */
    'column-visibility': ColumnVisibilityDetail;
  }

  interface PluginNameMap {
    visibility: import('./VisibilityPlugin').VisibilityPlugin;
  }
}
