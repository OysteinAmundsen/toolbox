/**
 * Editing Lifecycle Module
 *
 * Handles row/cell editing state, commit/cancel operations, and value persistence.
 */

import type { ColumnConfig, InternalGrid } from '../types';
import { defaultEditorFor } from './editors';
import { invalidateCellCache, renderInlineRow } from './rows';

/**
 * CSS selector for focusable editor elements within a cell.
 * Used by multiple modules to find and focus the active editor.
 */
export const FOCUSABLE_EDITOR_SELECTOR =
  'input,select,textarea,[contenteditable="true"],[contenteditable=""],[tabindex]:not([tabindex="-1"])';

/**
 * Returns true if the given property key is safe to use on a plain object without risking
 * prototype pollution via special names like "__proto__", "constructor", or "prototype".
 */
function isSafePropertyKey(key: any): boolean {
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') return false;
  return true;
}

/**
 * Check if a row element has any cells in editing mode.
 * Uses a cached count on the row element for O(1) lookup instead of querySelector.
 */
export function hasEditingCells(rowEl: HTMLElement): boolean {
  return ((rowEl as any).__editingCellCount ?? 0) > 0;
}

/**
 * Increment the editing cell count on a row element.
 * Called when a cell enters edit mode.
 */
function incrementEditingCount(rowEl: HTMLElement): void {
  const count = ((rowEl as any).__editingCellCount ?? 0) + 1;
  (rowEl as any).__editingCellCount = count;
  rowEl.setAttribute('data-has-editing', '');
}

/**
 * Decrement the editing cell count on a row element.
 * Called when a cell exits edit mode.
 */
function decrementEditingCount(rowEl: HTMLElement): void {
  const count = Math.max(0, ((rowEl as any).__editingCellCount ?? 0) - 1);
  (rowEl as any).__editingCellCount = count;
  if (count === 0) {
    rowEl.removeAttribute('data-has-editing');
  }
}

/**
 * Clear all editing state from a row element.
 * Called when the row is recycled or fully re-rendered.
 */
export function clearEditingState(rowEl: HTMLElement): void {
  (rowEl as any).__editingCellCount = 0;
  rowEl.removeAttribute('data-has-editing');
}

/**
 * Auto-wire commit/cancel lifecycle for input elements in string-returned editors.
 * This enables the simple syntax: `editor: (ctx) => `<input value="${ctx.value}" />`
 * by automatically handling blur→commit, Enter→commit, Escape→cancel.
 *
 * Note: editFinalized is passed by reference effect (closure) - when the outer
 * code sets editFinalized=true, the handlers here see it.
 */
function wireEditorInputs(
  editorHost: HTMLElement,
  column: ColumnConfig<any>,
  commit: (value: any) => void,
  cancel: () => void,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _editFinalizedRef: boolean,
): void {
  const input = editorHost.querySelector('input,textarea,select') as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement
    | null;
  if (!input) return;

  const getInputValue = (): any => {
    if (input instanceof HTMLInputElement) {
      if (input.type === 'checkbox') return input.checked;
      if (input.type === 'number') return input.value === '' ? null : Number(input.value);
      if (input.type === 'date') return input.valueAsDate;
    }
    // For select and textarea, convert to number if column type requires
    if (column.type === 'number' && (input as any).value !== '') {
      return Number((input as any).value);
    }
    return (input as any).value;
  };

  // Blur commits value (unless already handled by Enter/Escape)
  input.addEventListener('blur', () => {
    commit(getInputValue());
  });

  // Change event for checkboxes and selects
  if (input instanceof HTMLInputElement && input.type === 'checkbox') {
    input.addEventListener('change', () => commit(input.checked));
  } else if (input instanceof HTMLSelectElement) {
    input.addEventListener('change', () => commit(getInputValue()));
  }
}

/**
 * Snapshot original row data and mark the row as actively being edited.
 */
export function startRowEdit(grid: InternalGrid, rowIndex: number, rowData: any): void {
  if (grid._activeEditRows !== rowIndex) {
    grid._rowEditSnapshots.set(rowIndex, { ...rowData });
    grid._activeEditRows = rowIndex;
  }
}

/**
 * Finish editing for a row. If `revert` is true restore original snapshot and clear change marks.
 * Otherwise emit a row-commit event describing change status.
 */
