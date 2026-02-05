/**
 * Editing Plugin
 *
 * Provides complete editing functionality for tbw-grid.
 * This plugin is FULLY SELF-CONTAINED - the grid has ZERO editing knowledge.
 *
 * The plugin:
 * - Owns all editing state (active cell, snapshots, changed rows)
 * - Uses event distribution (onCellClick, onKeyDown) to handle edit lifecycle
 * - Uses afterRender() hook to inject editors into cells
 * - Uses processColumns() to augment columns with editing metadata
 * - Emits its own events (cell-commit, row-commit, changed-rows-reset)
 *
 * Without this plugin, the grid cannot edit. With this plugin, editing
 * is fully functional without any core changes.
 */

import { ensureCellVisible } from '../../core/internal/keyboard';
import type { PluginManifest, PluginQuery } from '../../core/plugin/base-plugin';
import { BaseGridPlugin, type CellClickEvent, type GridElement } from '../../core/plugin/base-plugin';
import type {
  ColumnConfig,
  ColumnEditorSpec,
  ColumnInternal,
  InternalGrid,
  RowElementInternal,
} from '../../core/types';
import styles from './editing.css?inline';
import { defaultEditorFor } from './editors';
import type { CellCommitDetail, ChangedRowsResetDetail, EditingConfig, EditorContext, RowCommitDetail } from './types';

// ============================================================================
// Constants
// ============================================================================

/**
 * CSS selector for focusable editor elements within a cell.
 */
