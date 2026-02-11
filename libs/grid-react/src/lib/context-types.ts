import type { ColumnConfig } from '@toolbox-web/grid';

/**
 * Context object passed to cell renderer components.
 */
export interface GridCellContext<TValue = unknown, TRow = unknown> {
  /** The cell value for this column */
  value: TValue;
  /** The full row data object */
  row: TRow;
  /** The column configuration */
  column: ColumnConfig<TRow>;
  /** Field key */
  field: keyof TRow & string;
}

/**
 * Context object passed to cell editor components.
 */
export interface GridEditorContext<TValue = unknown, TRow = unknown> {
  /** The cell value for this column */
  value: TValue;
  /** The full row data object */
  row: TRow;
  /** The column configuration */
  column: ColumnConfig<TRow>;
  /** Field key */
  field: keyof TRow & string;
  /** Stable row identifier (from `getRowId`). Empty string if no `getRowId` is configured. */
  rowId: string;
  /** Commit the new value and close editor */
  commit: (newValue: TValue) => void;
  /** Cancel editing without saving */
  cancel: () => void;
  /**
   * Update other fields in this row while the editor is open.
   * Changes trigger `cell-change` events with source `'cascade'`.
   */
  updateRow: (changes: Partial<TRow>) => void;
  /**
   * Register a callback to receive value updates when the cell is modified
   * externally (e.g., via `updateRow()` from another cell's commit).
   *
   * React editors receive the full context at render time; use this to
   * update local state when another cell cascades a change.
   */
  onValueChange?: (callback: (newValue: TValue) => void) => void;
}

/**
 * Context object passed to detail panel components.
 */
export interface GridDetailContext<TRow = unknown> {
  /** The row data object */
  row: TRow;
  /** Row index */
  rowIndex: number;
}

/**
 * Context object passed to tool panel components.
 */
export interface GridToolPanelContext {
  /** Reference to the grid element */
  grid: HTMLElement;
}