export function exitRowEdit(grid: InternalGrid, rowIndex: number, revert: boolean): void {
  if (grid._activeEditRows !== rowIndex) return;
  const snapshot = grid._rowEditSnapshots.get(rowIndex);
  const current = grid._rows[rowIndex];

  // Before re-rendering, collect and commit values from any active editors
  // This ensures values are persisted even if blur hasn't fired yet
  const rowEl = grid.findRenderedRowElement?.(rowIndex);
  if (!revert && rowEl && current) {
    const editingCells = rowEl.querySelectorAll('.cell.editing');
    editingCells.forEach((cell) => {
      const colIndex = Number((cell as HTMLElement).getAttribute('data-col'));
      if (isNaN(colIndex)) return;
      const col = grid._visibleColumns[colIndex];
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
          // Convert to number for number columns
          if (col.type === 'number' && val !== '') {
            val = Number(val);
          }
        }
        // Only commit if value actually changed
        if (current[col.field] !== val) {
          commitCellValue(grid, rowIndex, col, val, current);
        }
      }
    });
  }

  if (revert && snapshot && current) {
    Object.keys(snapshot).forEach((k) => (current[k] = snapshot[k]));
    grid._changedRowIndices.delete(rowIndex);
    // Invalidate cell cache so reverted values display correctly
    invalidateCellCache(grid);
  } else if (!revert) {
    const changed = grid._changedRowIndices.has(rowIndex);
    (grid as unknown as HTMLElement).dispatchEvent(
      new CustomEvent('row-commit', {
        detail: {
          rowIndex,
          row: current,
          changed,
          changedRows: grid.changedRows,
          changedRowIndices: grid.changedRowIndices,
        },
      }),
    );
  }
  grid._rowEditSnapshots.delete(rowIndex);
  grid._activeEditRows = -1;
  if (rowEl) {
    renderInlineRow(grid, rowEl, grid._rows[rowIndex], rowIndex);
    if (grid._changedRowIndices.has(rowIndex)) rowEl.classList.add('changed');
    else rowEl.classList.remove('changed');
  }
  // Restore focus to the cell after exiting edit mode (for both commit and revert)
  queueMicrotask(() => {
    try {
      const rowIdx = grid._focusRow;
      const colIdx = grid._focusCol;
      const rowEl2 = grid.findRenderedRowElement?.(rowIdx);
      if (rowEl2) {
        // Clear all cell-focus markers
        Array.from(grid._bodyEl.querySelectorAll('.cell-focus')).forEach((el: any) =>
          el.classList.remove('cell-focus'),
        );
        // Find and focus the cell
        const cell = rowEl2.querySelector(`.cell[data-row="${rowIdx}"][data-col="${colIdx}"]`) as HTMLElement | null;
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

/**
 * Commit a single cell value change, updating the row object, marking the row as changed (first-time flag),
 * and emitting a `cell-commit` event with row + field metadata.
 */
export function commitCellValue(
  grid: InternalGrid,
  rowIndex: number,
  column: ColumnConfig<any>,
  newValue: any,
  rowData: any,
): void {
  const field = column.field;
  if (!isSafePropertyKey(field)) return;
  const oldValue = rowData[field];
  if (oldValue === newValue) return;
  rowData[field] = newValue;
  const firstTime = !grid._changedRowIndices.has(rowIndex);
  grid._changedRowIndices.add(rowIndex);
  const rowEl = grid.findRenderedRowElement?.(rowIndex);
  if (rowEl) rowEl.classList.add('changed');
  (grid as unknown as HTMLElement).dispatchEvent(
    new CustomEvent('cell-commit', {
      detail: {
        row: rowData,
        field,
        value: newValue,
        rowIndex,
        changedRows: grid.changedRows,
        changedRowIndices: grid.changedRowIndices,
        firstTimeForRow: firstTime,
      },
    }),
  );
}

/**
 * Replace a cell's content with an editor resolved from column configuration (custom editor, template, external
 * mount spec or default editor by type). Manages commit / cancel lifecycle and value restoration.
 *
 * @param skipFocus - When true, don't auto-focus the editor. Used when creating multiple editors
 *                    at once (e.g., beginBulkEdit) so the caller can control focus.
 */
export function inlineEnterEdit(
  grid: InternalGrid,
  rowData: any,
  rowIndex: number,
  column: ColumnConfig<any>,
  cell: HTMLElement,
  skipFocus = false,
): void {
  if (!column.editable) return;
  if (grid._activeEditRows !== rowIndex) startRowEdit(grid, rowIndex, rowData);
  if (cell.classList.contains('editing')) return;
  const originalValue = isSafePropertyKey(column.field) ? rowData[column.field] : undefined;
  cell.classList.add('editing');

  // Track editing state on the row element for fast O(1) lookup
  const rowEl = cell.parentElement;
  if (rowEl) incrementEditingCount(rowEl);

  let editFinalized = false; // Flag to prevent blur from committing after explicit Enter/Escape
  const commit = (newValue: any) => {
    // Skip if edit was already finalized by Enter/Escape, or if we've exited edit mode
    // (handles bulk edit case where one cell's exit removes all editors)
    if (editFinalized || grid._activeEditRows === -1) return;
    commitCellValue(grid, rowIndex, column, newValue, rowData);
  };
  const cancel = () => {
    editFinalized = true; // Mark as finalized to prevent blur from re-committing
    rowData[column.field] = isSafePropertyKey(column.field) ? originalValue : undefined;
    const inputLike = cell.querySelector('input,textarea,select') as any;
    if (inputLike) {
      const hasHTMLInput = typeof HTMLInputElement !== 'undefined';
      if (hasHTMLInput && inputLike instanceof HTMLInputElement && inputLike.type === 'checkbox')
        inputLike.checked = !!originalValue;
      else if ('value' in inputLike) inputLike.value = originalValue ?? '';
    }
  };
  const editorHost = document.createElement('div');
  editorHost.style.display = 'contents';
  cell.innerHTML = '';
  cell.appendChild(editorHost);

  // Common keydown handler for all editor types to handle Enter/Escape with proper exit
  // This catches events that bubble up from child elements (default editors, custom editors)
  editorHost.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
      e.preventDefault();
      editFinalized = true; // Prevent blur from committing again
      // Value should already be committed by the editor's own handler
      // Just need to exit edit mode
      exitRowEdit(grid, rowIndex, false);
    }
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      cancel(); // cancel() sets editFinalized = true
      exitRowEdit(grid, rowIndex, true);
    }
  });

  const tplHolder = (column as any).__editorTemplate as HTMLElement | undefined;
  const editorSpec = (column as any).editor || (tplHolder ? 'template' : defaultEditorFor(column));
  const value = originalValue;
  if (editorSpec === 'template' && tplHolder) {
    const clone = tplHolder.cloneNode(true) as HTMLElement;
    const compiledEditor = (column as any).__compiledEditor as ((ctx: any) => string) | undefined;
    if (compiledEditor)
      clone.innerHTML = compiledEditor({ row: rowData, value: originalValue, field: column.field, column });
    else
      clone.querySelectorAll<HTMLElement>('*').forEach((node) => {
        if (node.childNodes.length === 1 && node.firstChild?.nodeType === Node.TEXT_NODE) {
          node.textContent =
            node.textContent
              ?.replace(/{{\s*value\s*}}/g, originalValue == null ? '' : String(originalValue))
              .replace(/{{\s*row\.([a-zA-Z0-9_]+)\s*}}/g, (_m, g) => {
                const v = (rowData as any)[g];
                return v == null ? '' : String(v);
              }) || '';
        }
      });
    const input = clone.querySelector('input,textarea,select') as HTMLInputElement | HTMLSelectElement | null;
    if (input) {
      const hasHTMLInput = typeof HTMLInputElement !== 'undefined';
      if (hasHTMLInput && input instanceof HTMLInputElement && input.type === 'checkbox')
        input.checked = !!originalValue;
      else if ('value' in input) (input as any).value = originalValue ?? '';
      input.addEventListener('blur', () => {
        // commit() will check editFinalized flag and skip if already handled
        const val =
          hasHTMLInput && input instanceof HTMLInputElement && input.type === 'checkbox'
            ? input.checked
            : (input as any).value;
        commit(val);
      });
      input.addEventListener('keydown', (e: any) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          e.preventDefault();
          editFinalized = true; // Prevent blur from committing again
          const val =
            hasHTMLInput && input instanceof HTMLInputElement && input.type === 'checkbox'
              ? input.checked
              : (input as any).value;
          commit(val);
          exitRowEdit(grid, rowIndex, false);
        }
        if (e.key === 'Escape') {
          e.stopPropagation();
          e.preventDefault();
          cancel(); // cancel() sets editFinalized = true
          exitRowEdit(grid, rowIndex, true);
        }
      });
      if (hasHTMLInput && input instanceof HTMLInputElement && input.type === 'checkbox') {
        input.addEventListener('change', () => {
          const val = input.checked;
          commit(val);
        });
      }
      if (!skipFocus) {
        setTimeout(() => input.focus({ preventScroll: true }), 0);
      }
    }
    editorHost.appendChild(clone);
  } else if (typeof editorSpec === 'string') {
    const el = document.createElement(editorSpec);
    (el as any).value = value;
    el.addEventListener('change', () => commit((el as any).value));
    editorHost.appendChild(el);
    // Focus the custom element editor after DOM insertion
    if (!skipFocus) {
      queueMicrotask(() => {
        const focusable = editorHost.querySelector(FOCUSABLE_EDITOR_SELECTOR) as HTMLElement | null;
        focusable?.focus({ preventScroll: true });
      });
    }
  } else if (typeof editorSpec === 'function') {
    const produced = editorSpec({ row: rowData, value, field: column.field, column, commit, cancel });
    if (typeof produced === 'string') {
      editorHost.innerHTML = produced;
      // Auto-wire commit/cancel for inputs in string-returned editors
      wireEditorInputs(editorHost, column, commit, cancel, editFinalized);
    } else {
      editorHost.appendChild(produced);
    }
    // Focus the editor after DOM insertion (editors no longer auto-focus)
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
    const context = { row: rowData, value, field: column.field, column, commit, cancel };
    if (editorSpec.mount) {
      try {
        editorSpec.mount({ placeholder, context, spec: editorSpec });
      } catch {
        /* empty */
      }
    } else {
      (grid as unknown as HTMLElement).dispatchEvent(
        new CustomEvent('mount-external-editor', { detail: { placeholder, spec: editorSpec, context } }),
      );
    }
  }
}

