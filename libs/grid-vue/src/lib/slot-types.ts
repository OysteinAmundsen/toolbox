import type { ColumnConfig } from '@toolbox-web/grid';

/**
 * Slot context for #cell slot in TbwGridColumn.
 *
 * @example
 * ```vue
 * <TbwGridColumn field="status">
 *   <template #cell="{ value, row }">
 *     <StatusBadge :value="value" :row="row" />
 *   </template>
 * </TbwGridColumn>
 * ```
 */
export interface CellSlotProps<TRow = unknown, TValue = unknown> {
  /** The cell value */
  value: TValue;
  /** The entire row data */
  row: TRow;
  /** The column configuration */
  column: ColumnConfig<TRow>;
}

/**
 * Slot context for #editor slot in TbwGridColumn.
 *
 * @example
 * ```vue
 * <TbwGridColumn field="name" editable>
 *   <template #editor="{ value, commit, cancel }">
 *     <input
 *       :value="value"
 *       @blur="commit($event.target.value)"
 *       @keydown.escape="cancel()"
 *     />
 *   </template>
 * </TbwGridColumn>
 * ```
 */
export interface EditorSlotProps<TRow = unknown, TValue = unknown> {
  /** The current cell value */
  value: TValue;
  /** The entire row data */
  row: TRow;
  /** The column configuration */
  column: ColumnConfig<TRow>;
  /** Field name being edited */
  field: string;
  /** Stable row identifier (from `getRowId`). Empty string if no `getRowId` is configured. */
  rowId: string;
  /** Commit the edit with new value */
  commit: (newValue: TValue) => void;
  /** Cancel the edit */
  cancel: () => void;
  /**
   * Update other fields in this row while the editor is open.
   * Changes trigger `cell-change` events with source `'cascade'`.
   */
  updateRow: (changes: Partial<TRow>) => void;
  /**
   * Register a callback to receive value updates when the cell is modified
   * externally (e.g., via `updateRow()` from another cell's commit).
   */
  onValueChange?: (callback: (newValue: TValue) => void) => void;
}
