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
 * @typeParam TRow - Row data shape. Defaults to `unknown` so users are
 *   prompted to specify their row type explicitly for type safety.
 * @typeParam TValue - Cell value type. Defaults to `any` because the value
 *   shape is per-column and awkward to narrow inside template expressions;
 *   specify it (e.g. `CellSlotProps<MyRow, string>`) when known.
 * @since 0.1.0
 */
export interface CellSlotProps<TRow = unknown, TValue = any> {
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
 * @typeParam TRow - Row data shape. Defaults to `unknown` so users are
 *   prompted to specify their row type explicitly for type safety.
 * @typeParam TValue - Cell value type. Defaults to `any` because the value
 *   shape is per-column and awkward to narrow inside template expressions.
 * @since 0.1.0
 */
export interface EditorSlotProps<TRow = unknown, TValue = any> {
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

/**
 * Context object passed to a cell renderer function.
 *
 * Re-export of {@link CellSlotProps} with the `<TValue, TRow>` generic order
 * used by `@toolbox-web/grid-react`'s `GridCellContext`. Provided so that
 * users typing render-prop-style helpers can share a single signature across
 * adapters (e.g. when migrating from React to Vue or vice versa). Inside Vue
 * SFCs prefer `CellSlotProps` directly — Vue's `defineSlots` already infers
 * the right shape from it.
 * @since 1.5.0
 */
export type GridCellContext<TValue = any, TRow = unknown> = CellSlotProps<TRow, TValue>;

/**
 * Context object passed to a cell editor function.
 *
 * Re-export of {@link EditorSlotProps} with the `<TValue, TRow>` generic order
 * used by `@toolbox-web/grid-react`'s `GridEditorContext`. Provided so that
 * users typing editor functions can share a single signature across adapters.
 * Inside Vue SFCs prefer `EditorSlotProps` directly — Vue's `defineSlots`
 * already infers the right shape from it.
 * @since 1.5.0
 */
export type GridEditorContext<TValue = any, TRow = unknown> = EditorSlotProps<TRow, TValue>;
