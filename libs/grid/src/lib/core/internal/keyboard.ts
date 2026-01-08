/**
 * Central keyboard handler attached to the host element. Manages navigation, paging,
 * and edit lifecycle triggers while respecting active form field interactions.
 */
import type { InternalGrid } from '../types';
import { FOCUSABLE_EDITOR_SELECTOR } from './editing';
import { clearCellFocus } from './utils';

export function handleGridKeyDown(grid: InternalGrid, e: KeyboardEvent): void {
  // Dispatch to plugin system first - if any plugin handles it, stop here
  if (grid._dispatchKeyDown?.(e)) {
    return;
  }

  const maxRow = grid._rows.length - 1;
  const maxCol = grid._visibleColumns.length - 1;
  const editing = grid._activeEditRows !== undefined && grid._activeEditRows !== -1;
  const col = grid._visibleColumns[grid._focusCol];
  const colType = col?.type;
  const path = (e as any).composedPath ? (e as any).composedPath() : [];
  const target = (path && path.length ? path[0] : (e.target as any)) as HTMLElement | null;
  const isFormField = (el: HTMLElement | null) => {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return true;
    if (el.isContentEditable) return true;
    return false;
  };
  if (isFormField(target) && (e.key === 'Home' || e.key === 'End')) return;
  if (isFormField(target) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    if ((target as HTMLInputElement).tagName === 'INPUT' && (target as HTMLInputElement).type === 'number') return;
  }
  // Let arrow left/right navigate within text inputs instead of moving cells
  if (isFormField(target) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
  // Let Enter/Escape be handled by the input's own handlers first
  if (isFormField(target) && (e.key === 'Enter' || e.key === 'Escape')) return;
  if (editing && (colType === 'select' || colType === 'typeahead') && (e.key === 'ArrowDown' || e.key === 'ArrowUp'))
    return;
  switch (e.key) {
    case 'Tab': {
      e.preventDefault();
      const forward = !e.shiftKey;
      if (forward) {
        if (grid._focusCol < maxCol) grid._focusCol += 1;
        else {
          if (typeof grid.commitActiveRowEdit === 'function') grid.commitActiveRowEdit();
          if (grid._focusRow < maxRow) {
            grid._focusRow += 1;
            grid._focusCol = 0;
          }
        }
      } else {
        if (grid._focusCol > 0) grid._focusCol -= 1;
        else if (grid._focusRow > 0) {
          if (typeof grid.commitActiveRowEdit === 'function' && grid._activeEditRows === grid._focusRow)
            grid.commitActiveRowEdit();
          grid._focusRow -= 1;
          grid._focusCol = maxCol;
        }
      }
      ensureCellVisible(grid);
      return;
    }
    case 'ArrowDown':
      if (editing && typeof grid.commitActiveRowEdit === 'function') grid.commitActiveRowEdit();
      grid._focusRow = Math.min(maxRow, grid._focusRow + 1);
      e.preventDefault();
      break;
    case 'ArrowUp':
      if (editing && typeof grid.commitActiveRowEdit === 'function') grid.commitActiveRowEdit();
      grid._focusRow = Math.max(0, grid._focusRow - 1);
      e.preventDefault();
      break;
    case 'ArrowRight':
      grid._focusCol = Math.min(maxCol, grid._focusCol + 1);
      e.preventDefault();
      break;
    case 'ArrowLeft':
      grid._focusCol = Math.max(0, grid._focusCol - 1);
      e.preventDefault();
      break;
    case 'Home':
      if (e.ctrlKey || e.metaKey) {
        // CTRL+Home: navigate to first row, first cell
        if (editing && typeof grid.commitActiveRowEdit === 'function') grid.commitActiveRowEdit();
        grid._focusRow = 0;
        grid._focusCol = 0;
      } else {
        // Home: navigate to first cell in current row
        grid._focusCol = 0;
      }
      e.preventDefault();
      ensureCellVisible(grid, { forceScrollLeft: true });
      return;
    case 'End':
      if (e.ctrlKey || e.metaKey) {
        // CTRL+End: navigate to last row, last cell
        if (editing && typeof grid.commitActiveRowEdit === 'function') grid.commitActiveRowEdit();
        grid._focusRow = maxRow;
        grid._focusCol = maxCol;
      } else {
        // End: navigate to last cell in current row
        grid._focusCol = maxCol;
      }
      e.preventDefault();
      ensureCellVisible(grid, { forceScrollRight: true });
      return;
    case 'PageDown':
      grid._focusRow = Math.min(maxRow, grid._focusRow + 20);
      e.preventDefault();
      break;
    case 'PageUp':
      grid._focusRow = Math.max(0, grid._focusRow - 20);
      e.preventDefault();
      break;
    case 'Enter':
      if (typeof grid.beginBulkEdit === 'function') {
        grid.beginBulkEdit(grid._focusRow);
        // Don't call ensureCellVisible - beginBulkEdit handles focus
        return;
      } else {
        (grid as unknown as HTMLElement).dispatchEvent(
          new CustomEvent('activate-cell', { detail: { row: grid._focusRow, col: grid._focusCol } }),
        );
      }
      return ensureCellVisible(grid);
    default:
      return;
  }
  ensureCellVisible(grid);
}

/**
 * Options for ensureCellVisible to control scroll behavior.
 */
interface EnsureCellVisibleOptions {
  /** Force scroll to the leftmost position (for Home key) */
  forceScrollLeft?: boolean;
  /** Force scroll to the rightmost position (for End key) */
  forceScrollRight?: boolean;
}

/**
 * Scroll the viewport (virtualized or static) so the focused cell's row is visible
 * and apply visual focus styling / tabindex management.
 */
export function ensureCellVisible(grid: InternalGrid, options?: EnsureCellVisibleOptions): void {
  if (grid._virtualization?.enabled) {
    const { rowHeight, container, viewportEl } = grid._virtualization;
    // container is the faux scrollbar element that handles actual scrolling
    // viewportEl is the visible area element that has the correct height
    const scrollEl = container as HTMLElement | undefined;
    const visibleHeight = viewportEl?.clientHeight ?? scrollEl?.clientHeight ?? 0;
    if (scrollEl && visibleHeight > 0) {
      const y = grid._focusRow * rowHeight;
      if (y < scrollEl.scrollTop) {
        scrollEl.scrollTop = y;
      } else if (y + rowHeight > scrollEl.scrollTop + visibleHeight) {
        scrollEl.scrollTop = y - visibleHeight + rowHeight;
      }
    }
  }
  // Skip refreshVirtualWindow when in edit mode to avoid wiping editors
  const isEditing = grid._activeEditRows !== undefined && grid._activeEditRows !== -1;
  if (!isEditing) {
    grid.refreshVirtualWindow(false);
  }
  clearCellFocus(grid._bodyEl);
  // Clear previous aria-selected markers
  Array.from(grid._bodyEl.querySelectorAll('[aria-selected="true"]')).forEach((el: any) => {
    el.setAttribute('aria-selected', 'false');
  });
  const rowIndex = grid._focusRow;
  const vStart = (grid._virtualization as any).start ?? 0;
  const vEnd = (grid._virtualization as any).end ?? grid._rows.length;
  if (rowIndex >= vStart && rowIndex < vEnd) {
    const rowEl = grid._bodyEl.querySelectorAll('.data-grid-row')[rowIndex - vStart] as HTMLElement | null;
    const cell = rowEl?.children[grid._focusCol] as HTMLElement | undefined;
    if (cell) {
      cell.classList.add('cell-focus');
      cell.setAttribute('aria-selected', 'true');

      // Horizontal scroll: ensure focused cell is visible in the horizontal scroll area
      // The .tbw-scroll-area element handles horizontal scrolling
      // Skip horizontal scrolling when in edit mode to prevent scroll jumps when editors are created
      const scrollArea = grid.shadowRoot?.querySelector('.tbw-scroll-area') as HTMLElement | null;
      if (scrollArea && cell && !isEditing) {
        // Handle forced scroll for Home/End keys - always scroll to edge
        if (options?.forceScrollLeft) {
          scrollArea.scrollLeft = 0;
        } else if (options?.forceScrollRight) {
          scrollArea.scrollLeft = scrollArea.scrollWidth - scrollArea.clientWidth;
        } else {
          // Get scroll boundary offsets from plugins (e.g., pinned columns)
          // This allows plugins to report how much of the scroll area they obscure
          // and whether the focused cell should skip scrolling (e.g., pinned cells are always visible)
          const offsets = grid._getHorizontalScrollOffsets?.(rowEl ?? undefined, cell) ?? { left: 0, right: 0 };

          if (!offsets.skipScroll) {
            // Get cell position relative to the scroll area
            const cellRect = cell.getBoundingClientRect();
            const scrollAreaRect = scrollArea.getBoundingClientRect();
            // Calculate the cell's position relative to scroll area's visible region
            const cellLeft = cellRect.left - scrollAreaRect.left + scrollArea.scrollLeft;
            const cellRight = cellLeft + cellRect.width;
            // Adjust visible boundaries to account for plugin-reported offsets
            const visibleLeft = scrollArea.scrollLeft + offsets.left;
            const visibleRight = scrollArea.scrollLeft + scrollArea.clientWidth - offsets.right;
            // Scroll horizontally if needed
            if (cellLeft < visibleLeft) {
              scrollArea.scrollLeft = cellLeft - offsets.left;
            } else if (cellRight > visibleRight) {
              scrollArea.scrollLeft = cellRight - scrollArea.clientWidth + offsets.right;
            }
          }
        }
      }

      if (grid._activeEditRows !== undefined && grid._activeEditRows !== -1 && cell.classList.contains('editing')) {
        const focusTarget = cell.querySelector(FOCUSABLE_EDITOR_SELECTOR) as HTMLElement | null;
        if (focusTarget && document.activeElement !== focusTarget) {
          try {
            focusTarget.focus({ preventScroll: true });
          } catch {
            /* empty */
          }
        }
      } else if (!cell.contains(document.activeElement)) {
        if (!cell.hasAttribute('tabindex')) cell.setAttribute('tabindex', '-1');
        try {
          (cell as HTMLElement).focus({ preventScroll: true } as any);
        } catch {
          /* empty */
        }
      }
    }
  }
}
