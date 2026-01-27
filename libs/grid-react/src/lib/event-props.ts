/**
 * Event handler prop types for declarative event handling.
 *
 * These types allow developers to handle grid events via props instead of
 * manually managing addEventListener/removeEventListener.
 *
 * The pattern is: `(detail: T, event?: CustomEvent) => void`
 * - `detail` is the unwrapped event detail (React-idiomatic)
 * - `event` is the optional full CustomEvent (for preventDefault())
 *
 * @example
 * ```tsx
 * <DataGrid
 *   onCellClick={(detail) => console.log('Clicked:', detail.field)}
 *   onSelectionChange={(detail) => setSelected(detail.ranges)}
 *   onColumnMove={(detail, event) => {
 *     if (!allowMove) event?.preventDefault();
 *   }}
 * />
 * ```
 */

// Import event detail types from core grid and plugins via the all bundle
import type {
  CellActivateDetail,
  CellChangeDetail,
  CellClickDetail,
  CellCommitDetail,
  ColumnMoveDetail,
  ColumnResizeDetail,
  ColumnVisibilityDetail,
  CopyDetail,
  DetailExpandDetail,
  ExportCompleteDetail,
  FilterChangeDetail,
  GridColumnState,
  GroupToggleDetail,
  PasteDetail,
  PrintCompleteDetail,
  PrintStartDetail,
  ResponsiveChangeDetail,
  RowClickDetail,
  RowCommitDetail,
  RowMoveDetail,
  SelectionChangeDetail,
  SortChangeDetail,
  TreeExpandDetail,
  UndoRedoDetail,
} from '@toolbox-web/grid/all';

/**
 * Event handler type with unwrapped detail.
 * Pattern: `(detail: T, event?: CustomEvent) => void`
 */
export type EventHandler<T> = (detail: T, event?: CustomEvent<T>) => void;

/**
 * Event handler props for grid events.
 * All handlers receive the unwrapped detail as first argument,
 * with optional access to the full CustomEvent for preventDefault().
 *
 * @template TRow - The row data type
 */
export interface EventProps<TRow = unknown> {
  // ═══════════════════════════════════════════════════════════════════
  // CORE CELL/ROW EVENTS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Fired when a cell is clicked.
   *
   * @example
   * ```tsx
   * onCellClick={(detail) => console.log('Clicked:', detail.field, detail.value)}
   * ```
   */
  onCellClick?: EventHandler<CellClickDetail<TRow>>;

  /**
   * Fired when a row is clicked.
   *
   * @example
   * ```tsx
   * onRowClick={(detail) => navigateTo(`/employees/${detail.row.id}`)}
   * ```
   */
  onRowClick?: EventHandler<RowClickDetail<TRow>>;

  /**
   * Fired when a cell is activated (Enter key or double-click).
   *
   * @example
   * ```tsx
   * onCellActivate={(detail) => openEditor(detail.field, detail.row)}
   * ```
   */
  onCellActivate?: EventHandler<CellActivateDetail<TRow>>;

  /**
   * Fired when a cell value changes (before commit).
   *
   * @example
   * ```tsx
   * onCellChange={(detail) => validateChange(detail)}
   * ```
   */
  onCellChange?: EventHandler<CellChangeDetail<TRow>>;

  // ═══════════════════════════════════════════════════════════════════
  // EDITING EVENTS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Fired when a cell edit is committed.
   * Cancelable - call `event.preventDefault()` to reject the edit.
   *
   * @example
   * ```tsx
   * onCellCommit={(detail, event) => {
   *   if (!isValid(detail.value)) {
   *     event?.preventDefault();
   *     showError('Invalid value');
   *   }
   * }}
   * ```
   */
  onCellCommit?: EventHandler<CellCommitDetail<TRow>>;

  /**
   * Fired when all pending row edits are committed.
   *
   * @example
   * ```tsx
   * onRowCommit={(detail) => saveToServer(detail.row)}
   * ```
   */
  onRowCommit?: EventHandler<RowCommitDetail<TRow>>;