// ============================================================================
// Bulk Editing API
// ============================================================================
// These functions are extracted from grid.ts to reduce the god object size.
// Grid.ts delegates to these functions for all bulk editing operations.

/**
 * Emit a custom event from the grid element.
 */
function emitEvent(grid: InternalGrid, eventName: string, detail: any): void {
  (grid as unknown as HTMLElement).dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true }));
}

/**
 * Get all changed rows from the grid.
 * @param grid - The grid instance
 * @returns Array of changed row data objects
 */
export function getChangedRows<T>(grid: InternalGrid<T>): T[] {
  return Array.from(grid._changedRowIndices).map((i) => grid._rows[i]);
}

/**
 * Get indices of all changed rows.
 * @param grid - The grid instance
 * @returns Array of row indices that have been modified
 */
export function getChangedRowIndices(grid: InternalGrid): number[] {
  return Array.from(grid._changedRowIndices);
}

/**
 * Reset all changed row markers.
 * @param grid - The grid instance
 * @param silent - If true, don't emit the reset event
 */
export function resetChangedRows<T>(grid: InternalGrid<T>, silent?: boolean): void {
  grid._changedRowIndices.clear();
  if (!silent) {
    emitEvent(grid, 'changed-rows-reset', {
      rows: getChangedRows(grid),
      indices: getChangedRowIndices(grid),
    });
  }
  grid._rowPool.forEach((r) => r.classList.remove('changed'));
}

