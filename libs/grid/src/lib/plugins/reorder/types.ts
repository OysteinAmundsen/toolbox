/**
 * Column Reordering Plugin Types
 *
 * Type definitions for the column reordering feature.
 */

/** Configuration options for the reorder plugin */
export interface ReorderConfig {
  /** Use View Transitions API for smooth column movement (default: true) */
  viewTransition?: boolean;
}

/** Internal state managed by the reorder plugin */
export interface ReorderState {
  /** Whether a drag operation is in progress */
  isDragging: boolean;
  /** The field name of the currently dragged column */
  draggedField: string | null;
  /** The original index of the dragged column */
  draggedIndex: number | null;
  /** The target drop index */
  dropIndex: number | null;
  /** Field names in display order */
  columnOrder: string[];
}

/** Event detail emitted when a column is moved */
export interface ColumnMoveDetail {
  /** The field name of the moved column */
  field: string;
  /** The original index of the column */
  fromIndex: number;
  /** The new index of the column */
  toIndex: number;
  /** The complete column order after the move */
  columnOrder: string[];
}
