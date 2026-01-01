/**
 * Central keyboard handler attached to the host element. Manages navigation, paging,
 * and edit lifecycle triggers while respecting active form field interactions.
 */
import type { InternalGrid } from '../types';

export function handleGridKeyDown(grid: InternalGrid, e: KeyboardEvent): void {
  // Dispatch to plugin system first - if any plugin handles it, stop here
  if (grid.dispatchKeyDown?.(e)) {
    return;
  }

  const maxRow = grid._rows.length - 1;
  const maxCol = grid.visibleColumns.length - 1;
  const editing = grid.activeEditRows !== undefined && grid.activeEditRows !== -1;
  const col = grid.visibleColumns[grid.focusCol];
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
        if (grid.focusCol < maxCol) grid.focusCol += 1;
        else {
          if (typeof grid.commitActiveRowEdit === 'function') grid.commitActiveRowEdit();
          if (grid.focusRow < maxRow) {
            grid.focusRow += 1;
            grid.focusCol = 0;
          }
        }
      } else {
        if (grid.focusCol > 0) grid.focusCol -= 1;
        else if (grid.focusRow > 0) {
          if (typeof grid.commitActiveRowEdit === 'function' && grid.activeEditRows === grid.focusRow)
            grid.commitActiveRowEdit();
          grid.focusRow -= 1;
          grid.focusCol = maxCol;
        }
      }
      ensureCellVisible(grid);
      return;
    }
    case 'ArrowDown':
      if (editing && typeof grid.commitActiveRowEdit === 'function') grid.commitActiveRowEdit();
      grid.focusRow = Math.min(maxRow, grid.focusRow + 1);
      e.preventDefault();
      break;
    case 'ArrowUp':
      if (editing && typeof grid.commitActiveRowEdit === 'function') grid.commitActiveRowEdit();
      grid.focusRow = Math.max(0, grid.focusRow - 1);
      e.preventDefault();
      break;
    case 'ArrowRight':
      grid.focusCol = Math.min(maxCol, grid.focusCol + 1);
      e.preventDefault();
      break;
    case 'ArrowLeft':
      grid.focusCol = Math.max(0, grid.focusCol - 1);
      e.preventDefault();
      break;
    case 'Home':
      if (e.ctrlKey || e.metaKey) {
        // CTRL+Home: navigate to first row, first cell
        if (editing && typeof grid.commitActiveRowEdit === 'function') grid.commitActiveRowEdit();
        grid.focusRow = 0;
        grid.focusCol = 0;
      } else {
        // Home: navigate to first cell in current row
        grid.focusCol = 0;
      }
      e.preventDefault();
      break;
    case 'End':
      if (e.ctrlKey || e.metaKey) {
        // CTRL+End: navigate to last row, last cell
        if (editing && typeof grid.commitActiveRowEdit === 'function') grid.commitActiveRowEdit();
        grid.focusRow = maxRow;
        grid.focusCol = maxCol;
      } else {
        // End: navigate to last cell in current row
        grid.focusCol = maxCol;
      }
      e.preventDefault();
      break;
    case 'PageDown':
      grid.focusRow = Math.min(maxRow, grid.focusRow + 20);
      e.preventDefault();
      break;
    case 'PageUp':
      grid.focusRow = Math.max(0, grid.focusRow - 20);
      e.preventDefault();
      break;
    case 'Enter':
      if (typeof grid.beginBulkEdit === 'function') grid.beginBulkEdit(grid.focusRow);
      else
        (grid as unknown as HTMLElement).dispatchEvent(
          new CustomEvent('activate-cell', { detail: { row: grid.focusRow, col: grid.focusCol } }),
        );
      return ensureCellVisible(grid);
    default:
      return;
  }
  ensureCellVisible(grid);
}

/**
 * Scroll the viewport (virtualized or static) so the focused cell's row is visible
 * and apply visual focus styling / tabindex management.
 */
export function ensureCellVisible(grid: InternalGrid): void {
  if (grid.virtualization?.enabled) {
    const { rowHeight, container, viewportEl } = grid.virtualization;
    // container is the faux scrollbar element that handles actual scrolling
    // viewportEl is the visible area element that has the correct height
    const scrollEl = container as HTMLElement | undefined;
    const visibleHeight = viewportEl?.clientHeight ?? scrollEl?.clientHeight ?? 0;
    if (scrollEl && visibleHeight > 0) {
      const y = grid.focusRow * rowHeight;
      if (y < scrollEl.scrollTop) {
        scrollEl.scrollTop = y;
      } else if (y + rowHeight > scrollEl.scrollTop + visibleHeight) {
        scrollEl.scrollTop = y - visibleHeight + rowHeight;
      }
    }
  }
  // Skip refreshVirtualWindow when in edit mode to avoid wiping editors
  const isEditing = grid.activeEditRows !== undefined && grid.activeEditRows !== -1;
  if (!isEditing) {
    grid.refreshVirtualWindow(false);
  }
  Array.from(grid.bodyEl.querySelectorAll('.cell-focus')).forEach((el: any) => el.classList.remove('cell-focus'));
  // Clear previous aria-selected markers
  Array.from(grid.bodyEl.querySelectorAll('[aria-selected="true"]')).forEach((el: any) => {
    el.setAttribute('aria-selected', 'false');
  });
  const rowIndex = grid.focusRow;
  const vStart = (grid.virtualization as any).start ?? 0;
  const vEnd = (grid.virtualization as any).end ?? grid._rows.length;
  if (rowIndex >= vStart && rowIndex < vEnd) {
    const rowEl = grid.bodyEl.querySelectorAll('.data-grid-row')[rowIndex - vStart] as HTMLElement | null;
    const cell = rowEl?.children[grid.focusCol] as HTMLElement | undefined;
    if (cell) {
      cell.classList.add('cell-focus');
      cell.setAttribute('aria-selected', 'true');

      // Horizontal scroll: ensure focused cell is visible in the horizontal scroll area
      // The .tbw-scroll-area element handles horizontal scrolling
      const scrollArea = grid.shadowRoot?.querySelector('.tbw-scroll-area') as HTMLElement | null;
      if (scrollArea && cell) {
        // Get scroll boundary offsets from plugins (e.g., pinned columns)
        // This allows plugins to report how much of the scroll area they obscure
        // and whether the focused cell should skip scrolling (e.g., pinned cells are always visible)
        const offsets = grid.getHorizontalScrollOffsets?.(rowEl ?? undefined, cell) ?? { left: 0, right: 0 };

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

      if (grid.activeEditRows !== undefined && grid.activeEditRows !== -1 && cell.classList.contains('editing')) {
        const focusTarget = cell.querySelector(
          'input,select,textarea,[contenteditable="true"],[contenteditable=""],[tabindex]:not([tabindex="-1"])',
        ) as HTMLElement | null;
        if (focusTarget && document.activeElement !== focusTarget) {
          try {
            focusTarget.focus();
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
