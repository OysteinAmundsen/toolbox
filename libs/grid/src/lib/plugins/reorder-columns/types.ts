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
 */
export type ReorderAnimation = false | 'flip' | 'fade';

/** Configuration options for the reorder plugin */
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

// Module Augmentation - Register plugin name for type-safe getPluginByName()
declare module '../../core/types' {
  interface PluginNameMap {
    /** Primary name for the column reorder plugin */
    reorderColumns: import('./ReorderPlugin').ReorderPlugin;
    /**
     * @deprecated Use `'reorderColumns'` instead. Will be removed in v2.0.
     */
    reorder: import('./ReorderPlugin').ReorderPlugin;
  }
}
