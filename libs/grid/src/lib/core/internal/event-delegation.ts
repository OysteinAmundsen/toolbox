/**
 * Event Delegation Module
 *
 * Provides centralized event handling for grid cells using event delegation.
 * Instead of attaching 3-6 listeners per cell (30,000+ for large grids),
 * we attach a single listener per event type on the container.
 *
 * This dramatically reduces memory usage and improves initialization time.
 */

import type { ColumnConfig, InternalGrid } from '../types';
import { commitCellValue, FOCUSABLE_EDITOR_SELECTOR, inlineEnterEdit, startRowEdit } from './editing';
import { ensureCellVisible } from './keyboard';
import { booleanCellHTML, getColIndexFromCell, getRowIndexFromCell } from './utils';

/**
 * Extract cell context from a cell element.
 * Returns null if the cell is invalid or indices are missing.
 */
function getCellContext(
  grid: InternalGrid,
  cell: HTMLElement,
): { rowIndex: number; colIndex: number; rowData: any; col: ColumnConfig<any> } | null {
  const rowIndex = getRowIndexFromCell(cell);
  const colIndex = getColIndexFromCell(cell);
  if (rowIndex < 0 || colIndex < 0) return null;

  const rowData = grid._rows[rowIndex];
  const col = grid._visibleColumns[colIndex];
  if (!rowData || !col) return null;

  return { rowIndex, colIndex, rowData, col };
}

/**
 * Handle delegated mousedown on editable cells.
 * Updates focus position without starting edit.
 */
function handleCellMousedown(grid: InternalGrid, cell: HTMLElement): void {
  if (cell.classList.contains('editing')) return;

  const ctx = getCellContext(grid, cell);
  if (!ctx) return;

  grid._focusRow = ctx.rowIndex;
  grid._focusCol = ctx.colIndex;
  ensureCellVisible(grid);
}

/**
 * Handle delegated click on editable cells (editMode === 'click').
 */
function handleCellClick(grid: InternalGrid, cell: HTMLElement, e: MouseEvent): void {
  if (cell.classList.contains('editing')) return;

  const ctx = getCellContext(grid, cell);
  if (!ctx) return;

  e.stopPropagation();
  grid._focusRow = ctx.rowIndex;
  grid._focusCol = ctx.colIndex;
  inlineEnterEdit(grid, ctx.rowData, ctx.rowIndex, ctx.col, cell);
}

/**
 * Handle delegated dblclick on editable cells (editMode === 'dblClick').
 */
function handleCellDblclick(grid: InternalGrid, cell: HTMLElement, e: MouseEvent): void {
  e.stopPropagation();

  const ctx = getCellContext(grid, cell);
  if (!ctx) return;

  // Use beginBulkEdit if available for consistent behavior with Enter key
  if (typeof grid.beginBulkEdit === 'function') {
    grid._focusRow = ctx.rowIndex;
    grid._focusCol = ctx.colIndex;
    grid.beginBulkEdit(ctx.rowIndex);
    return;
  }

  // Fallback: manual edit initiation
  startRowEdit(grid, ctx.rowIndex, ctx.rowData);
  const rowEl = grid.findRenderedRowElement?.(ctx.rowIndex);
  if (rowEl) {
    const children = rowEl.children;
    for (let i = 0; i < children.length; i++) {
      const col2 = grid._visibleColumns[i];
      if (col2 && (col2 as any).editable) {
        inlineEnterEdit(grid, ctx.rowData, ctx.rowIndex, col2, children[i] as HTMLElement, true);
      }
    }
    // Focus the editor in the clicked cell
    queueMicrotask(() => {
      const targetCell = rowEl.querySelector(`.cell[data-col="${grid._focusCol}"]`);
      if (targetCell?.classList.contains('editing')) {
        const editor = (targetCell as HTMLElement).querySelector(FOCUSABLE_EDITOR_SELECTOR) as HTMLElement | null;
        try {
          editor?.focus({ preventScroll: true });
        } catch {
          /* empty */
        }
      }
    });
  }
}

/**
 * Handle delegated keydown on editable cells.
 * Handles Enter, F2, Space (for boolean), and select/typeahead special cases.
 */
