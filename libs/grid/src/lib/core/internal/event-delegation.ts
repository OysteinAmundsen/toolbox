/**
 * Event Delegation Module
 *
 * Consolidates all delegated event handling for the grid.
 * Uses event delegation (single listener on container) rather than per-cell/per-row
 * listeners to minimize memory usage.
 *
 * This module provides:
 * - setupCellEventDelegation: Body-level handlers (mousedown, click, dblclick on cells/rows)
 * - setupRootEventDelegation: Root-level handlers (keydown, mousedown for plugins, drag tracking)
 *
 * Edit triggering is handled separately by the EditingPlugin via
 * onCellClick and onKeyDown hooks.
 */

import type { CellMouseEvent } from '../plugin/types';
import type { InternalGrid } from '../types';
import { handleGridKeyDown } from './keyboard';
import { handleRowClick } from './rows';
import { clearCellFocus, getColIndexFromCell, getRowIndexFromCell } from './utils';

// Track drag state per grid instance (avoids polluting InternalGrid interface)
const dragState = new WeakMap<InternalGrid, boolean>();

/**
 * Handle delegated mousedown on cells.
 * Updates focus position for navigation.
 *
 * IMPORTANT: This must NOT call refreshVirtualWindow or any function that
 * re-renders DOM elements. Doing so would replace the element the user clicked on,
 * causing the subsequent click event to fire on a detached element and not bubble
 * to parent handlers (like handleRowClick).
 *
 * For mouse interactions, the cell is already visible (user clicked on it),
 * so we only need to update focus state without scrolling or re-rendering.
 */
function handleCellMousedown(grid: InternalGrid, cell: HTMLElement): void {
  const rowIndex = getRowIndexFromCell(cell);
  const colIndex = getColIndexFromCell(cell);
  if (rowIndex < 0 || colIndex < 0) return;

  grid._focusRow = rowIndex;
  grid._focusCol = colIndex;

  // Update focus styling directly without triggering re-render.
  // ensureCellVisible() would call refreshVirtualWindow() which replaces DOM elements,
  // breaking the click event that follows this mousedown.
  clearCellFocus(grid._bodyEl);
  cell.classList.add('cell-focus');
  cell.setAttribute('aria-selected', 'true');
}

/**
 * Build a CellMouseEvent from a native MouseEvent.
 * Extracts cell/row information from the event target.
 */
function buildCellMouseEvent(
  grid: InternalGrid,
  renderRoot: HTMLElement,
  e: MouseEvent,
  type: 'mousedown' | 'mousemove' | 'mouseup',
): CellMouseEvent {
  // For document-level events (mousemove/mouseup during drag), e.target won't be inside shadow DOM.
  // Use composedPath to find elements inside shadow roots, or fall back to elementFromPoint.
  let target: Element | null = null;

  // composedPath gives us the full path including shadow DOM elements
  const path = e.composedPath?.() as Element[] | undefined;
  if (path && path.length > 0) {
    target = path[0];
  } else {
    target = e.target as Element;
  }

  // If target is not inside our element (e.g., for document-level events),
  // use elementFromPoint to find the actual element under the mouse
  if (target && !renderRoot.contains(target)) {
    const elAtPoint = document.elementFromPoint(e.clientX, e.clientY);
    if (elAtPoint) {
      target = elAtPoint;
    }
  }

  // Cells have data-col and data-row attributes
  const cellEl = target?.closest?.('[data-col]') as HTMLElement | null;
  const rowEl = target?.closest?.('.data-grid-row') as HTMLElement | null;
  const headerEl = target?.closest?.('.header-row') as HTMLElement | null;

  let rowIndex: number | undefined;
  let colIndex: number | undefined;
  let row: unknown;
  let field: string | undefined;
  let value: unknown;
  let column: unknown;

  if (cellEl) {
    // Get indices from cell attributes
    rowIndex = parseInt(cellEl.getAttribute('data-row') ?? '-1', 10);
    colIndex = parseInt(cellEl.getAttribute('data-col') ?? '-1', 10);
    if (rowIndex >= 0 && colIndex >= 0) {
      row = grid._rows[rowIndex];
      column = grid._columns[colIndex];
      field = (column as { field?: string })?.field;
      value = row && field ? (row as Record<string, unknown>)[field] : undefined;
    }
  }

  return {
    type,
    row,
    rowIndex: rowIndex !== undefined && rowIndex >= 0 ? rowIndex : undefined,
    colIndex: colIndex !== undefined && colIndex >= 0 ? colIndex : undefined,
    field,
    value,
    column: column as CellMouseEvent['column'],
    originalEvent: e,
    cellElement: cellEl ?? undefined,
    rowElement: rowEl ?? undefined,
    isHeader: !!headerEl,
    cell:
      rowIndex !== undefined && colIndex !== undefined && rowIndex >= 0 && colIndex >= 0
        ? { row: rowIndex, col: colIndex }
        : undefined,
  };
}

