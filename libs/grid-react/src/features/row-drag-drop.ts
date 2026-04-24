/**
 * Row Drag & Drop feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `rowDragDrop` prop on DataGrid and the
 * associated event handlers (`onRowDragStart`, `onRowDragEnd`, `onRowDrop`,
 * `onRowTransfer`). Supports both intra-grid reorder and cross-grid transfer.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/row-drag-drop';
 *
 * <DataGrid rowDragDrop={{ dropZone: 'employees' }} />
 * ```
 *
 * @packageDocumentation
 */

// Delegate to core feature registration
import '@toolbox-web/grid/features/row-drag-drop';
