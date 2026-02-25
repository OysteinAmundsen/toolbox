/**
 * Editing Plugin Types
 *
 * Configuration and event types for the EditingPlugin.
 */

import type { ColumnEditorContext } from '../../core/types';

// ============================================================================
// Event Detail Types - Editing-specific events
// ============================================================================

/**
 * Event detail for cell value commit.
 *
 * Fired immediately when a cell value is committed. The event is cancelable -
 * call `preventDefault()` to reject the change.
 *
 * Use `setInvalid()` to mark the cell as invalid without canceling the commit.
 * Invalid cells can be styled via `cellClass` and will be highlighted.
 *
 * @category Events
 */
export interface CellCommitDetail<TRow = unknown> {
  /** The row object (not yet mutated if event is cancelable). */
  row: TRow;
  /** Stable row identifier (from getRowId). */
  rowId: string;
  /** Field name whose value changed. */
  field: string;
  /** Previous value before change. */
  oldValue: unknown;
  /** New value to be stored. */
  value: unknown;
  /** Index of the row in current data set. */
  rowIndex: number;
  /** All rows that have at least one committed change (snapshot list). */
  changedRows: TRow[];
  /** IDs of changed rows. */
  changedRowIds: string[];
  /** True if this row just entered the changed set. */
  firstTimeForRow: boolean;
  /**
   * Update other fields in this row.
   * Convenience wrapper for grid.updateRow(rowId, changes, 'cascade').
   * Useful for cascade updates (e.g., calculating totals).
   */
  updateRow: (changes: Partial<TRow>) => void;
  /**
   * Mark this cell as invalid with an optional validation message.
   * The cell remains editable but will be marked with `data-invalid` attribute.
   * Use `cellClass` to apply custom styling to invalid cells.
   *
   * Call with no message to mark as invalid, or pass a message for tooltips/display.
   * Call `clearInvalid()` on the plugin to remove the invalid state.
   *
   * @example
   * ```typescript
   * grid.addEventListener('cell-commit', (e) => {
   *   if (e.detail.field === 'email' && !isValidEmail(e.detail.value)) {
   *     e.detail.setInvalid('Please enter a valid email address');
   *   }
   * });
   * ```
   */
  setInvalid: (message?: string) => void;
}

/**
 * Detail payload for a committed row edit (may or may not include changes).
 *
 * Fired when a row editing session ends (focus leaves the row). The event is
 * cancelable - call `preventDefault()` to revert the entire row to its state
 * before editing began.
 *
 * Use this for row-level validation: if any cells are invalid, reject the
 * entire row edit and force the user to correct the values.
 *
 * @example
 * ```typescript
 * grid.addEventListener('row-commit', (e) => {
 *   const editingPlugin = grid.getPlugin(EditingPlugin);
 *   if (editingPlugin?.hasInvalidCells(e.detail.rowId)) {
 *     e.preventDefault(); // Revert row to original values
 *     alert('Please fix validation errors before leaving the row');
 *   }
 * });
 * ```
 *
 * @category Events
 */
export interface RowCommitDetail<TRow = unknown> {
  /** Row index that lost edit focus. */
  rowIndex: number;
  /** Stable row identifier (from getRowId). */
  rowId: string;
  /** Row object reference (current state after edits). */
  row: TRow;
  /** Snapshot of the row before edits (for comparison). */
  oldValue: TRow | undefined;
  /** Current row value after edits (same as `row`). */
  newValue: TRow;
  /** Whether any cell changes were actually committed in this row during the session. */
  changed: boolean;
  /** Current changed row collection. */
  changedRows: TRow[];
  /** IDs of changed rows. */
  changedRowIds: string[];
}

/**
 * Emitted when the changed rows tracking set is cleared programmatically.
 *
 * Fired when `resetChangedRows()` is called.
 *
 * @category Events
 */
export interface ChangedRowsResetDetail<TRow = unknown> {
  /** New (empty) changed rows array after reset. */
  rows: TRow[];
  /** IDs of changed rows (likely empty). */
  ids: string[];
}

/**
 * Detail payload for the `edit-open` event.
 *
 * Fired when row editing begins (user clicks/double-clicks a row to edit).
 * Only fires in `mode: 'row'` — never in `mode: 'grid'` where all rows
 * are perpetually editable.
 *
 * @category Events
 */
export interface EditOpenDetail<TRow = unknown> {
  /** Index of the row entering edit mode. */
  rowIndex: number;
  /** Stable row identifier (from getRowId). */
  rowId: string;
  /** Row object reference. */
  row: TRow;
}

/**
 * Detail payload for the `before-edit-close` event.
 *
 * Fired **synchronously** just before the grid clears editing state and
 * destroys editor DOM. At this point the commit callback is still active,
 * so framework adapter editors (Angular/React/Vue) can flush pending values
 * via their `commit()` callback.
 *
 * Only fires on the **commit** path (not on revert/cancel) and only in
 * `mode: 'row'` — never in `mode: 'grid'`.
 *
 * @category Events
 */