/**
 * Handle mousedown events and dispatch to plugin system.
 */
function handleMouseDown(grid: InternalGrid, renderRoot: HTMLElement, e: MouseEvent): void {
  const event = buildCellMouseEvent(grid, renderRoot, e, 'mousedown');
  const handled = grid._dispatchCellMouseDown?.(event) ?? false;

  // If any plugin handled mousedown, start tracking for drag
  if (handled) {
    dragState.set(grid, true);
  }
}

/**
 * Handle mousemove events (only when dragging).
 */
function handleMouseMove(grid: InternalGrid, renderRoot: HTMLElement, e: MouseEvent): void {
  if (!dragState.get(grid)) return;

  const event = buildCellMouseEvent(grid, renderRoot, e, 'mousemove');
  grid._dispatchCellMouseMove?.(event);
}

/**
 * Handle mouseup events.
 */
function handleMouseUp(grid: InternalGrid, renderRoot: HTMLElement, e: MouseEvent): void {
  if (!dragState.get(grid)) return;

  const event = buildCellMouseEvent(grid, renderRoot, e, 'mouseup');
  grid._dispatchCellMouseUp?.(event);
  dragState.set(grid, false);
}

/**
 * Set up delegated event listeners on the grid body.
 * Consolidates all row/cell mouse event handling into a single set of listeners.
 * Call once during grid initialization.
 *
 * Benefits:
 * - 3 listeners total vs N*2 listeners (where N = pool size)
 * - Consistent event handling across all rows
 * - Automatic cleanup via AbortController signal
 *
 * @param grid - The grid instance
 * @param bodyEl - The .rows element containing all data rows
 * @param signal - AbortSignal for cleanup
 */
export function setupCellEventDelegation(grid: InternalGrid, bodyEl: HTMLElement, signal: AbortSignal): void {
  // Mousedown - update focus on any cell (not just editable)
  bodyEl.addEventListener(
    'mousedown',
    (e) => {
      const cell = (e.target as HTMLElement).closest('.cell[data-col]') as HTMLElement | null;
      if (!cell) return;

      // Skip if clicking inside an editing cell (let the editor handle it)
      if (cell.classList.contains('editing')) return;

      handleCellMousedown(grid, cell);
    },
    { signal },
  );

  // Click - handle row/cell click interactions
  bodyEl.addEventListener(
    'click',
    (e) => {
      const rowEl = (e.target as HTMLElement).closest('.data-grid-row') as HTMLElement | null;
      if (rowEl) handleRowClick(grid, e as MouseEvent, rowEl);
    },
    { signal },
  );

  // Dblclick - same handler as click (edit triggering handled by EditingPlugin)
  bodyEl.addEventListener(
    'dblclick',
    (e) => {
      const rowEl = (e.target as HTMLElement).closest('.data-grid-row') as HTMLElement | null;
      if (rowEl) handleRowClick(grid, e as MouseEvent, rowEl);
    },
    { signal },
  );
}

/**
 * Set up root-level and document-level event listeners.
 * These are added once per grid lifetime (not re-attached on DOM recreation).
 *
 * Includes:
 * - keydown: Keyboard navigation (arrows, Enter, Escape)
 * - mousedown: Plugin dispatch for cell interactions
 * - mousemove/mouseup: Global drag tracking
 *
 * @param grid - The grid instance
 * @param gridElement - The grid element (for keydown)
 * @param renderRoot - The render root element (for mousedown)
 * @param signal - AbortSignal for cleanup
 */
export function setupRootEventDelegation(
  grid: InternalGrid,
  gridElement: HTMLElement,
  renderRoot: HTMLElement,
  signal: AbortSignal,
): void {
  // Element-level keydown handler for keyboard navigation
  gridElement.addEventListener('keydown', (e) => handleGridKeyDown(grid, e), { signal });

  // Central mouse event handling for plugins
  renderRoot.addEventListener('mousedown', (e) => handleMouseDown(grid, renderRoot, e as MouseEvent), { signal });

  // Track global mousemove/mouseup for drag operations (column resize, selection, etc.)
  document.addEventListener('mousemove', (e: MouseEvent) => handleMouseMove(grid, renderRoot, e), { signal });
  document.addEventListener('mouseup', (e: MouseEvent) => handleMouseUp(grid, renderRoot, e), { signal });
}
