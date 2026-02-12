/**
 * Column Visibility Plugin Types
 *
 * Type definitions for the column visibility feature.
 */

/** Configuration options for the visibility plugin */
export interface VisibilityConfig {
  /** Allow hiding all columns (default: false) */
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

/** Event detail emitted when column visibility changes */
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