export const FOCUSABLE_EDITOR_SELECTOR =
  'input,select,textarea,[contenteditable="true"],[contenteditable=""],[tabindex]:not([tabindex="-1"])';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Resolves the editor for a column using the priority chain:
 * 1. Column-level (`column.editor`)
 * 2. Light DOM template (`__editorTemplate` → returns 'template')
 * 3. Grid-level (`gridConfig.typeDefaults[column.type]`)
 * 4. App-level (framework adapter's `getTypeDefault`)
 * 5. Returns undefined (caller uses built-in defaultEditorFor)
 */
function resolveEditor<TRow>(
  grid: InternalGrid<TRow>,
  col: ColumnInternal<TRow>,
): ColumnEditorSpec<TRow, unknown> | 'template' | undefined {
  // 1. Column-level editor (highest priority)
  if (col.editor) return col.editor;

  // 2. Light DOM template
  const tplHolder = col.__editorTemplate;
  if (tplHolder) return 'template';

  // No type specified - no type defaults to check
  if (!col.type) return undefined;

  // 3. Grid-level typeDefaults (access via effectiveConfig)
  const gridTypeDefaults = (grid as any).effectiveConfig?.typeDefaults;
  if (gridTypeDefaults?.[col.type]?.editor) {
    return gridTypeDefaults[col.type].editor as ColumnEditorSpec<TRow, unknown>;
  }

  // 4. App-level registry (via framework adapter)
  const adapter = grid.__frameworkAdapter;
  if (adapter?.getTypeDefault) {
    const appDefault = adapter.getTypeDefault<TRow>(col.type);
    if (appDefault?.editor) {
      return appDefault.editor as ColumnEditorSpec<TRow, unknown>;
    }
  }

  // 5. No custom editor - caller uses built-in defaultEditorFor
  return undefined;
}

/**
 * Returns true if the given property key is safe to use on a plain object.
 */
function isSafePropertyKey(key: unknown): key is string {
  if (typeof key !== 'string') return false;
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') return false;
  return true;
}

/**
 * Check if a row element has any cells in editing mode.
 */
export function hasEditingCells(rowEl: RowElementInternal): boolean {
  return (rowEl.__editingCellCount ?? 0) > 0;
}

/**
 * Increment the editing cell count on a row element.
 */
function incrementEditingCount(rowEl: RowElementInternal): void {
  const count = (rowEl.__editingCellCount ?? 0) + 1;
  rowEl.__editingCellCount = count;
  rowEl.setAttribute('data-has-editing', '');
}

/**
 * Clear all editing state from a row element.
 */
export function clearEditingState(rowEl: RowElementInternal): void {
  rowEl.__editingCellCount = 0;
  rowEl.removeAttribute('data-has-editing');
}

/**
 * Get the typed value from an input element based on its type, column config, and original value.
 * Preserves the type of the original value (e.g., numeric currency values stay as numbers,
 * string dates stay as strings).
 */
function getInputValue(
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  column?: ColumnConfig<any>,
  originalValue?: unknown,
): unknown {
  if (input instanceof HTMLInputElement) {
    if (input.type === 'checkbox') return input.checked;
    if (input.type === 'number') return input.value === '' ? null : Number(input.value);
    if (input.type === 'date') {
      // Preserve original type: if original was a string, return string (YYYY-MM-DD format)
      if (typeof originalValue === 'string') {
        return input.value; // input.value is already in YYYY-MM-DD format
      }
      return input.valueAsDate;
    }
    // For text inputs, check if original value was a number to preserve type
    if (typeof originalValue === 'number') {
      return input.value === '' ? null : Number(input.value);
    }
    // Preserve null/undefined: if original was null/undefined and input is empty, return original
    if ((originalValue === null || originalValue === undefined) && input.value === '') {
      return originalValue;
    }
    return input.value;
  }
  // For textarea/select, check column type OR original value type
  if (column?.type === 'number' && input.value !== '') {
    return Number(input.value);
  }
  // Preserve numeric type for custom column types (e.g., currency)
  if (typeof originalValue === 'number' && input.value !== '') {
    return Number(input.value);
  }
  // Preserve null/undefined: if original was null/undefined and input is empty, return original
  if ((originalValue === null || originalValue === undefined) && input.value === '') {
    return originalValue;
  }
  return input.value;
}

/**
 * No-op updateRow function for rows without IDs.
 * Extracted to a named function to satisfy eslint no-empty-function.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function noopUpdateRow(_changes: unknown): void {
  // Row has no ID - cannot update
}

/**
 * Auto-wire commit/cancel lifecycle for input elements in string-returned editors.
 */
function wireEditorInputs(
  editorHost: HTMLElement,
  column: ColumnConfig<unknown>,
  commit: (value: unknown) => void,
  originalValue?: unknown,
): void {
  const input = editorHost.querySelector('input,textarea,select') as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement
    | null;
  if (!input) return;

  input.addEventListener('blur', () => {
    commit(getInputValue(input, column, originalValue));
  });

  if (input instanceof HTMLInputElement && input.type === 'checkbox') {
    input.addEventListener('change', () => commit(input.checked));
  } else if (input instanceof HTMLSelectElement) {
    input.addEventListener('change', () => commit(getInputValue(input, column, originalValue)));
  }
}

// ============================================================================
// EditingPlugin
// ============================================================================

/**
 * Editing Plugin for tbw-grid
 *
 * Enables inline cell editing in the grid. Provides built-in editors for common data types
 * and supports custom editor functions for specialized input scenarios.
 *
 * ## Why Opt-In?
 *
 * Editing is delivered as a plugin rather than built into the core grid:
 *
 * - **Smaller bundle** — Apps that only display data don't pay for editing code
 * - **Clear intent** — Explicit plugin registration makes editing capability obvious
 * - **Runtime validation** — Using `editable: true` without the plugin throws a helpful error
 *
 * ## Installation
 *
 * ```ts
 * import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';
 * ```
 *
 * ## Edit Triggers
 *
 * Configure how editing is triggered with the `editOn` option:
 *
 * | Value | Behavior |
 * |-------|----------|
 * | `'click'` | Single click enters edit mode (default) |
 * | `'dblclick'` | Double-click enters edit mode |
 *
 * ## Keyboard Shortcuts
 *
 * | Key | Action |
 * |-----|--------|
 * | `Enter` | Commit edit and move down |
 * | `Tab` | Commit edit and move right |
 * | `Escape` | Cancel edit, restore original value |
 * | `Arrow Keys` | Navigate between cells (when not editing) |
 *
 * @example Basic editing with double-click trigger
 * ```ts
 * grid.gridConfig = {
 *   columns: [
 *     { field: 'name', editable: true },
 *     { field: 'price', type: 'number', editable: true },
 *     { field: 'active', type: 'boolean', editable: true },
 *   ],
 *   plugins: [new EditingPlugin({ editOn: 'dblclick' })],
 * };
 *
 * grid.addEventListener('cell-commit', (e) => {
 *   const { field, oldValue, newValue } = e.detail;
 *   console.log(`${field}: ${oldValue} → ${newValue}`);
 * });
 * ```
 *
 * @example Custom editor function
 * ```ts
 * columns: [
 *   {
 *     field: 'status',
 *     editable: true,
 *     editor: (ctx) => {
 *       const select = document.createElement('select');
 *       ['pending', 'active', 'completed'].forEach(opt => {
 *         const option = document.createElement('option');
 *         option.value = opt;
 *         option.textContent = opt;
 *         option.selected = ctx.value === opt;
 *         select.appendChild(option);
 *       });
 *       select.addEventListener('change', () => ctx.commit(select.value));
 *       return select;
 *     },
 *   },
 * ]
 * ```
 *
 * @see {@link EditingConfig} for configuration options
 * @see {@link EditorContext} for custom editor context
 * @see [Live Demos](?path=/docs/grid-plugins-editing--docs) for interactive examples
 */
export class EditingPlugin<T = unknown> extends BaseGridPlugin<EditingConfig> {
  /**
   * Plugin manifest - declares owned properties for configuration validation.
   * @internal
   */
  static override readonly manifest: PluginManifest = {
    ownedProperties: [
      {
        property: 'editable',
        level: 'column',
        description: 'the "editable" column property',
        isUsed: (v) => v === true,
      },
      {
        property: 'editor',
        level: 'column',
        description: 'the "editor" column property',
      },
      {
        property: 'editorParams',
        level: 'column',
        description: 'the "editorParams" column property',
      },
    ],
    events: [
      {
        type: 'cell-edit-committed',
        description: 'Emitted when a cell edit is committed (for plugin-to-plugin coordination)',
      },
    ],
    queries: [
      {
        type: 'isEditing',
        description: 'Returns whether any cell is currently being edited',
      },
    ],
  };

  /** @internal */
  readonly name = 'editing';
  /** @internal */
  override readonly styles = styles;

  /** @internal */
  protected override get defaultConfig(): Partial<EditingConfig> {
    return {
      editOn: 'click',
    };
  }

  // #region Editing State (fully owned by plugin)

  /** Currently active edit row index, or -1 if not editing */
  #activeEditRow = -1;

  /** Currently active edit column index, or -1 if not editing */
  #activeEditCol = -1;

  /** Snapshots of row data before editing started */
  #rowEditSnapshots = new Map<number, T>();

  /** Set of row IDs that have been modified (ID-based for stability) */
  #changedRowIds = new Set<string>();

  /** Set of cells currently in edit mode: "rowIndex:colIndex" */
  #editingCells = new Set<string>();

  /** Flag to restore focus after next render (used when exiting edit mode) */
  #pendingFocusRestore = false;

  /** Row index pending animation after render, or -1 if none */
  #pendingRowAnimation = -1;

  /**
   * Invalid cell tracking: Map<rowId, Map<field, message>>
   * Used for validation feedback without canceling edits.
   */
  #invalidCells = new Map<string, Map<string, string>>();

  // #endregion

  // #region Lifecycle

  /** @internal */
  override attach(grid: GridElement): void {
    super.attach(grid);

    const signal = this.disconnectSignal;
    const internalGrid = grid as unknown as InternalGrid<T>;

    // Inject editing state and methods onto grid for backward compatibility
    internalGrid._activeEditRows = -1;
    internalGrid._rowEditSnapshots = new Map();

    // Inject changedRows getter
    Object.defineProperty(grid, 'changedRows', {
      get: () => this.changedRows,
      configurable: true,
    });

    // Inject changedRowIds getter (new ID-based API)
    Object.defineProperty(grid, 'changedRowIds', {
      get: () => this.changedRowIds,
      configurable: true,
    });

    // Inject resetChangedRows method
    (grid as any).resetChangedRows = (silent?: boolean) => this.resetChangedRows(silent);

    // Inject beginBulkEdit method (for backward compatibility)
    (grid as any).beginBulkEdit = (rowIndex: number, field?: string) => {
      if (field) {
        this.beginCellEdit(rowIndex, field);
      }
      // If no field specified, we can't start editing without a specific cell
    };

    // Document-level Escape to cancel editing
    document.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.key === 'Escape' && this.#activeEditRow !== -1) {
          this.#exitRowEdit(this.#activeEditRow, true);
        }
      },
      { capture: true, signal },
    );

    // Click outside to commit editing
    // Use queueMicrotask to allow pending change events to fire first.
    // This is important for Angular/React editors where the (change) event
    // fires after mousedown but before mouseup/click.
    document.addEventListener(
      'mousedown',
      (e: MouseEvent) => {
        if (this.#activeEditRow === -1) return;
        const rowEl = internalGrid.findRenderedRowElement?.(this.#activeEditRow);
        if (!rowEl) return;
        const path = (e.composedPath && e.composedPath()) || [];
        if (path.includes(rowEl)) return;
        // Delay exit to allow pending change/commit events to fire
        queueMicrotask(() => {
          if (this.#activeEditRow !== -1) {
            this.#exitRowEdit(this.#activeEditRow, false);
          }
        });
      },
      { signal },
    );
  }

  /** @internal */
  override detach(): void {
    this.#activeEditRow = -1;
    this.#activeEditCol = -1;
    this.#rowEditSnapshots.clear();
    this.#changedRowIds.clear();
    this.#editingCells.clear();
    super.detach();
  }

  /**
   * Handle plugin queries.
   * @internal
   */
  override handleQuery(query: PluginQuery): unknown {
    if (query.type === 'isEditing') {
      return this.#activeEditRow !== -1;
    }
    return undefined;
  }

  // #endregion

  // #region Event Handlers (event distribution)

  /**
   * Handle cell clicks - start editing if configured for click mode.
   * Both click and dblclick events come through this handler.
   * Starts row-based editing (all editable cells in the row get editors).
   * @internal
   */
  override onCellClick(event: CellClickEvent): boolean | void {
    const internalGrid = this.grid as unknown as InternalGrid<T>;
    const editOn = this.config.editOn ?? internalGrid.effectiveConfig?.editOn;

    // Check if editing is disabled
    if (editOn === false || editOn === 'manual') return false;

    // Check if this is click or dblclick mode
    if (editOn !== 'click' && editOn !== 'dblclick') return false;

    // Check if the event type matches the edit mode
    const isDoubleClick = event.originalEvent.type === 'dblclick';
    if (editOn === 'click' && isDoubleClick) return false; // In click mode, only handle single clicks
    if (editOn === 'dblclick' && !isDoubleClick) return false; // In dblclick mode, only handle double clicks

    const { rowIndex } = event;

    // Check if any column in the row is editable
    const hasEditableColumn = internalGrid._columns?.some((col) => col.editable);
    if (!hasEditableColumn) return false;

    // Start row-based editing (all editable cells get editors)
    event.originalEvent.stopPropagation();
    this.beginBulkEdit(rowIndex);
    return true; // Handled
  }

  /**
   * Handle keyboard events for edit lifecycle.
   * @internal
   */
  override onKeyDown(event: KeyboardEvent): boolean | void {
    const internalGrid = this.grid as unknown as InternalGrid<T>;

    // Escape: cancel current edit
    if (event.key === 'Escape' && this.#activeEditRow !== -1) {
      this.#exitRowEdit(this.#activeEditRow, true);
      return true;
    }

    // Arrow Up/Down while editing: commit and exit edit mode, move to adjacent row
    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && this.#activeEditRow !== -1) {
      const maxRow = internalGrid._rows.length - 1;
      const currentRow = this.#activeEditRow;

      // Commit the current edit
      this.#exitRowEdit(currentRow, false);

      // Move focus to adjacent row (same column)
      if (event.key === 'ArrowDown') {
        internalGrid._focusRow = Math.min(maxRow, internalGrid._focusRow + 1);
      } else {
        internalGrid._focusRow = Math.max(0, internalGrid._focusRow - 1);
      }

      event.preventDefault();
      // Ensure the focused cell is scrolled into view
      ensureCellVisible(internalGrid);
      // Request render to update focus styling
      this.requestAfterRender();
      return true;
    }

    // Tab/Shift+Tab while editing: move to next/prev editable cell
    if (event.key === 'Tab' && this.#activeEditRow !== -1) {
      event.preventDefault();
      const forward = !event.shiftKey;
      this.#handleTabNavigation(forward);
      return true;
    }

    // Space: toggle boolean cells
    if (event.key === ' ' || event.key === 'Spacebar') {
      const focusRow = internalGrid._focusRow;
      const focusCol = internalGrid._focusCol;
      if (focusRow >= 0 && focusCol >= 0) {
        const column = internalGrid._visibleColumns[focusCol];
        const rowData = internalGrid._rows[focusRow];
        if (column?.editable && column.type === 'boolean' && rowData) {
          const field = column.field;
          if (isSafePropertyKey(field)) {
            const currentValue = (rowData as Record<string, unknown>)[field];
            const newValue = !currentValue;
            this.#commitCellValue(focusRow, column, newValue, rowData);
            event.preventDefault();
            // Re-render to update the UI
            this.requestRender();
            return true;
          }
        }
      }
      // Space on non-boolean cell - don't block keyboard navigation
      return false;
    }

    // Enter: start row edit or commit
    if (event.key === 'Enter' && !event.shiftKey) {
      if (this.#activeEditRow !== -1) {
        // Already editing - let cell handlers deal with it
        return false;
      }

      // Start row-based editing (not just the focused cell)
      const editOn = this.config.editOn ?? internalGrid.effectiveConfig?.editOn;
      if (editOn === false || editOn === 'manual') return false;

      const focusRow = internalGrid._focusRow;
      const focusCol = internalGrid._focusCol;
      if (focusRow >= 0) {
        // Check if ANY column in the row is editable
        const hasEditableColumn = internalGrid._columns?.some((col) => col.editable);
        if (hasEditableColumn) {
          // Emit cell-activate event BEFORE starting edit
          // This ensures consumers always get the activation event
          const column = internalGrid._visibleColumns[focusCol];
          const row = internalGrid._rows[focusRow];
          const field = column?.field ?? '';
          const value = field && row ? (row as Record<string, unknown>)[field] : undefined;
          const cellEl = this.gridElement.querySelector(`[data-row="${focusRow}"][data-col="${focusCol}"]`) as
            | HTMLElement
            | undefined;

          const activateEvent = new CustomEvent('cell-activate', {
            cancelable: true,
            bubbles: true,
            detail: {
              rowIndex: focusRow,
              colIndex: focusCol,
              field,
              value,
              row,
              cellEl,
              trigger: 'keyboard' as const,
              originalEvent: event,
            },
          });
          this.gridElement.dispatchEvent(activateEvent);

          // Also emit deprecated activate-cell for backwards compatibility
          const legacyEvent = new CustomEvent('activate-cell', {
            cancelable: true,
            bubbles: true,
            detail: { row: focusRow, col: focusCol },
          });
          this.gridElement.dispatchEvent(legacyEvent);

          // If consumer canceled the activation, don't start editing
          if (activateEvent.defaultPrevented || legacyEvent.defaultPrevented) {
            event.preventDefault();
            return true;
          }

          this.beginBulkEdit(focusRow);
          return true;
        }
      }
      // No editable columns - don't block keyboard navigation
      return false;
    }

    // Don't block other keyboard events
    return false;
  }

  // #endregion

  // #region Render Hooks

  /**
   * Process columns to merge type-level editorParams with column-level.
   * Column-level params take precedence.
   * @internal
   */
  override processColumns(columns: ColumnConfig<T>[]): ColumnConfig<T>[] {
    const internalGrid = this.grid as unknown as InternalGrid<T>;
    const typeDefaults = (internalGrid as any).effectiveConfig?.typeDefaults;
    const adapter = internalGrid.__frameworkAdapter;

    // If no type defaults configured anywhere, skip processing
    if (!typeDefaults && !adapter?.getTypeDefault) return columns;

    return columns.map((col) => {
      if (!col.type) return col;

      // Get type-level editorParams
      let typeEditorParams: Record<string, unknown> | undefined;

      // Check grid-level typeDefaults first
      if (typeDefaults?.[col.type]?.editorParams) {
        typeEditorParams = typeDefaults[col.type].editorParams;
      }

      // Then check app-level (adapter) typeDefaults
      if (!typeEditorParams && adapter?.getTypeDefault) {
        const appDefault = adapter.getTypeDefault<T>(col.type);
        if (appDefault?.editorParams) {
          typeEditorParams = appDefault.editorParams;
        }
      }

      // No type-level params to merge
      if (!typeEditorParams) return col;

      // Merge: type-level as base, column-level wins on conflicts
      return {
        ...col,
        editorParams: { ...typeEditorParams, ...col.editorParams },
      };
    });
  }

  /**
   * After render, reapply editors to cells in edit mode.
   * This handles virtualization - when a row scrolls back into view,
   * we need to re-inject the editor.
   * @internal
   */
  override afterRender(): void {
    const internalGrid = this.grid as unknown as InternalGrid<T>;

    // Restore focus after exiting edit mode
    if (this.#pendingFocusRestore) {
      this.#pendingFocusRestore = false;
      this.#restoreCellFocus(internalGrid);
    }

    // Animate the row after render completes (so the row element exists)
    if (this.#pendingRowAnimation !== -1) {
      const rowIndex = this.#pendingRowAnimation;
      this.#pendingRowAnimation = -1;
      internalGrid.animateRow?.(rowIndex, 'change');
    }

    if (this.#editingCells.size === 0) return;

    // Re-inject editors for any editing cells that are visible
    for (const cellKey of this.#editingCells) {
      const [rowStr, colStr] = cellKey.split(':');
      const rowIndex = parseInt(rowStr, 10);
      const colIndex = parseInt(colStr, 10);

      const rowEl = internalGrid.findRenderedRowElement?.(rowIndex);
      if (!rowEl) continue;

      const cellEl = rowEl.querySelector(`.cell[data-col="${colIndex}"]`) as HTMLElement | null;
      if (!cellEl || cellEl.classList.contains('editing')) continue;

      // Cell is visible but not in editing mode - reinject editor
      const rowData = internalGrid._rows[rowIndex];
      const column = internalGrid._visibleColumns[colIndex];
      if (rowData && column) {
        this.#injectEditor(rowData, rowIndex, column, colIndex, cellEl, true);
      }
    }
  }

  /**
   * On scroll render, reapply editors to recycled cells.
   * @internal
   */
  override onScrollRender(): void {
    this.afterRender();
  }

  // #endregion

  // #region Public API

  /**
   * Get all rows that have been modified.
   * Uses ID-based lookup for stability when rows are reordered.
   */
  get changedRows(): T[] {
    const rows: T[] = [];
    for (const id of this.#changedRowIds) {
      const row = this.grid.getRow(id) as T | undefined;
      if (row) rows.push(row);
    }
    return rows;
  }

  /**
   * Get IDs of all modified rows.
   */
  get changedRowIds(): string[] {
    return Array.from(this.#changedRowIds);
  }

  /**
   * Get the currently active edit row index, or -1 if not editing.
   */
  get activeEditRow(): number {
    return this.#activeEditRow;
  }

  /**
   * Get the currently active edit column index, or -1 if not editing.
   */
  get activeEditCol(): number {
    return this.#activeEditCol;
  }

  /**
   * Check if a specific row is currently being edited.
   */
  isRowEditing(rowIndex: number): boolean {
    return this.#activeEditRow === rowIndex;
  }

  /**
   * Check if a specific cell is currently being edited.
   */
  isCellEditing(rowIndex: number, colIndex: number): boolean {
    return this.#editingCells.has(`${rowIndex}:${colIndex}`);
  }

  /**
   * Check if a specific row has been modified.
   * @param rowIndex - Row index to check (will be converted to ID internally)
   */
  isRowChanged(rowIndex: number): boolean {
    const internalGrid = this.grid as unknown as InternalGrid<T>;
    const row = internalGrid._rows[rowIndex];
    if (!row) return false;
    try {
      const rowId = internalGrid.getRowId?.(row);
      return rowId ? this.#changedRowIds.has(rowId) : false;
    } catch {
      return false;
    }
  }

  /**
   * Check if a row with the given ID has been modified.
   * @param rowId - Row ID to check
   */
  isRowChangedById(rowId: string): boolean {
    return this.#changedRowIds.has(rowId);
  }

  // #region Cell Validation

  /**
   * Mark a cell as invalid with an optional validation message.
   * Invalid cells are marked with a `data-invalid` attribute for styling.
   *
   * @param rowId - The row ID (from getRowId)
   * @param field - The field name
   * @param message - Optional validation message (for tooltips or display)
   *
   * @example
   * ```typescript
   * // In cell-commit handler:
   * grid.addEventListener('cell-commit', (e) => {
   *   if (e.detail.field === 'email' && !isValidEmail(e.detail.value)) {
   *     e.detail.setInvalid('Invalid email format');
   *   }
   * });
   *
   * // Or programmatically:
   * editingPlugin.setInvalid('row-123', 'email', 'Invalid email format');
   * ```
   */
  setInvalid(rowId: string, field: string, message = ''): void {
    let rowInvalids = this.#invalidCells.get(rowId);
    if (!rowInvalids) {
      rowInvalids = new Map();
      this.#invalidCells.set(rowId, rowInvalids);
    }
    rowInvalids.set(field, message);
    this.#syncInvalidCellAttribute(rowId, field, true);
  }

  /**
   * Clear the invalid state for a specific cell.
   *
   * @param rowId - The row ID (from getRowId)
   * @param field - The field name
   */
  clearInvalid(rowId: string, field: string): void {
    const rowInvalids = this.#invalidCells.get(rowId);
    if (rowInvalids) {
      rowInvalids.delete(field);
      if (rowInvalids.size === 0) {
        this.#invalidCells.delete(rowId);
      }
    }
    this.#syncInvalidCellAttribute(rowId, field, false);
  }

  /**
   * Clear all invalid cells for a specific row.
   *
   * @param rowId - The row ID (from getRowId)
   */
  clearRowInvalid(rowId: string): void {
    const rowInvalids = this.#invalidCells.get(rowId);
    if (rowInvalids) {
      const fields = Array.from(rowInvalids.keys());
      this.#invalidCells.delete(rowId);
      fields.forEach((field) => this.#syncInvalidCellAttribute(rowId, field, false));
    }
  }

  /**
   * Clear all invalid cell states across all rows.
   */
  clearAllInvalid(): void {
    const entries = Array.from(this.#invalidCells.entries());
    this.#invalidCells.clear();
    entries.forEach(([rowId, fields]) => {
      fields.forEach((_, field) => this.#syncInvalidCellAttribute(rowId, field, false));
    });
  }

  /**
   * Check if a specific cell is marked as invalid.
   *
   * @param rowId - The row ID (from getRowId)
   * @param field - The field name
   * @returns True if the cell is marked as invalid
   */
  isCellInvalid(rowId: string, field: string): boolean {
    return this.#invalidCells.get(rowId)?.has(field) ?? false;
  }

  /**
   * Get the validation message for an invalid cell.
   *
   * @param rowId - The row ID (from getRowId)
   * @param field - The field name
   * @returns The validation message, or undefined if cell is valid
   */
  getInvalidMessage(rowId: string, field: string): string | undefined {
    return this.#invalidCells.get(rowId)?.get(field);
  }

  /**
   * Check if a row has any invalid cells.
   *
   * @param rowId - The row ID (from getRowId)
   * @returns True if the row has at least one invalid cell
   */
  hasInvalidCells(rowId: string): boolean {
    const rowInvalids = this.#invalidCells.get(rowId);
    return rowInvalids ? rowInvalids.size > 0 : false;
  }

  /**
   * Get all invalid fields for a row.
   *
   * @param rowId - The row ID (from getRowId)
   * @returns Map of field names to validation messages
   */
  getInvalidFields(rowId: string): Map<string, string> {
    return new Map(this.#invalidCells.get(rowId) ?? []);
  }

  /**
   * Sync the data-invalid attribute on a cell element.
   */
  #syncInvalidCellAttribute(rowId: string, field: string, invalid: boolean): void {
    const internalGrid = this.grid as unknown as InternalGrid<T>;
    const colIndex = internalGrid._visibleColumns?.findIndex((c) => c.field === field);
    if (colIndex === -1 || colIndex === undefined) return;

    // Find the row element by rowId
    const rows = internalGrid._rows;
    const rowIndex = rows?.findIndex((r) => {
      try {
        return internalGrid.getRowId?.(r) === rowId;
      } catch {
        return false;
      }
    });
    if (rowIndex === -1 || rowIndex === undefined) return;

    const rowEl = internalGrid.findRenderedRowElement?.(rowIndex);
    const cellEl = rowEl?.querySelector(`.cell[data-col="${colIndex}"]`) as HTMLElement | null;
    if (!cellEl) return;

    if (invalid) {
      cellEl.setAttribute('data-invalid', 'true');
      const message = this.#invalidCells.get(rowId)?.get(field);
      if (message) {
        cellEl.setAttribute('title', message);
      }
    } else {
      cellEl.removeAttribute('data-invalid');
      cellEl.removeAttribute('title');
    }
  }

  // #endregion

  /**
   * Reset all change tracking.
   * @param silent - If true, suppresses the `changed-rows-reset` event
   * @fires changed-rows-reset - Emitted when tracking is reset (unless silent)
   */
  resetChangedRows(silent?: boolean): void {
    const rows = this.changedRows;
    const ids = this.changedRowIds;
    this.#changedRowIds.clear();
    this.#syncGridEditState();

    if (!silent) {
      this.emit<ChangedRowsResetDetail<T>>('changed-rows-reset', { rows, ids });
    }

    // Clear visual indicators
    const internalGrid = this.grid as unknown as InternalGrid<T>;
    internalGrid._rowPool?.forEach((r) => r.classList.remove('changed'));
  }

  /**
   * Programmatically begin editing a cell.
   * @param rowIndex - Index of the row to edit
   * @param field - Field name of the column to edit
   * @fires cell-commit - Emitted when the cell value is committed (on blur or Enter)
   */
  beginCellEdit(rowIndex: number, field: string): void {
    const internalGrid = this.grid as unknown as InternalGrid<T>;
    const colIndex = internalGrid._visibleColumns.findIndex((c) => c.field === field);
    if (colIndex === -1) return;

    const column = internalGrid._visibleColumns[colIndex];
    if (!column?.editable) return;

    const rowEl = internalGrid.findRenderedRowElement?.(rowIndex);
    const cellEl = rowEl?.querySelector(`.cell[data-col="${colIndex}"]`) as HTMLElement | null;
    if (!cellEl) return;

    this.#beginCellEdit(rowIndex, colIndex, cellEl);
  }

  /**
   * Programmatically begin editing all editable cells in a row.
   * @param rowIndex - Index of the row to edit
   * @fires cell-commit - Emitted for each cell value that is committed
   * @fires row-commit - Emitted when focus leaves the row
   */
  beginBulkEdit(rowIndex: number): void {
    const internalGrid = this.grid as unknown as InternalGrid<T>;
    const editOn = this.config.editOn ?? internalGrid.effectiveConfig?.editOn;
    if (editOn === false) return;

    const hasEditableColumn = internalGrid._columns?.some((col) => col.editable);
    if (!hasEditableColumn) return;

    const rowEl = internalGrid.findRenderedRowElement?.(rowIndex);
    if (!rowEl) return;

    // Start row edit
    const rowData = internalGrid._rows[rowIndex];
    this.#startRowEdit(rowIndex, rowData);

    // Enter edit mode on all editable cells
    Array.from(rowEl.children).forEach((cell, i) => {
      const col = internalGrid._visibleColumns[i];
      if (col?.editable) {
        const cellEl = cell as HTMLElement;
        if (!cellEl.classList.contains('editing')) {
          this.#injectEditor(rowData, rowIndex, col, i, cellEl, true);
        }
      }
    });

    // Focus the first editable cell
    setTimeout(() => {
      let targetCell = rowEl.querySelector(`.cell[data-col="${internalGrid._focusCol}"]`);
      if (!targetCell?.classList.contains('editing')) {
        targetCell = rowEl.querySelector('.cell.editing');
      }
      if (targetCell?.classList.contains('editing')) {
        const editor = (targetCell as HTMLElement).querySelector(FOCUSABLE_EDITOR_SELECTOR) as HTMLElement | null;
        try {
          editor?.focus({ preventScroll: true });
        } catch {
          /* empty */
        }
      }
    }, 0);
  }

  /**
   * Commit the currently active row edit.
   * @fires row-commit - Emitted after the row edit is committed
   */
  commitActiveRowEdit(): void {
    if (this.#activeEditRow !== -1) {
      this.#exitRowEdit(this.#activeEditRow, false);
    }
  }

  /**
   * Cancel the currently active row edit.
   */
  cancelActiveRowEdit(): void {
    if (this.#activeEditRow !== -1) {
      this.#exitRowEdit(this.#activeEditRow, true);
    }
  }

  // #endregion

  // #region Internal Methods

  /**
   * Begin editing a single cell.
   */
  #beginCellEdit(rowIndex: number, colIndex: number, cellEl: HTMLElement): void {
    const internalGrid = this.grid as unknown as InternalGrid<T>;
    const rowData = internalGrid._rows[rowIndex];
    const column = internalGrid._visibleColumns[colIndex];

    if (!rowData || !column?.editable) return;
    if (cellEl.classList.contains('editing')) return;

    // Start row edit if not already
    if (this.#activeEditRow !== rowIndex) {
      this.#startRowEdit(rowIndex, rowData);
    }

    this.#activeEditCol = colIndex;
    this.#injectEditor(rowData, rowIndex, column, colIndex, cellEl, false);
  }

  /**
   * Handle Tab/Shift+Tab navigation while editing.
   * Moves to next/previous editable cell, staying in edit mode.
   * Wraps to next/previous row when reaching row boundaries.
   */
  #handleTabNavigation(forward: boolean): void {
    const internalGrid = this.grid as unknown as InternalGrid<T>;
    const rows = internalGrid._rows;
    const currentRow = this.#activeEditRow;

    // Get editable column indices
    const editableCols = internalGrid._visibleColumns.map((c, i) => (c.editable ? i : -1)).filter((i) => i >= 0);
    if (editableCols.length === 0) return;

    let row = currentRow;
    let col = internalGrid._focusCol;
    const currentIdx = editableCols.indexOf(col);

    if (forward) {
      if (currentIdx >= 0 && currentIdx < editableCols.length - 1) {
        // Next editable in same row
        col = editableCols[currentIdx + 1];
      } else if (row < rows.length - 1) {
        // First editable in next row
        this.#exitRowEdit(currentRow, false);
        row++;
        col = editableCols[0];
        internalGrid._focusRow = row;
        internalGrid._focusCol = col;
        this.beginBulkEdit(row);
        ensureCellVisible(internalGrid, { forceHorizontalScroll: true });
        return;
      }
      // else: at last cell of last row - stay put
    } else {
      if (currentIdx > 0) {
        // Previous editable in same row
        col = editableCols[currentIdx - 1];
      } else if (row > 0) {
        // Last editable in previous row
        this.#exitRowEdit(currentRow, false);
        row--;
        col = editableCols[editableCols.length - 1];
        internalGrid._focusRow = row;
        internalGrid._focusCol = col;
        this.beginBulkEdit(row);
        ensureCellVisible(internalGrid, { forceHorizontalScroll: true });
        return;
      }
      // else: at first cell of first row - stay put
    }

    // Update focus and move editor focus within same row
    internalGrid._focusCol = col;
    const rowEl = internalGrid.findRenderedRowElement?.(row);
    const cellEl = rowEl?.querySelector(`.cell[data-col="${col}"]`) as HTMLElement | null;
    if (cellEl?.classList.contains('editing')) {
      const editor = cellEl.querySelector(FOCUSABLE_EDITOR_SELECTOR) as HTMLElement | null;
      editor?.focus({ preventScroll: true });
    }
    ensureCellVisible(internalGrid, { forceHorizontalScroll: true });
  }

  /**
   * Sync the internal grid state with the plugin's editing state.
   */
  #syncGridEditState(): void {
    const internalGrid = this.grid as unknown as InternalGrid<T>;
    internalGrid._activeEditRows = this.#activeEditRow;
    internalGrid._rowEditSnapshots = this.#rowEditSnapshots;
  }

  /**
   * Snapshot original row data and mark as editing.
   */
  #startRowEdit(rowIndex: number, rowData: T): void {
    if (this.#activeEditRow !== rowIndex) {
      this.#rowEditSnapshots.set(rowIndex, { ...rowData });
      this.#activeEditRow = rowIndex;
      this.#syncGridEditState();
    }
  }

  /**
   * Exit editing for a row.
   */
  #exitRowEdit(rowIndex: number, revert: boolean): void {
    if (this.#activeEditRow !== rowIndex) return;

    const internalGrid = this.grid as unknown as InternalGrid<T>;
    const snapshot = this.#rowEditSnapshots.get(rowIndex);
    const current = internalGrid._rows[rowIndex];
    const rowEl = internalGrid.findRenderedRowElement?.(rowIndex);

    // Get row ID for change tracking
    let rowId: string | undefined;
    if (current) {
      try {
        rowId = internalGrid.getRowId?.(current);
      } catch {
        // Row has no ID - skip ID-based tracking
      }
    }

    // Collect and commit values from active editors before re-rendering
    if (!revert && rowEl && current) {
      const editingCells = rowEl.querySelectorAll('.cell.editing');
      editingCells.forEach((cell) => {
        const colIndex = Number((cell as HTMLElement).getAttribute('data-col'));
        if (isNaN(colIndex)) return;
        const col = internalGrid._visibleColumns[colIndex];
        if (!col) return;
        const input = cell.querySelector('input,textarea,select') as
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement
          | null;
        if (input) {
          const field = col.field as keyof T;
          const originalValue = current[field];
          const val = getInputValue(input, col, originalValue);
          if (originalValue !== val) {
            this.#commitCellValue(rowIndex, col, val, current);
          }
        }
      });
    }

    // Revert if requested
    if (revert && snapshot && current) {
      Object.keys(snapshot as object).forEach((k) => {
        (current as Record<string, unknown>)[k] = (snapshot as Record<string, unknown>)[k];
      });
      if (rowId) {
        this.#changedRowIds.delete(rowId);
        this.clearRowInvalid(rowId);
      }
    } else if (!revert && current) {
      // Compare snapshot vs current to detect if changes were made during THIS edit session
      const changedThisSession = this.#hasRowChanged(snapshot, current);

      // Check if this row has any cumulative changes (via ID tracking)
      // Fall back to session-based detection when no row ID is available
      const changed = rowId ? this.#changedRowIds.has(rowId) : changedThisSession;

      // Emit cancelable row-commit event
      const cancelled = this.emitCancelable<RowCommitDetail<T>>('row-commit', {
        rowIndex,
        rowId: rowId ?? '',
        row: current,
        oldValue: snapshot,
        newValue: current,
        changed,
        changedRows: this.changedRows,
        changedRowIds: this.changedRowIds,
      });

      // If consumer called preventDefault(), revert the row
      if (cancelled && snapshot) {
        Object.keys(snapshot as object).forEach((k) => {
          (current as Record<string, unknown>)[k] = (snapshot as Record<string, unknown>)[k];
        });
        if (rowId) {
          this.#changedRowIds.delete(rowId);
          this.clearRowInvalid(rowId);
        }
      } else if (!cancelled && changedThisSession && this.isAnimationEnabled) {
        // Animate the row only if changes were made during this edit session
        // (deferred to afterRender so the row element exists after re-render)
        this.#pendingRowAnimation = rowIndex;
      }
    }

    // Clear editing state
    this.#rowEditSnapshots.delete(rowIndex);
    this.#activeEditRow = -1;
    this.#activeEditCol = -1;
    this.#syncGridEditState();

    // Remove all editing cells for this row
    for (const cellKey of this.#editingCells) {
      if (cellKey.startsWith(`${rowIndex}:`)) {
        this.#editingCells.delete(cellKey);
      }
    }

    // Re-render the row to remove editors
    if (rowEl) {
      // Remove editing class and re-render cells
      rowEl.querySelectorAll('.cell.editing').forEach((cell) => {
        cell.classList.remove('editing');
        clearEditingState(cell.parentElement as RowElementInternal);
      });

      // Request grid re-render to restore cell content
      this.requestRender();
    }

    // Mark that focus should be restored after render completes
    this.#pendingFocusRestore = true;

    // If no render was scheduled (row not visible), restore focus immediately
    if (!rowEl) {
      this.#restoreCellFocus(internalGrid);
      this.#pendingFocusRestore = false;
    }
  }

  /**
   * Commit a single cell value change.
   * Uses ID-based change tracking for stability when rows are reordered.
   */
  #commitCellValue(rowIndex: number, column: ColumnConfig<T>, newValue: unknown, rowData: T): void {
    const field = column.field;
    if (!isSafePropertyKey(field)) return;
    const oldValue = (rowData as Record<string, unknown>)[field];
    if (oldValue === newValue) return;

    const internalGrid = this.grid as unknown as InternalGrid<T>;

    // Get row ID for change tracking (may not exist if getRowId not configured)
    let rowId: string | undefined;
    try {
      rowId = this.grid.getRowId(rowData);
    } catch {
      // Row has no ID - will still work but won't be tracked in changedRowIds
    }

    const firstTime = rowId ? !this.#changedRowIds.has(rowId) : true;

    // Create updateRow helper for cascade updates (noop if row has no ID)
    const updateRow: (changes: Partial<T>) => void = rowId
      ? (changes) => this.grid.updateRow(rowId!, changes as Record<string, unknown>, 'cascade')
      : noopUpdateRow;

    // Track whether setInvalid was called during event handling
    let invalidWasSet = false;

    // Create setInvalid callback for validation (noop if row has no ID)
    const setInvalid = rowId
      ? (message?: string) => {
          invalidWasSet = true;
          this.setInvalid(rowId!, field, message ?? '');
        }
      : () => {}; // eslint-disable-line @typescript-eslint/no-empty-function

    // Emit cancelable event BEFORE applying the value
    const cancelled = this.emitCancelable<CellCommitDetail<T>>('cell-commit', {
      row: rowData,
      rowId: rowId ?? '',
      field,
      oldValue,
      value: newValue,
      rowIndex,
      changedRows: this.changedRows,
      changedRowIds: this.changedRowIds,
      firstTimeForRow: firstTime,
      updateRow,
      setInvalid,
    });

    // If consumer called preventDefault(), abort the commit
    if (cancelled) return;

    // Clear any previous invalid state for this cell ONLY if setInvalid wasn't called
    // (if setInvalid was called, the handler wants it to remain invalid)
    if (rowId && !invalidWasSet && this.isCellInvalid(rowId, field)) {
      this.clearInvalid(rowId, field);
    }

    // Apply the value and mark row as changed
    (rowData as Record<string, unknown>)[field] = newValue;
    if (rowId) {
      this.#changedRowIds.add(rowId);
    }
    this.#syncGridEditState();

    // Notify other plugins (e.g., UndoRedoPlugin) about the committed edit
    this.emitPluginEvent('cell-edit-committed', {
      rowIndex,
      field,
      oldValue,
      newValue,
    });

    // Mark the row visually as changed (animation happens when row edit closes)
    const rowEl = internalGrid.findRenderedRowElement?.(rowIndex);
    if (rowEl) {
      rowEl.classList.add('changed');
    }
  }

  /**
   * Inject an editor into a cell.
   */
  #injectEditor(
    rowData: T,
    rowIndex: number,
    column: ColumnConfig<T>,
    colIndex: number,
    cell: HTMLElement,
    skipFocus: boolean,
  ): void {
    if (!column.editable) return;
    if (cell.classList.contains('editing')) return;

    // Get row ID for updateRow helper (may not exist)
    let rowId: string | undefined;
    try {
      rowId = this.grid.getRowId(rowData);
    } catch {
      // Row has no ID
    }

    // Create updateRow helper for cascade updates (noop if row has no ID)
    const updateRow: (changes: Partial<T>) => void = rowId
      ? (changes) => this.grid.updateRow(rowId!, changes as Record<string, unknown>, 'cascade')
      : noopUpdateRow;

    const originalValue = isSafePropertyKey(column.field)
      ? (rowData as Record<string, unknown>)[column.field]
      : undefined;

    cell.classList.add('editing');
    this.#editingCells.add(`${rowIndex}:${colIndex}`);

    const rowEl = cell.parentElement as RowElementInternal | null;
    if (rowEl) incrementEditingCount(rowEl);

    let editFinalized = false;
    const commit = (newValue: unknown) => {
      if (editFinalized || this.#activeEditRow === -1) return;
      this.#commitCellValue(rowIndex, column, newValue, rowData);
    };
    const cancel = () => {
      editFinalized = true;
      if (isSafePropertyKey(column.field)) {
        (rowData as Record<string, unknown>)[column.field] = originalValue;
      }
    };

    const editorHost = document.createElement('div');
    editorHost.className = 'tbw-editor-host';
    cell.innerHTML = '';
    cell.appendChild(editorHost);

    // Keydown handler for Enter/Escape
    editorHost.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.stopPropagation();
        e.preventDefault();
        editFinalized = true;
        this.#exitRowEdit(rowIndex, false);
      }
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        cancel();
        this.#exitRowEdit(rowIndex, true);
      }
    });

    const colInternal = column as ColumnInternal<T>;
    const tplHolder = colInternal.__editorTemplate;
    // Resolve editor using priority chain: column → template → typeDefaults → adapter → built-in
    const editorSpec = resolveEditor(this.grid as unknown as InternalGrid<T>, colInternal) ?? defaultEditorFor(column);
    const value = originalValue;

    if (editorSpec === 'template' && tplHolder) {
      this.#renderTemplateEditor(editorHost, colInternal, rowData, originalValue, commit, cancel, skipFocus, rowIndex);
    } else if (typeof editorSpec === 'string') {
      const el = document.createElement(editorSpec) as HTMLElement & { value?: unknown };
      el.value = value;
      el.addEventListener('change', () => commit(el.value));
      editorHost.appendChild(el);
      if (!skipFocus) {
        queueMicrotask(() => {
          const focusable = editorHost.querySelector(FOCUSABLE_EDITOR_SELECTOR) as HTMLElement | null;
          focusable?.focus({ preventScroll: true });
        });
      }
    } else if (typeof editorSpec === 'function') {
      const ctx: EditorContext<T> = {
        row: rowData,
        rowId: rowId ?? '',
        value,
        field: column.field,
        column,
        commit,
        cancel,
        updateRow,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const produced = (editorSpec as any)(ctx);
      if (typeof produced === 'string') {
        editorHost.innerHTML = produced;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        wireEditorInputs(editorHost, column as any, commit, originalValue);
      } else if (produced instanceof Node) {
        editorHost.appendChild(produced);
      }
      if (!skipFocus) {
        queueMicrotask(() => {
          const focusable = editorHost.querySelector(FOCUSABLE_EDITOR_SELECTOR) as HTMLElement | null;
          focusable?.focus({ preventScroll: true });
        });
      }
    } else if (editorSpec && typeof editorSpec === 'object') {
      const placeholder = document.createElement('div');
      placeholder.setAttribute('data-external-editor', '');
      placeholder.setAttribute('data-field', column.field);
      editorHost.appendChild(placeholder);
      const context: EditorContext<T> = {
        row: rowData,
        rowId: rowId ?? '',
        value,
        field: column.field,
        column,
        commit,
        cancel,
        updateRow,
      };
      if (editorSpec.mount) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          editorSpec.mount({ placeholder, context: context as any, spec: editorSpec });
        } catch (e) {
          console.warn(`[tbw-grid] External editor mount error for column '${column.field}':`, e);
        }
      } else {
        (this.grid as unknown as HTMLElement).dispatchEvent(
          new CustomEvent('mount-external-editor', { detail: { placeholder, spec: editorSpec, context } }),
        );
      }
    }
  }

  /**
   * Render a template-based editor.
   */
  #renderTemplateEditor(
    editorHost: HTMLElement,
    column: ColumnInternal<T>,
    rowData: T,
    originalValue: unknown,
    commit: (value: unknown) => void,
    cancel: () => void,
    skipFocus: boolean,
    rowIndex: number,
  ): void {
    const tplHolder = column.__editorTemplate;
    if (!tplHolder) return;

    const clone = tplHolder.cloneNode(true) as HTMLElement;
    const compiledEditor = column.__compiledEditor;

    if (compiledEditor) {
      clone.innerHTML = compiledEditor({
        row: rowData,
        value: originalValue,
        field: column.field,
        column,
        commit,
        cancel,
      });
    } else {
      clone.querySelectorAll<HTMLElement>('*').forEach((node) => {
        if (node.childNodes.length === 1 && node.firstChild?.nodeType === Node.TEXT_NODE) {
          node.textContent =
            node.textContent
              ?.replace(/{{\s*value\s*}}/g, originalValue == null ? '' : String(originalValue))
              .replace(/{{\s*row\.([a-zA-Z0-9_]+)\s*}}/g, (_m, g: string) => {
                if (!isSafePropertyKey(g)) return '';
                const v = (rowData as Record<string, unknown>)[g];
                return v == null ? '' : String(v);
              }) || '';
        }
      });
    }

    const input = clone.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input,textarea,select',
    );
    if (input) {
      if (input instanceof HTMLInputElement && input.type === 'checkbox') {
        input.checked = !!originalValue;
      } else {
        input.value = String(originalValue ?? '');
      }

      let editFinalized = false;
      input.addEventListener('blur', () => {
        if (editFinalized) return;
        commit(getInputValue(input, column, originalValue));
      });
      input.addEventListener('keydown', (evt) => {
        const e = evt as KeyboardEvent;
        if (e.key === 'Enter') {
          e.stopPropagation();
          e.preventDefault();
          editFinalized = true;
          commit(getInputValue(input, column, originalValue));
          this.#exitRowEdit(rowIndex, false);
        }
        if (e.key === 'Escape') {
          e.stopPropagation();
          e.preventDefault();
          cancel();
          this.#exitRowEdit(rowIndex, true);
        }
      });
      if (input instanceof HTMLInputElement && input.type === 'checkbox') {
        input.addEventListener('change', () => commit(input.checked));
      }
      if (!skipFocus) {
        setTimeout(() => input.focus({ preventScroll: true }), 0);
      }
    }
    editorHost.appendChild(clone);
  }

  /**
   * Compare snapshot vs current row to detect if any values changed during this edit session.
   * Uses shallow comparison of all properties.
   */
  #hasRowChanged(snapshot: T | undefined, current: T): boolean {
    if (!snapshot) return false;

    const snapshotObj = snapshot as Record<string, unknown>;
    const currentObj = current as Record<string, unknown>;

    // Check all keys in both objects
    const allKeys = new Set([...Object.keys(snapshotObj), ...Object.keys(currentObj)]);
    for (const key of allKeys) {
      if (snapshotObj[key] !== currentObj[key]) {
        return true;
      }
    }
    return false;
  }

  /**
   * Restore focus to cell after exiting edit mode.
   */
  #restoreCellFocus(internalGrid: InternalGrid<T>): void {
    queueMicrotask(() => {
      try {
        const rowIdx = internalGrid._focusRow;
        const colIdx = internalGrid._focusCol;
        const rowEl = internalGrid.findRenderedRowElement?.(rowIdx);
        if (rowEl) {
          Array.from(internalGrid._bodyEl.querySelectorAll('.cell-focus')).forEach((el) =>
            el.classList.remove('cell-focus'),
          );
          const cell = rowEl.querySelector(`.cell[data-row="${rowIdx}"][data-col="${colIdx}"]`) as HTMLElement | null;
          if (cell) {
            cell.classList.add('cell-focus');
            cell.setAttribute('aria-selected', 'true');
            if (!cell.hasAttribute('tabindex')) cell.setAttribute('tabindex', '-1');
            cell.focus({ preventScroll: true });
          }
        }
      } catch {
        /* empty */
      }
    });
  }

  // #endregion
}
