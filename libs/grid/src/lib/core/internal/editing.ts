/**
 * Editing Lifecycle Module
 *
 * Handles row/cell editing state, commit/cancel operations, and value persistence.
 */

import type { ColumnConfig, InternalGrid } from '../types';
import { defaultEditorFor } from './editors';
import { renderInlineRow } from './rows';

/**
 * Snapshot original row data and mark the row as actively being edited.
 */
export function startRowEdit(grid: InternalGrid, rowIndex: number, rowData: any): void {
  if (grid.activeEditRows !== rowIndex) {
    grid.rowEditSnapshots.set(rowIndex, { ...rowData });
    grid.activeEditRows = rowIndex;
  }
}

/**
 * Finish editing for a row. If `revert` is true restore original snapshot and clear change marks.
 * Otherwise emit a row-commit event describing change status.
 */
export function exitRowEdit(grid: InternalGrid, rowIndex: number, revert: boolean): void {
  if (grid.activeEditRows !== rowIndex) return;
  const snapshot = grid.rowEditSnapshots.get(rowIndex);
  const current = grid._rows[rowIndex];
  if (revert && snapshot && current) {
    Object.keys(snapshot).forEach((k) => (current[k] = snapshot[k]));
    grid._changedRowIndices.delete(rowIndex);
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
      })
    );
  }
  grid.rowEditSnapshots.delete(rowIndex);
  grid.activeEditRows = -1;
  const rowEl = grid.findRenderedRowElement?.(rowIndex);
  if (rowEl) {
    renderInlineRow(grid, rowEl, grid._rows[rowIndex], rowIndex);
    if (grid._changedRowIndices.has(rowIndex)) rowEl.classList.add('changed');
    else rowEl.classList.remove('changed');
  }
  if (revert) {
    queueMicrotask(() => {
      try {
        (grid as unknown as HTMLElement).focus();
        const rowIdx = grid.focusRow;
        const colIdx = grid.focusCol;
        const rowEl2 = grid.findRenderedRowElement?.(rowIdx);
        if (rowEl2) {
          Array.from(grid.bodyEl.querySelectorAll('.cell-focus')).forEach((el: any) =>
            el.classList.remove('cell-focus')
          );
          const cell = rowEl2.querySelector(`.cell[data-row="${rowIdx}"][data-col="${colIdx}"]`);
          if (cell) (cell as HTMLElement).classList.add('cell-focus');
        }
      } catch {
        /* empty */
      }
    });
  }
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
  rowData: any
): void {
  const field = column.field;
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
    })
  );
}

/**
 * Replace a cell's content with an editor resolved from column configuration (custom editor, template, external
 * mount spec or default editor by type). Manages commit / cancel lifecycle and value restoration.
 */
export function inlineEnterEdit(
  grid: InternalGrid,
  rowData: any,
  rowIndex: number,
  column: ColumnConfig<any>,
  cell: HTMLElement
): void {
  if (!column.editable) return;
  if (grid.activeEditRows !== rowIndex) startRowEdit(grid, rowIndex, rowData);
  if (cell.classList.contains('editing')) return;
  const originalValue = rowData[column.field];
  cell.classList.add('editing');
  const commit = (newValue: any) => {
    commitCellValue(grid, rowIndex, column, newValue, rowData);
  };
  const cancel = () => {
    rowData[column.field] = originalValue;
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
        const val =
          hasHTMLInput && input instanceof HTMLInputElement && input.type === 'checkbox'
            ? input.checked
            : (input as any).value;
        commit(val);
      });
      input.addEventListener('keydown', (e: any) => {
        if (e.key === 'Enter') {
          const val =
            hasHTMLInput && input instanceof HTMLInputElement && input.type === 'checkbox'
              ? input.checked
              : (input as any).value;
          commit(val);
        }
        if (e.key === 'Escape') cancel();
      });
      if (hasHTMLInput && input instanceof HTMLInputElement && input.type === 'checkbox') {
        input.addEventListener('change', () => {
          const val = input.checked;
          commit(val);
        });
      }
      setTimeout(() => input.focus(), 0);
    }
    editorHost.appendChild(clone);
  } else if (typeof editorSpec === 'string') {
    const el = document.createElement(editorSpec);
    (el as any).value = value;
    el.addEventListener('change', () => commit((el as any).value));
    editorHost.appendChild(el);
  } else if (typeof editorSpec === 'function') {
    const produced = editorSpec({ row: rowData, value, field: column.field, column, commit, cancel });
    if (typeof produced === 'string') editorHost.innerHTML = produced;
    else editorHost.appendChild(produced);
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
        new CustomEvent('mount-external-editor', { detail: { placeholder, spec: editorSpec, context } })
      );
    }
  }
}