  // ═══════════════════════════════════════════════════════════════════
  // SORTING & FILTERING EVENTS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Fired when sort state changes.
   *
   * @example
   * ```tsx
   * onSortChange={(detail) => console.log('Sort:', detail.field, detail.direction)}
   * ```
   */
  onSortChange?: EventHandler<SortChangeDetail>;

  /**
   * Fired when filter values change.
   *
   * @example
   * ```tsx
   * onFilterChange={(detail) => console.log('Filters:', detail.activeFilters)}
   * ```
   */
  onFilterChange?: EventHandler<FilterChangeDetail>;

  // ═══════════════════════════════════════════════════════════════════
  // COLUMN EVENTS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Fired when a column is resized.
   *
   * @example
   * ```tsx
   * onColumnResize={(detail) => console.log('Resized:', detail.field, detail.width)}
   * ```
   */
  onColumnResize?: EventHandler<ColumnResizeDetail>;

  /**
   * Fired when a column is moved via drag-and-drop.
   * Cancelable - call `event.preventDefault()` to cancel the move.
   *
   * @example
   * ```tsx
   * onColumnMove={(detail, event) => {
   *   if (detail.column.field === 'id') {
   *     event?.preventDefault(); // Don't allow moving ID column
   *   }
   * }}
   * ```
   */
  onColumnMove?: EventHandler<ColumnMoveDetail>;

  /**
   * Fired when column visibility changes.
   *
   * @example
   * ```tsx
   * onColumnVisibility={(detail) => {
   *   console.log(detail.hidden ? 'Hidden:' : 'Shown:', detail.field);
   * }}
   * ```
   */
  onColumnVisibility?: EventHandler<ColumnVisibilityDetail>;

  /**
   * Fired when column state changes (resize, reorder, visibility).
   * Useful for persisting column state.
   *
   * @example
   * ```tsx
   * onColumnStateChange={(state) => saveToLocalStorage('gridState', state)}
   * ```
   */
  onColumnStateChange?: EventHandler<GridColumnState>;

  // ═══════════════════════════════════════════════════════════════════
  // SELECTION EVENTS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Fired when selection changes.
   *
   * @example
   * ```tsx
   * onSelectionChange={(detail) => {
   *   console.log('Selected ranges:', detail.ranges);
   *   console.log('Mode:', detail.mode);
   * }}
   * ```
   */
  onSelectionChange?: EventHandler<SelectionChangeDetail>;

  // ═══════════════════════════════════════════════════════════════════
  // ROW EVENTS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Fired when a row is moved via drag-and-drop.
   * Cancelable - call `event.preventDefault()` to cancel the move.
   *
   * @example
   * ```tsx
   * onRowMove={(detail, event) => {
   *   if (!canMove(detail.row)) {
   *     event?.preventDefault();
   *   }
   * }}
   * ```
   */
  onRowMove?: EventHandler<RowMoveDetail<TRow>>;

  // ═══════════════════════════════════════════════════════════════════
  // GROUPING EVENTS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Fired when a group is expanded or collapsed.
   *
   * @example
   * ```tsx
   * onGroupToggle={(detail) => {
   *   console.log(detail.expanded ? 'Expanded' : 'Collapsed', detail.key);
   * }}
   * ```
   */
  onGroupToggle?: EventHandler<GroupToggleDetail>;

  // ═══════════════════════════════════════════════════════════════════
  // TREE EVENTS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Fired when a tree node is expanded.
   *
   * @example
   * ```tsx
   * onTreeExpand={(detail) => console.log('Expanded:', detail.row)}
   * ```
   */
  onTreeExpand?: EventHandler<TreeExpandDetail<TRow>>;