function handleCellKeydown(grid: InternalGrid, cell: HTMLElement, e: KeyboardEvent): void {
  const ctx = getCellContext(grid, cell);
  if (!ctx) return;

  const { rowIndex, colIndex, rowData, col } = ctx;
  const isEditing = cell.classList.contains('editing');

  // Select/typeahead: Enter opens picker
  if ((col.type === 'select' || col.type === 'typeahead') && !isEditing && e.key === 'Enter') {
    e.preventDefault();
    if (grid._activeEditRows !== rowIndex) startRowEdit(grid, rowIndex, rowData);
    inlineEnterEdit(grid, rowData, rowIndex, col, cell);
    setTimeout(() => {
      const selectEl = cell.querySelector('select') as HTMLSelectElement | null;
      try {
        (selectEl as any)?.showPicker?.();
      } catch {
        /* empty */
      }
      selectEl?.focus({ preventScroll: true });
    }, 0);
    return;
  }

  // Boolean: Space toggles value
  if (col.type === 'boolean' && e.key === ' ' && !isEditing) {
    e.preventDefault();
    if (grid._activeEditRows !== rowIndex) startRowEdit(grid, rowIndex, rowData);
    const newVal = !rowData[col.field];
    commitCellValue(grid, rowIndex, col, newVal, rowData);
    cell.innerHTML = booleanCellHTML(!!newVal);
    return;
  }

  // Enter: Start editing
  if (e.key === 'Enter' && !isEditing) {
    e.preventDefault();
    e.stopPropagation();
    grid._focusRow = rowIndex;
    grid._focusCol = colIndex;
    if (typeof grid.beginBulkEdit === 'function') {
      grid.beginBulkEdit(rowIndex);
    } else {
      inlineEnterEdit(grid, rowData, rowIndex, col, cell);
    }
    return;
  }

  // F2: Start editing (alternative)
  if (e.key === 'F2' && !isEditing) {
    e.preventDefault();
    inlineEnterEdit(grid, rowData, rowIndex, col, cell);
    return;
  }
}

/**
 * Set up delegated event listeners on the grid body.
 * Call once during grid initialization.
 *
 * @param grid - The grid instance
 * @param bodyEl - The .rows element containing all data rows
 * @param signal - AbortSignal for cleanup
 */
export function setupCellEventDelegation(grid: InternalGrid, bodyEl: HTMLElement, signal: AbortSignal): void {
  const getEditMode = () => (grid as any).effectiveConfig?.editOn || (grid as any).editOn;

  // Mousedown - update focus on editable cells
  bodyEl.addEventListener(
    'mousedown',
    (e) => {
      const cell = (e.target as HTMLElement).closest('.cell[data-col]') as HTMLElement | null;
      if (!cell) return;

      // Check if this cell's column is editable
      const colIndex = getColIndexFromCell(cell);
      if (colIndex < 0) return;

      const col = grid._visibleColumns[colIndex];
      if (col && (col as any).editable) {
        handleCellMousedown(grid, cell);
      }
    },
    { signal },
  );

  // Click - for editMode === 'click'
  bodyEl.addEventListener(
    'click',
    (e) => {
      const editMode = getEditMode();
      if (editMode !== 'click') return;

      const cell = (e.target as HTMLElement).closest('.cell[data-col]') as HTMLElement | null;
      if (!cell) return;

      const colIndex = getColIndexFromCell(cell);
      if (colIndex < 0) return;

      const col = grid._visibleColumns[colIndex];
      if (col && (col as any).editable) {
        handleCellClick(grid, cell, e);
      }
    },
    { signal },
  );

  // Dblclick - for editMode === 'dblClick' (default)
  bodyEl.addEventListener(
    'dblclick',
    (e) => {
      const editMode = getEditMode();
      // Normalize: accept both 'dblClick' and 'dblclick'
      const normalized = editMode === 'dblclick' ? 'dblClick' : editMode;
      if (normalized === 'click' || editMode === false) return;

      const cell = (e.target as HTMLElement).closest('.cell[data-col]') as HTMLElement | null;
      if (!cell) return;

      const colIndex = getColIndexFromCell(cell);
      if (colIndex < 0) return;

      const col = grid._visibleColumns[colIndex];
      if (col && (col as any).editable) {
        handleCellDblclick(grid, cell, e);
      }
    },
    { signal },
  );

  // Keydown - for Enter, F2, Space on editable cells
  bodyEl.addEventListener(
    'keydown',
    (e) => {
      const cell = (e.target as HTMLElement).closest('.cell[data-col]') as HTMLElement | null;
      if (!cell) return;

      const colIndex = getColIndexFromCell(cell);
      if (colIndex < 0) return;

      const col = grid._visibleColumns[colIndex];
      if (col && (col as any).editable) {
        handleCellKeydown(grid, cell, e as KeyboardEvent);
      }
    },
    { signal },
  );
}
