/**
 * Column Reordering Plugin Types
 *
 * Type definitions for the column reordering feature.
 */

/** Animation type for column reordering */
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
    reorder: import('./ReorderPlugin').ReorderPlugin;
  }
}
