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
  /** Commit the new value and close editor */
  commit: (newValue: TValue) => void;
  /** Cancel editing without saving */
  cancel: () => void;
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