export interface BeforeEditCloseDetail<TRow = unknown> {
  /** Index of the row about to leave edit mode. */
  rowIndex: number;
  /** Stable row identifier (from getRowId). */
  rowId: string;
  /** Row object reference (current state — mutations are still accepted). */
  row: TRow;
}

/**
 * Detail payload for the `edit-close` event.
 *
 * Fired when row editing ends, whether committed or reverted.
 * Only fires in `mode: 'row'` — never in `mode: 'grid'` where all rows
 * are perpetually editable.
 *
 * Unlike `row-commit` (which only fires on commit), `edit-close` fires for
 * both commit and cancel/revert, making it suitable for cleanup tasks like
 * closing overlays or resetting state.
 *
 * @category Events
 */
export interface EditCloseDetail<TRow = unknown> {
  /** Index of the row that left edit mode. */
  rowIndex: number;
  /** Stable row identifier (from getRowId). */
  rowId: string;
  /** Row object reference (current state). */
  row: TRow;
  /** Whether the edit was reverted (true) or committed (false). */
  reverted: boolean;
}

// ============================================================================
// Module Augmentation - Add editing properties to column config
// ============================================================================

/**
 * When EditingPlugin is imported, these properties become available on column config.
 * This augments the core BaseColumnConfig interface.
 */
declare module '../../core/types' {
  interface BaseColumnConfig<TRow, TValue> {
    /** Whether the field is editable (enables editors). Requires EditingPlugin. */
    editable?: boolean;
    /** Optional custom editor factory or element tag name. Requires EditingPlugin. */
    editor?: ColumnEditorSpec<TRow, TValue>;
    /**
     * Configuration parameters for built-in editors.
     * Shape depends on column type (NumberEditorParams, TextEditorParams, DateEditorParams, SelectEditorParams).
     * Requires EditingPlugin.
     *
     * @example
     * ```typescript
     * { field: 'price', type: 'number', editable: true, editorParams: { min: 0, max: 1000, step: 0.01 } }
     * ```
     */
    editorParams?: EditorParams;
  }

  interface TypeDefault {
    /**
     * Default editor for all columns of this type. Requires EditingPlugin.
     *
     * Use type-level editors when multiple columns share the same editing behavior.
     * Column-level `editor` takes precedence over type-level.
     *
     * **Resolution Priority**: Column `editor` → Type `editor` → Built-in
     *
     * @example
     * ```typescript
     * // All 'date' columns use a custom datepicker
     * typeDefaults: {
     *   date: {
     *     editor: (ctx) => {
     *       const picker = new MyDatePicker();
     *       picker.value = ctx.value;
     *       picker.onSelect = (d) => ctx.commit(d);
     *       picker.onCancel = () => ctx.cancel();
     *       return picker;
     *     }
     *   }
     * }
     * ```
     */
    editor?: ColumnEditorSpec<unknown, unknown>;

    /**
     * Default editor parameters for all columns of this type. Requires EditingPlugin.
     *
     * Applied to built-in editors when no column-level `editorParams` is set.
     * Useful for setting consistent constraints across columns (e.g., all currency
     * fields should have `min: 0` and `step: 0.01`).
     *
     * **Resolution Priority**: Column `editorParams` → Type `editorParams` → Built-in defaults
     *
     * @example
     * ```typescript
     * // All 'currency' columns use these number editor params
     * typeDefaults: {
     *   currency: {
     *     editorParams: { min: 0, step: 0.01 }
     *   }
     * }
     *
     * // Column can still override:
     * columns: [
     *   { field: 'price', type: 'currency', editable: true },  // Uses type defaults
     *   { field: 'discount', type: 'currency', editable: true,
     *     editorParams: { min: -100, max: 100 } }  // Overrides type defaults
     * ]
     * ```
     */
    editorParams?: Record<string, unknown>;
  }

  interface GridConfig {
    /**
     * Edit trigger mode. Requires `EditingPlugin` to be loaded.
     *
     * Configure via `new EditingPlugin({ editOn: 'click' })` or set on gridConfig.
     * Plugin config takes precedence over gridConfig.
     *
     * - `'click'`: Single click to edit
     * - `'dblclick'`: Double-click to edit (default)
     * - `'manual'`: Only via programmatic API (beginEdit)
     * - `false`: Disable editing entirely
     */
    editOn?: 'click' | 'dblclick' | 'manual' | false;
  }

  interface DataGridEventMap<TRow = unknown> {
    /** Fired when a cell value is committed (cancelable). */
    'cell-commit': CellCommitDetail<TRow>;
    /** Fired when a row editing session ends. */
    'row-commit': RowCommitDetail<TRow>;
    /** Fired when changed rows tracking is reset. */
    'changed-rows-reset': ChangedRowsResetDetail<TRow>;
    /** Fired when a row enters edit mode (row mode only, not grid mode). */
    'edit-open': EditOpenDetail<TRow>;
    /** Fired synchronously before editing state is cleared. Commit callbacks are still active. */
    'before-edit-close': BeforeEditCloseDetail<TRow>;
    /** Fired when a row leaves edit mode, whether committed or reverted (row mode only). */
    'edit-close': EditCloseDetail<TRow>;
  }

  interface PluginNameMap {
    editing: import('./EditingPlugin').EditingPlugin;
  }
}

