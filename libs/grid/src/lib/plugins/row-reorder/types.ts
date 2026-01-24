/**
 * Row Reordering Plugin Types
 *
 * Type definitions for the row reordering feature.
 */

/**
 * Configuration options for the RowReorderPlugin.
 */
export interface RowReorderConfig {
  /**
   * Enable keyboard shortcuts (Ctrl+Up/Down) for moving rows.
   * @default true
   */
  enableKeyboard?: boolean;

  /**
   * Show a drag handle column for drag-and-drop reordering.
   * @default true
   */
  showDragHandle?: boolean;

  /**
   * Position of the drag handle column.
   * @default 'left'
   */
  dragHandlePosition?: 'left' | 'right';

  /**
   * Width of the drag handle column in pixels.
   * @default 40
   */
  dragHandleWidth?: number;

  /**
   * Validation callback to determine if a row can be moved.
   * Return `false` to prevent the move.
   * @param row - The row being moved
   * @param fromIndex - Current index of the row
   * @param toIndex - Target index
   * @param direction - Direction of move ('up' | 'down')
   * @returns Whether the move is allowed
   */
  canMove?: <T>(row: T, fromIndex: number, toIndex: number, direction: 'up' | 'down') => boolean;

  /**
   * Debounce time in milliseconds for rapid keyboard moves.
   * Events are batched and emitted after this delay.
   * @default 300
   */
  debounceMs?: number;

  /**
   * Animation type for row movement.
   * - `false`: No animation, instant reorder
   * - `'flip'`: FLIP animation (slides rows smoothly)
   * @default 'flip'
   */
  animation?: false | 'flip';
}

/**
 * Event detail emitted when a row is moved.
 */
export interface RowMoveDetail<T = unknown> {
  /** The row that was moved */
  row: T;
  /** The original index of the row */
  fromIndex: number;
  /** The new index of the row */
  toIndex: number;
  /** The full rows array in new order */
  rows: T[];
  /** How the move was initiated */
  source: 'keyboard' | 'drag';
}

/**
 * Internal state for pending keyboard moves (for debouncing).
 */
export interface PendingMove {
  /** Original index when debounce started */
  originalIndex: number;
  /** Current pending index */
  currentIndex: number;
  /** The row being moved */
  row: unknown;
}
