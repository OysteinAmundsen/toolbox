/**
 * Row Reordering Plugin (deprecated alias).
 *
 * `RowReorderPlugin` is now an alias for `RowDragDropPlugin`, which is
 * a strict superset: same intra-grid behaviour, plus opt-in cross-grid drag
 * via `dropZone`. Migration is mechanical:
 *
 * ```diff
 * - import { RowReorderPlugin } from '@toolbox-web/grid/plugins/reorder-rows';
 * + import { RowDragDropPlugin } from '@toolbox-web/grid/plugins/row-drag-drop';
 *
 * - new RowReorderPlugin(cfg);
 * + new RowDragDropPlugin(cfg);
 * ```
 *
 * The legacy `canMove` callback continues to work — it is mapped internally.
 *
 * @deprecated Use `RowDragDropPlugin` from `@toolbox-web/grid/plugins/row-drag-drop`.
 *             This module will be removed in V3.
 */
export { ROW_DRAG_HANDLE_FIELD, RowDragDropPlugin as RowReorderPlugin } from '../row-drag-drop/RowDragDropPlugin';
export type { RowMoveDetail } from '../row-drag-drop/types';
