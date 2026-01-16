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

import { BaseGridPlugin, type CellClickEvent, type GridElement } from '../../core/plugin/base-plugin';
import type { ColumnConfig, ColumnInternal, InternalGrid, RowElementInternal } from '../../core/types';
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
 * Auto-wire commit/cancel lifecycle for input elements in string-returned editors.
 */
function wireEditorInputs(
  editorHost: HTMLElement,
  column: ColumnConfig<unknown>,
  commit: (value: unknown) => void,
): void {
  const input = editorHost.querySelector('input,textarea,select') as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement
    | null;
  if (!input) return;

  const getInputValue = (): unknown => {
    if (input instanceof HTMLInputElement) {
      if (input.type === 'checkbox') return input.checked;
      if (input.type === 'number') return input.value === '' ? null : Number(input.value);
      if (input.type === 'date') return input.valueAsDate;
      return input.value;
    }
    if (column.type === 'number' && input.value !== '') {
      return Number(input.value);
    }
    return input.value;
  };

  input.addEventListener('blur', () => {
    commit(getInputValue());
  });

  if (input instanceof HTMLInputElement && input.type === 'checkbox') {
    input.addEventListener('change', () => commit(input.checked));
  } else if (input instanceof HTMLSelectElement) {
    input.addEventListener('change', () => commit(getInputValue()));
  }
}

// ============================================================================
// EditingPlugin
// ============================================================================

/**
 * Editing Plugin for tbw-grid
 *
 * Provides complete cell/row editing functionality. Without this plugin,
 * the grid has no editing capability.
 *
 * @example
 * ```ts
 * import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';
 *
 * const grid = document.createElement('tbw-grid');
 * grid.gridConfig = {
 *   columns: [
 *     { field: 'name', editable: true },
 *     { field: 'age', editable: true, type: 'number' }
 *   ],
 *   plugins: [new EditingPlugin({ editOn: 'dblclick' })]
 * };
 * ```
 */
export class EditingPlugin<T = unknown> extends BaseGridPlugin<EditingConfig> {
  readonly name = 'editing';
  override readonly version = '1.0.0';

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

  /** Set of row indices that have been modified */
  #changedRowIndices = new Set<number>();

  /** Set of cells currently in edit mode: "rowIndex:colIndex" */
  #editingCells = new Set<string>();

  /** Flag to restore focus after next render (used when exiting edit mode) */
  #pendingFocusRestore = false;

  // #endregion

  // #region Lifecycle

