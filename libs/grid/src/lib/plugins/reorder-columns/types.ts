/**
 * Column Reordering Plugin Types
 *
 * Type definitions for the column reordering feature.
 */

/**
 * Animation strategy used when a column is drag-reordered.
 *
 * - `false` — No animation; columns snap instantly to their new positions.
 * - `'flip'` — FLIP technique (First-Last-Invert-Play): captures column positions before
 *   and after the move, then smoothly slides them into place. Controlled by `animationDuration`.
 * - `'fade'` — Uses the View Transitions API for a cross-fade effect. Duration is
 *   browser-controlled; `animationDuration` has no effect. Falls back to instant
 *   reorder in browsers without View Transitions support.
 *
 * @default 'flip'
 * @since 1.24.0
 */
export type ReorderAnimation = false | 'flip' | 'fade';

/** Configuration options for the reorder plugin * @since 1.24.0
 */
export interface ReorderConfig {
  /**
   * Animation type for column movement.
   * - `false`: No animation, instant reorder
   * - `'flip'`: FLIP animation (slides columns smoothly)
   * - `'fade'`: View Transitions API (cross-fade effect)
   * @default 'flip'
   */
  animation?: ReorderAnimation;

  /**
   * Animation duration in milliseconds.
   * Applies to FLIP animation. View Transitions use browser defaults.
   * @default 200
   */
  animationDuration?: number;
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

/** Event detail emitted when a column is moved * @since 1.24.0
 */
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

// Module Augmentation - Register plugin name for type-safe getPluginByName()
declare module '../../core/types' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- TRow/TValue must match the original BaseColumnConfig<TRow, TValue> declaration for module augmentation to merge (TS2428).
  interface BaseColumnConfig<TRow, TValue> {
    /**
     * Prevent this column from being reordered by the user. When `true`, the column
     * cannot be dragged in the header row or rearranged via the visibility panel.
     * Programmatic reordering (e.g. `setColumnOrder()`) is not affected.
     *
     * Requires ReorderPlugin (or VisibilityPlugin for the panel-drag case).
     *
     * @default false
     */
    lockPosition?: boolean;
  }

  interface DataGridEventMap {
    /** Fired when a column is reordered via drag-and-drop (cancelable). Call `preventDefault()` to reject the move. @group Column Reorder Events */
    'column-move': ColumnMoveDetail;
  }

  interface PluginNameMap {
    /** Primary name for the column reorder plugin */
    reorderColumns: import('./ReorderPlugin').ReorderPlugin;
  }
}
