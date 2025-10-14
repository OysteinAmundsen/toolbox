/**
 * Column Visibility Plugin Types
 *
 * Type definitions for the column visibility feature.
 */

/** Configuration options for the visibility plugin */
export interface VisibilityConfig {
  /** Whether visibility control is enabled (default: true) */
  enabled?: boolean;
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