  override attach(grid: GridElement): void {
    super.attach(grid);

    const signal = this.disconnectSignal;
    const internalGrid = grid as unknown as InternalGrid<T>;

    // Inject editing state and methods onto grid for backward compatibility
    internalGrid._activeEditRows = -1;
    internalGrid._rowEditSnapshots = new Map();
    internalGrid._changedRowIndices = new Set();

    // Inject changedRows getter
    Object.defineProperty(grid, 'changedRows', {
      get: () => this.changedRows,
      configurable: true,
    });

    // Inject changedRowIndices getter
    Object.defineProperty(grid, 'changedRowIndices', {
      get: () => this.changedRowIndices,
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
    document.addEventListener(
      'mousedown',
      (e: MouseEvent) => {
        if (this.#activeEditRow === -1) return;
        const rowEl = internalGrid.findRenderedRowElement?.(this.#activeEditRow);
        if (!rowEl) return;
        const path = (e.composedPath && e.composedPath()) || [];
        if (path.includes(rowEl)) return;
        this.#exitRowEdit(this.#activeEditRow, false);
      },
      { signal },
    );
  }

  override detach(): void {
    this.#activeEditRow = -1;
    this.#activeEditCol = -1;
    this.#rowEditSnapshots.clear();
    this.#changedRowIndices.clear();
    this.#editingCells.clear();
    super.detach();
  }

  // #endregion

  // #region Config Augmentation (processColumns hook)

  /**
   * Augment columns with editing metadata.
   * This enables the grid to recognize editable columns without core knowledge.
   */
  override processColumns?(columns: readonly ColumnConfig<T>[]): ColumnConfig<T>[] {
    // For now, just pass through - the column config already has `editable` and `editor`
    // This hook could be used to inject default editors based on column type
    return columns as ColumnConfig<T>[];
  }

  // #endregion

  // #region Event Handlers (event distribution)

  /**
   * Handle cell clicks - start editing if configured for click mode.
   * Both click and dblclick events come through this handler.
   * Starts row-based editing (all editable cells in the row get editors).
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
   */
  override onKeyDown(event: KeyboardEvent): boolean | void {
    const internalGrid = this.grid as unknown as InternalGrid<T>;

    // Escape: cancel current edit
    if (event.key === 'Escape' && this.#activeEditRow !== -1) {
      this.#exitRowEdit(this.#activeEditRow, true);
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
      if (focusRow >= 0) {
        // Check if ANY column in the row is editable
        const hasEditableColumn = internalGrid._columns?.some((col) => col.editable);
        if (hasEditableColumn) {
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
   * After render, reapply editors to cells in edit mode.
   * This handles virtualization - when a row scrolls back into view,
   * we need to re-inject the editor.
   */
  override afterRender(): void {
    const internalGrid = this.grid as unknown as InternalGrid<T>;

    // Restore focus after exiting edit mode
    if (this.#pendingFocusRestore) {
      this.#pendingFocusRestore = false;
      this.#restoreCellFocus(internalGrid);
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
   */
  override onScrollRender(): void {
    this.afterRender();
  }

  // #endregion

  // #region Public API

  /**
   * Get all rows that have been modified.
   */
  get changedRows(): T[] {
    const internalGrid = this.grid as unknown as InternalGrid<T>;
    return Array.from(this.#changedRowIndices).map((i) => internalGrid._rows[i]);
  }

  /**
   * Get indices of all modified rows.
   */
  get changedRowIndices(): number[] {
    return Array.from(this.#changedRowIndices);
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
   */
  isRowChanged(rowIndex: number): boolean {
    return this.#changedRowIndices.has(rowIndex);
  }

  /**
   * Reset all change tracking.
   */
  resetChangedRows(silent?: boolean): void {
    const rows = this.changedRows;
    const indices = this.changedRowIndices;
    this.#changedRowIndices.clear();
    this.#syncGridEditState();

    if (!silent) {
      this.emit<ChangedRowsResetDetail<T>>('changed-rows-reset', { rows, indices });
    }

    // Clear visual indicators
    const internalGrid = this.grid as unknown as InternalGrid<T>;
    internalGrid._rowPool?.forEach((r) => r.classList.remove('changed'));
  }

  /**
   * Programmatically begin editing a cell.
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
   * Sync the internal grid state with the plugin's editing state.
   */
  #syncGridEditState(): void {
    const internalGrid = this.grid as unknown as InternalGrid<T>;
    internalGrid._activeEditRows = this.#activeEditRow;
    internalGrid._rowEditSnapshots = this.#rowEditSnapshots;
    internalGrid._changedRowIndices = this.#changedRowIndices;
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
          let val: unknown;
          if (input instanceof HTMLInputElement && input.type === 'checkbox') {
            val = input.checked;
          } else {
            val = input.value;
            if (col.type === 'number' && val !== '') {
              val = Number(val);
            }
          }
          if (current[col.field as keyof T] !== val) {
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
      this.#changedRowIndices.delete(rowIndex);
    } else if (!revert) {
      const changed = this.#changedRowIndices.has(rowIndex);
      this.emit<RowCommitDetail<T>>('row-commit', {
        rowIndex,
        row: current,
        changed,
        changedRows: this.changedRows,
        changedRowIndices: this.changedRowIndices,
      });
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
   */
  #commitCellValue(rowIndex: number, column: ColumnConfig<T>, newValue: unknown, rowData: T): void {
    const field = column.field;
    if (!isSafePropertyKey(field)) return;
    const oldValue = (rowData as Record<string, unknown>)[field];
    if (oldValue === newValue) return;

    (rowData as Record<string, unknown>)[field] = newValue;
    const firstTime = !this.#changedRowIndices.has(rowIndex);
    this.#changedRowIndices.add(rowIndex);
    this.#syncGridEditState();

    const internalGrid = this.grid as unknown as InternalGrid<T>;
    const rowEl = internalGrid.findRenderedRowElement?.(rowIndex);
    if (rowEl) rowEl.classList.add('changed');

    this.emit<CellCommitDetail<T>>('cell-commit', {
      row: rowData,
      field,
      value: newValue,
      rowIndex,
      changedRows: this.changedRows,
      changedRowIndices: this.changedRowIndices,
      firstTimeForRow: firstTime,
    });
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
    const editorSpec = colInternal.editor || (tplHolder ? 'template' : defaultEditorFor(column));
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
      const ctx: EditorContext<T> = { row: rowData, value, field: column.field, column, commit, cancel };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const produced = (editorSpec as any)(ctx);
      if (typeof produced === 'string') {
        editorHost.innerHTML = produced;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        wireEditorInputs(editorHost, column as any, commit);
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
      const internalGrid = this.grid as unknown as InternalGrid<T>;
      const placeholder = document.createElement('div');
      placeholder.setAttribute('data-external-editor', '');
      placeholder.setAttribute('data-field', column.field);
      editorHost.appendChild(placeholder);
      const context: EditorContext<T> = { row: rowData, value, field: column.field, column, commit, cancel };
      if (editorSpec.mount) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          editorSpec.mount({ placeholder, context: context as any, spec: editorSpec });
        } catch (e) {
          console.warn(`[tbw-grid] External editor mount error for column '${column.field}':`, e);
        }
      } else {
        (internalGrid as unknown as HTMLElement).dispatchEvent(
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
        const val = input instanceof HTMLInputElement && input.type === 'checkbox' ? input.checked : input.value;
        commit(val);
      });
      input.addEventListener('keydown', (evt) => {
        const e = evt as KeyboardEvent;
        if (e.key === 'Enter') {
          e.stopPropagation();
          e.preventDefault();
          editFinalized = true;
          const val = input instanceof HTMLInputElement && input.type === 'checkbox' ? input.checked : input.value;
          commit(val);
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