// ============================================================================
// Plugin Configuration
// ============================================================================

/**
 * Configuration options for EditingPlugin.
 */
export interface EditingConfig {
  /**
   * Editing mode that determines how many rows are editable at once.
   *
   * - `'row'` (default): Click/double-click to edit one row at a time.
   *   Editors appear when the row enters edit mode and disappear on commit/cancel.
   *
   * - `'grid'`: The entire grid is always in edit mode. All editable cells
   *   display their editors immediately. Commit/cancel affects individual cells
   *   but does not exit edit mode. Useful for spreadsheet-like data entry.
   *
   * @default 'row'
   */
  mode?: 'row' | 'grid';

  /**
   * Controls when editing is triggered (only applies to `mode: 'row'`).
   * - 'click': Edit on single click (default)
   * - 'dblclick': Edit on double click
   * - 'manual': Only via programmatic API (beginEdit)
   * - false: Disable editing entirely
   */
  editOn?: 'click' | 'dblclick' | 'manual' | false;

  /**
   * Callback invoked before a row edit session closes.
   *
   * Return `false` to prevent the row from exiting edit mode.
   * This is useful when editors have open overlays (datepickers, dropdowns)
   * that render outside the grid DOM.
   *
   * The callback receives the triggering event:
   * - `MouseEvent` - when clicking outside the editing row
   * - `KeyboardEvent` - when pressing Enter or Escape
   *
   * Use this to check if the event target is inside your component library's
   * overlay container, allowing keyboard navigation and selection within
   * open dropdowns before the edit commits.
   *
   * @example
   * ```typescript
   * // Angular Material / CDK - prevent close when overlay is open
   * new EditingPlugin({
   *   editOn: 'dblclick',
   *   onBeforeEditClose: (event) => {
   *     const target = event.target as Element;
   *     // Return false to PREVENT closing (interaction is inside overlay)
   *     // Return true to ALLOW closing (no overlay is open)
   *     return !target?.closest('.cdk-overlay-container');
   *   }
   * })
   *
   * // MUI (React)
   * new EditingPlugin({
   *   onBeforeEditClose: (event) => {
   *     const target = event.target as Element;
   *     return !target?.closest('.MuiPopover-root, .MuiPopper-root');
   *   }
   * })
   * ```
   */
  onBeforeEditClose?: (event: MouseEvent | KeyboardEvent) => boolean;
}

/**
 * Context passed to editor factory functions.
 *
 * Extends the public {@link ColumnEditorContext} with no additional properties.
 * Kept as a separate type for backward compatibility with existing plugin code
 * that imports `EditorContext` from the editing plugin.
 */
export type EditorContext<T = any, V = unknown> = ColumnEditorContext<T, V>;

// ============================================================================
// Editor Parameters - Configuration for built-in editors
// ============================================================================

/**
 * Configuration parameters for the built-in number editor.
 *
 * @example
 * ```typescript
 * { field: 'price', type: 'number', editable: true, editorParams: { min: 0, max: 1000, step: 0.01 } }
 * ```
 */
export interface NumberEditorParams {
  /** Minimum allowed value */
  min?: number;
  /** Maximum allowed value */
  max?: number;
  /** Step increment for up/down arrows */
  step?: number;
  /** Placeholder text when empty */
  placeholder?: string;
}

/**
 * Configuration parameters for the built-in text editor.
 *
 * @example
 * ```typescript
 * { field: 'name', editable: true, editorParams: { maxLength: 50, placeholder: 'Enter name...' } }
 * ```
 */
export interface TextEditorParams {
  /** Maximum character length */
  maxLength?: number;
  /** Regex pattern for validation (HTML5 pattern attribute) */
  pattern?: string;
  /** Placeholder text when empty */
  placeholder?: string;
}

/**
 * Configuration parameters for the built-in date editor.
 *
 * @example
 * ```typescript
 * { field: 'startDate', type: 'date', editable: true, editorParams: { min: '2024-01-01' } }
 * ```
 */
export interface DateEditorParams {
  /** Minimum date (ISO string: 'YYYY-MM-DD') */
  min?: string;
  /** Maximum date (ISO string: 'YYYY-MM-DD') */
  max?: string;
  /** Placeholder text when empty */
  placeholder?: string;
}

/**
 * Configuration parameters for the built-in select editor.
 *
 * @example
 * ```typescript
 * { field: 'status', type: 'select', editable: true, editorParams: { includeEmpty: true, emptyLabel: '-- Select --' } }
 * ```
 */
export interface SelectEditorParams {
  /** Include an empty option at the start */
  includeEmpty?: boolean;
  /** Label for the empty option (default: '') */
  emptyLabel?: string;
}

/**
 * Union type of all editor parameter configurations.
 *
 * Built-in editors use specific param shapes (NumberEditorParams, TextEditorParams, etc.).
 * Custom editors can use any Record<string, unknown> for their params.
 *
 * The applicable shape depends on the column type and editor.
 */
export type EditorParams =
  | NumberEditorParams
  | TextEditorParams
  | DateEditorParams
  | SelectEditorParams
  | Record<string, unknown>;