/**
 * Begin bulk editing for a row. Enters edit mode on all editable cells.
 * @param grid - The grid instance
 * @param rowIndex - The row index to start editing
 * @param callbacks - Grid callbacks for finding row elements
 */
export function beginBulkEdit<T>(
  grid: InternalGrid<T>,
  rowIndex: number,
  callbacks: { findRenderedRowElement: (rowIndex: number) => HTMLElement | null },
): void {
  // editOn: false disables all editing
  if ((grid as any).effectiveConfig?.editOn === false) return;

  // Check if any columns are editable - if not, skip edit mode entirely
  const hasEditableColumn = grid._columns.some((col) => col.editable);
  if (!hasEditableColumn) return;

  const rowData = grid._rows[rowIndex];
  startRowEdit(grid, rowIndex, rowData);

  // Enter edit mode on all editable cells in the row
  const rowEl = callbacks.findRenderedRowElement(rowIndex);
  if (rowEl) {
    Array.from(rowEl.children).forEach((cell, i) => {
      // Use visibleColumns to match the cell index - _columns may include hidden columns
      const col = grid._visibleColumns[i];
      if (col?.editable) {
        const cellEl = cell as HTMLElement;
        if (!cellEl.classList.contains('editing')) {
          // Skip auto-focus - we'll focus the correct editor below
          inlineEnterEdit(grid, rowData, rowIndex, col, cellEl, true);
        }
      }
    });

    // Focus the editor in the focused cell, or the first editable cell if focused cell is not editable
    // Use setTimeout to ensure custom editors have time to render their focusable elements
    setTimeout(() => {
      // First try the focused cell
      let targetCell = rowEl.querySelector(`.cell[data-col="${grid._focusCol}"]`);
      if (!targetCell?.classList.contains('editing')) {
        // Focused cell is not editable, find the first editable cell
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
}

/**
 * Commit the currently active row edit.
 * @param grid - The grid instance
 */
export function commitActiveRowEdit(grid: InternalGrid): void {
  if (grid._activeEditRows !== -1) {
    exitRowEdit(grid, grid._activeEditRows, false);
  }
}

/**
 * Cancel the currently active row edit, reverting to original values.
 * @param grid - The grid instance
 */
export function cancelActiveRowEdit(grid: InternalGrid): void {
  if (grid._activeEditRows !== -1) {
    exitRowEdit(grid, grid._activeEditRows, true);
  }
}
