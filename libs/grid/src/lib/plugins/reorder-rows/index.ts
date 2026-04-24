/**
 * Reorder Rows Plugin Entry Point (deprecated alias)
 *
 * Re-exports the deprecated `RowReorderPlugin` alias and its config type.
 * `ROW_DRAG_HANDLE_FIELD` and `RowMoveDetail` are intentionally NOT
 * re-exported here — they are exported from
 * `@toolbox-web/grid/plugins/row-drag-drop` to avoid the `all` barrel
 * double-exporting the same symbol.
 *
 * @module Plugins/Reorder Rows
 * @deprecated Use `@toolbox-web/grid/plugins/row-drag-drop` instead.
 */
export { RowReorderPlugin } from './RowReorderPlugin';
export type { RowReorderConfig } from './types';
