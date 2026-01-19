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

import type { InternalGrid } from '../types';
import { handleGridKeyDown } from './keyboard';
import { handleRowClick } from './rows';
import { clearCellFocus, getColIndexFromCell, getRowIndexFromCell } from './utils';

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
 * Handlers for root-level event delegation.
 * These are passed from the grid instance since they reference private methods.
 */
export interface RootEventHandlers {
  /** Handle mousedown on the grid root (for plugin dispatch) */
  onMouseDown: (e: MouseEvent) => void;
  /** Handle global mousemove (for drag operations) */
  onMouseMove: (e: MouseEvent) => void;
  /** Handle global mouseup (for drag operations) */
  onMouseUp: (e: MouseEvent) => void;
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
 * @param handlers - Callbacks for mouse events (bound to grid instance)
 * @param signal - AbortSignal for cleanup
 */
export function setupRootEventDelegation(
  grid: InternalGrid,
  gridElement: HTMLElement,
  renderRoot: HTMLElement,
  handlers: RootEventHandlers,
  signal: AbortSignal,
): void {
  // Element-level keydown handler for keyboard navigation
  gridElement.addEventListener('keydown', (e) => handleGridKeyDown(grid, e), { signal });

  // Central mouse event handling for plugins
  renderRoot.addEventListener('mousedown', (e) => handlers.onMouseDown(e as MouseEvent), { signal });

  // Track global mousemove/mouseup for drag operations (column resize, selection, etc.)
  document.addEventListener('mousemove', (e: MouseEvent) => handlers.onMouseMove(e), { signal });
  document.addEventListener('mouseup', (e: MouseEvent) => handlers.onMouseUp(e), { signal });
}