  // ═══════════════════════════════════════════════════════════════════
  // MASTER-DETAIL EVENTS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Fired when a detail panel is expanded or collapsed.
   *
   * @example
   * ```tsx
   * onDetailExpand={(detail) => {
   *   if (detail.expanded) loadDetailData(detail.rowId);
   * }}
   * ```
   */
  onDetailExpand?: EventHandler<DetailExpandDetail>;

  // ═══════════════════════════════════════════════════════════════════
  // RESPONSIVE EVENTS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Fired when responsive mode changes (table ↔ card).
   *
   * @example
   * ```tsx
   * onResponsiveChange={(detail) => {
   *   console.log('Mode:', detail.mode); // 'table' | 'card'
   * }}
   * ```
   */
  onResponsiveChange?: EventHandler<ResponsiveChangeDetail>;

  // ═══════════════════════════════════════════════════════════════════
  // CLIPBOARD EVENTS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Fired when cells are copied to clipboard.
   *
   * @example
   * ```tsx
   * onCopy={(detail) => console.log('Copied:', detail.text)}
   * ```
   */
  onCopy?: EventHandler<CopyDetail>;

  /**
   * Fired when cells are pasted from clipboard.
   *
   * @example
   * ```tsx
   * onPaste={(detail) => console.log('Pasted:', detail.affectedCells.length, 'cells')}
   * ```
   */
  onPaste?: EventHandler<PasteDetail>;

  // ═══════════════════════════════════════════════════════════════════
  // UNDO/REDO EVENTS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Fired when undo/redo is performed.
   *
   * @example
   * ```tsx
   * onUndoRedo={(detail) => console.log(detail.type, '- Can undo:', detail.canUndo)}
   * ```
   */
  onUndoRedo?: EventHandler<UndoRedoDetail>;

  // ═══════════════════════════════════════════════════════════════════
  // EXPORT EVENTS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Fired when export completes.
   *
   * @example
   * ```tsx
   * onExportComplete={(detail) => console.log('Exported:', detail.filename)}
   * ```
   */
  onExportComplete?: EventHandler<ExportCompleteDetail>;

  // ═══════════════════════════════════════════════════════════════════
  // PRINT EVENTS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Fired when print starts.
   *
   * @example
   * ```tsx
   * onPrintStart={(detail) => console.log('Printing:', detail.rowCount, 'rows')}
   * ```
   */
  onPrintStart?: EventHandler<PrintStartDetail>;

  /**
   * Fired when print completes.
   *
   * @example
   * ```tsx
   * onPrintComplete={() => console.log('Print complete')}
   * ```
   */
  onPrintComplete?: EventHandler<PrintCompleteDetail>;
}

/**
 * Map of event handler prop names to their corresponding event names.
 * Used internally to wire up event listeners.
 */
export const EVENT_PROP_MAP: Record<keyof EventProps, string> = {
  onCellClick: 'cell-click',
  onRowClick: 'row-click',
  onCellActivate: 'cell-activate',
  onCellChange: 'cell-change',
  onCellCommit: 'cell-commit',
  onRowCommit: 'row-commit',
  onSortChange: 'sort-change',
  onFilterChange: 'filter-change',
  onColumnResize: 'column-resize',
  onColumnMove: 'column-move',
  onColumnVisibility: 'column-visibility',
  onColumnStateChange: 'column-state-change',
  onSelectionChange: 'selection-change',
  onRowMove: 'row-move',
  onGroupToggle: 'group-toggle',
  onTreeExpand: 'tree-expand',
  onDetailExpand: 'detail-expand',
  onResponsiveChange: 'responsive-change',
  onCopy: 'copy',
  onPaste: 'paste',
  onUndoRedo: 'undo-redo',
  onExportComplete: 'export-complete',
  onPrintStart: 'print-start',
  onPrintComplete: 'print-complete',
};

/**
 * Gets all event prop names.
 */
export function getEventPropNames(): (keyof EventProps)[] {
  return Object.keys(EVENT_PROP_MAP) as (keyof EventProps)[];
}
