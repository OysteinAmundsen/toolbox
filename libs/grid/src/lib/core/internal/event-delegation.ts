/**
 * Event Delegation Module
 *
 * Handles delegated mousedown events on the grid body for focus management.
 * Uses event delegation (single listener on container) rather than per-cell
 * listeners to minimize memory usage.
 *
 * Edit triggering is handled separately by the EditingPlugin via
 * onCellClick and onKeyDown hooks.
 */

import type { InternalGrid } from '../types';
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
 * Call once during grid initialization.
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
}
