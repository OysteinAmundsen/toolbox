/**
 * Row Reordering Plugin Types (deprecated aliases).
 *
 * @deprecated Use the types in `@toolbox-web/grid/plugins/row-drag-drop`.
 */

import type { RowDragDropConfig } from '../row-drag-drop/types';

/**
 * Configuration for the deprecated `RowReorderPlugin` alias.
 *
 * Picks the intra-grid keys from `RowDragDropConfig`. The full set of
 * options (including cross-grid `dropZone`, `canDrop`, `serializeRow`, etc.)
 * is available on `RowDragDropConfig` directly.
 *
 * @deprecated Use `RowDragDropConfig` from `@toolbox-web/grid/plugins/row-drag-drop`.
 * @since 1.24.0
 */
export type RowReorderConfig<T = unknown> = Pick<
  RowDragDropConfig<T>,
  | 'enableKeyboard'
  | 'showDragHandle'
  | 'dragHandlePosition'
  | 'dragHandleWidth'
  | 'debounceMs'
  | 'animation'
  | 'canMove'
>;

export type { RowMoveDetail } from '../row-drag-drop/types';
