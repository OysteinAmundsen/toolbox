/**
 * Central keyboard handler attached to the host element. Manages navigation, paging,
 * and edit lifecycle triggers while respecting active form field interactions.
 */
import { FOCUSABLE_EDITOR_SELECTOR, GridClasses } from '../constants';
import type { GridHost } from '../types';
import { clearCellFocus, isRTL } from './utils';
import { fromVirtualScrollTop, toVirtualScrollTop } from './virtualization';

/** Commit active row edit if the editing plugin provides this method. */
function tryCommitEdit(grid: GridHost): void {
  if (typeof grid.commitActiveRowEdit === 'function') grid.commitActiveRowEdit();
}

function isFormField(el: HTMLElement | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return true;
  if (el.isContentEditable) return true;
  return false;
}

/** True while a row-scoped edit session is active. */
function isRowEditing(grid: GridHost): boolean {
  return grid._activeEditRows !== undefined && grid._activeEditRows !== -1;
}

// #region Keyboard Handler
/**
 * Guard chain deciding whether this keydown belongs to something other than
 * cell navigation and must be left alone.
 */
function shouldIgnoreKeyDown(grid: GridHost, e: KeyboardEvent, target: HTMLElement | null): boolean {
  // Keyboard events whose target lives inside the grid host but OUTSIDE the
  // rows body (toolpanel inputs/buttons, shell-header controls, light-DOM
  // children of <tbw-grid>) own their own keyboard interactions. Treating
  // ArrowUp/ArrowDown/Enter on such a target as cell navigation steals the
  // user's actual interaction target on the very next render cycle.
  // Cells and the grid host itself remain valid navigation targets.
  if (target && target !== grid && !target.closest?.('.rows-body')) return true;

  if (isFormField(target)) {
    switch (e.key) {
      // Home/End and horizontal arrows navigate within the text input; Enter
      // and Escape are handled by the input's own handlers first.
      case 'Home':
      case 'End':
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'Enter':
      case 'Escape':
        return true;
      case 'ArrowUp':
      case 'ArrowDown':
        // Number spinners own the vertical arrows; other fields fall through.
        if ((target as HTMLInputElement).tagName === 'INPUT' && (target as HTMLInputElement).type === 'number') {
          return true;
        }
        break;
    }
  }

  const colType = grid._visibleColumns[grid._focusCol]?.type;
  return isRowEditing(grid) && colType === 'select' && (e.key === 'ArrowDown' || e.key === 'ArrowUp');
}

/** Tab / Shift+Tab: advance one cell, wrapping to the next/previous row. */
function navigateTab(grid: GridHost, e: KeyboardEvent, maxRow: number, maxCol: number): void {
  e.preventDefault();
  if (!e.shiftKey) {
    if (grid._focusCol < maxCol) {
      grid._focusCol += 1;
      return;
    }
    tryCommitEdit(grid);
    if (grid._focusRow < maxRow) {
      grid._focusRow += 1;
      grid._focusCol = 0;
    }
    return;
  }
  if (grid._focusCol > 0) {
    grid._focusCol -= 1;
  } else if (grid._focusRow > 0) {
    if (grid._activeEditRows === grid._focusRow) tryCommitEdit(grid);
    grid._focusRow -= 1;
    grid._focusCol = maxCol;
  }
}

/**
 * ArrowLeft/ArrowRight. `towardEnd` is the LOGICAL direction (ArrowRight); in
 * RTL the physical arrow maps to the opposite column index.
 */
function navigateHorizontal(grid: GridHost, e: KeyboardEvent, maxCol: number, towardEnd: boolean): void {
  const forward = isRTL(grid) ? !towardEnd : towardEnd;
  grid._focusCol = forward ? Math.min(maxCol, grid._focusCol + 1) : Math.max(0, grid._focusCol - 1);
  e.preventDefault();
}

/** Home/End (plus Ctrl/Cmd variants which also jump to the first/last row). */
function navigateRowEdge(grid: GridHost, e: KeyboardEvent, maxRow: number, maxCol: number, toEnd: boolean): void {
  if (e.ctrlKey || e.metaKey) {
    if (isRowEditing(grid)) tryCommitEdit(grid);
    grid._focusRow = toEnd ? maxRow : 0;
  }
  grid._focusCol = toEnd ? maxCol : 0;
  e.preventDefault();
  ensureCellVisible(grid, toEnd ? { forceScrollRight: true } : { forceScrollLeft: true });
}

/** Dispatch the unified `cell-activate` event. Returns true when cancelled. */
function emitCellActivate(grid: GridHost, e: KeyboardEvent): boolean {
  const rowIndex = grid._focusRow;
  const colIndex = grid._focusCol;
  const column = grid._visibleColumns[colIndex];
  const row = grid._rows[rowIndex];
  const field = column?.field ?? '';
  const activateEvent = new CustomEvent('cell-activate', {
    cancelable: true,
    detail: {
      rowIndex,
      colIndex,
      column,
      field,
      value: field && row ? (row as Record<string, unknown>)[field] : undefined,
      row,
      cellEl: grid.querySelector(`[data-row="${rowIndex}"][data-col="${colIndex}"]`) as HTMLElement | undefined,
      trigger: 'keyboard' as const,
      originalEvent: e,
    },
  });
  grid.dispatchEvent(activateEvent);
  return activateEvent.defaultPrevented;
}

export function handleGridKeyDown(grid: GridHost, e: KeyboardEvent): void {
  // Dispatch to plugin system first - if any plugin handles it, stop here
  if (grid._dispatchKeyDown?.(e)) return;

  const path = e.composedPath?.() ?? [];
  const target = (path.length ? path[0] : e.target) as HTMLElement | null;
  if (shouldIgnoreKeyDown(grid, e, target)) return;

  const maxRow = grid._rows.length - 1;
  const maxCol = grid._visibleColumns.length - 1;

  switch (e.key) {
    case 'Tab':
      navigateTab(grid, e, maxRow, maxCol);
      break;
    case 'ArrowDown':
      if (isRowEditing(grid)) tryCommitEdit(grid);
      grid._focusRow = Math.min(maxRow, grid._focusRow + 1);
      e.preventDefault();
      break;
    case 'ArrowUp':
      if (isRowEditing(grid)) tryCommitEdit(grid);
      grid._focusRow = Math.max(0, grid._focusRow - 1);
      e.preventDefault();
      break;
    case 'ArrowRight':
      navigateHorizontal(grid, e, maxCol, true);
      break;
    case 'ArrowLeft':
      navigateHorizontal(grid, e, maxCol, false);
      break;
    case 'Home':
      navigateRowEdge(grid, e, maxRow, maxCol, false);
      return;
    case 'End':
      navigateRowEdge(grid, e, maxRow, maxCol, true);
      return;
    case 'PageDown':
      grid._focusRow = Math.min(maxRow, grid._focusRow + 20);
      e.preventDefault();
      break;
    case 'PageUp':
      grid._focusRow = Math.max(0, grid._focusRow - 20);
      e.preventDefault();
      break;
    // NOTE: Enter is normally handled by EditingPlugin. If no plugin handled
    // it, dispatch the unified cell-activate event for custom handling.
    case 'Enter':
      if (emitCellActivate(grid, e)) {
        e.preventDefault();
        return;
      }
      break;
    default:
      return;
  }
  ensureCellVisible(grid);
}
// #endregion

// #region Cell Visibility
/**
 * Options for ensureCellVisible to control scroll behavior.
 */
interface EnsureCellVisibleOptions {
  /** Force scroll to the leftmost position (for Home key) */
  forceScrollLeft?: boolean;
  /** Force scroll to the rightmost position (for End key) */
  forceScrollRight?: boolean;
  /** Force horizontal scroll even in edit mode (for Tab navigation) */
  forceHorizontalScroll?: boolean;
}

/**
 * Vertical: scroll the virtualized container so the focused row is in view.
 *
 * `y` is in raw row-content space (rowHeight × index). Above the browser height
 * cap (#326), `scrollEl.scrollTop` is in clamped spacer space — the two
 * coordinate systems are not interchangeable, so translate scrollTop into
 * virtual space for the comparison and back into native space when writing.
 * For sub-cap datasets the mapping is identity, so this is a no-op.
 */
function scrollFocusedRowIntoView(grid: GridHost): void {
  if (!grid._virtualization?.enabled) return;
  const { rowHeight, container, viewportEl, scrollMapping } = grid._virtualization;
  // container is the faux scrollbar element that handles actual scrolling;
  // viewportEl is the visible area element that has the correct height.
  const scrollEl = container as HTMLElement | undefined;
  const visibleHeight = viewportEl?.clientHeight ?? scrollEl?.clientHeight ?? 0;
  if (!scrollEl || visibleHeight <= 0) return;

  const y = grid._focusRow * rowHeight;
  const virtualScrollTop = scrollMapping ? toVirtualScrollTop(scrollEl.scrollTop, scrollMapping) : scrollEl.scrollTop;
  if (y < virtualScrollTop) {
    scrollEl.scrollTop = scrollMapping ? fromVirtualScrollTop(y, scrollMapping) : y;
  } else if (y + rowHeight > virtualScrollTop + visibleHeight) {
    const target = y - visibleHeight + rowHeight;
    scrollEl.scrollTop = scrollMapping ? fromVirtualScrollTop(target, scrollMapping) : target;
  }
}

/**
 * Resolve the rendered cell for the focused row/col, or `undefined` when the
 * focused row is outside the current virtual window.
 */
function findFocusedCell(grid: GridHost): { rowEl: HTMLElement | null; cell: HTMLElement } | undefined {
  const rowIndex = grid._focusRow;
  const vStart = grid._virtualization.start ?? 0;
  const vEnd = grid._virtualization.end ?? grid._rows.length;
  if (rowIndex < vStart || rowIndex >= vEnd) return undefined;

  const rowEl = grid._bodyEl.querySelectorAll('.data-grid-row')[rowIndex - vStart] as HTMLElement | null;
  // Try exact column match first, then query by data-col, then fall back to the
  // first cell (full-width group rows).
  let cell = rowEl?.children[grid._focusCol] as HTMLElement | undefined;
  if (!cell || !cell.classList?.contains('cell')) {
    cell = (rowEl?.querySelector(`.cell[data-col="${grid._focusCol}"]`) ?? rowEl?.querySelector('.cell[data-col]')) as
      HTMLElement | undefined;
  }
  return cell ? { rowEl: rowEl ?? null, cell } : undefined;
}

/** Horizontal: bring the focused cell into the `.tbw-scroll-area` viewport. */
function scrollCellIntoViewHorizontally(
  grid: GridHost,
  rowEl: HTMLElement | null,
  cell: HTMLElement,
  options?: EnsureCellVisibleOptions,
): void {
  const scrollArea = grid.querySelector('.tbw-scroll-area') as HTMLElement | null;
  if (!scrollArea) return;

  // Home/End always scroll to the edge.
  if (options?.forceScrollLeft) {
    scrollArea.scrollLeft = 0;
    return;
  }
  if (options?.forceScrollRight) {
    scrollArea.scrollLeft = scrollArea.scrollWidth - scrollArea.clientWidth;
    return;
  }

  // Plugins (e.g. pinned columns) report how much of the scroll area they
  // obscure, and whether the focused cell should skip scrolling entirely
  // (pinned cells are always visible).
  const offsets = grid._getHorizontalScrollOffsets?.(rowEl ?? undefined, cell) ?? { left: 0, right: 0 };
  if (offsets.skipScroll) return;

  const cellRect = cell.getBoundingClientRect();
  const scrollAreaRect = scrollArea.getBoundingClientRect();
  const cellLeft = cellRect.left - scrollAreaRect.left + scrollArea.scrollLeft;
  const cellRight = cellLeft + cellRect.width;
  const visibleLeft = scrollArea.scrollLeft + offsets.left;
  const visibleRight = scrollArea.scrollLeft + scrollArea.clientWidth - offsets.right;
  if (cellLeft < visibleLeft) {
    scrollArea.scrollLeft = cellLeft - offsets.left;
  } else if (cellRight > visibleRight) {
    scrollArea.scrollLeft = cellRight - scrollArea.clientWidth + offsets.right;
  }
}

/** Move real DOM focus to the editor, the cell, or the grid host. */
function applyFocusTarget(grid: GridHost, cell: HTMLElement, isEditing: boolean): void {
  if (isEditing && cell.classList.contains(GridClasses.EDITING)) {
    // Editing cell: focus the editor input inside it
    const focusTarget = cell.querySelector(FOCUSABLE_EDITOR_SELECTOR) as HTMLElement | null;
    if (focusTarget && document.activeElement !== focusTarget) {
      try {
        focusTarget.focus({ preventScroll: true });
      } catch {
        /* empty */
      }
    }
    return;
  }

  if (isEditing) {
    // Active edit row but this cell isn't the editing cell — focus it so Tab
    // navigation within the row can attach editors.
    if (cell.contains(document.activeElement)) return;
    if (!cell.hasAttribute('tabindex')) cell.setAttribute('tabindex', '-1');
    try {
      cell.focus({ preventScroll: true });
    } catch {
      /* empty */
    }
    return;
  }

  // NOT editing: keep focus on the grid element (tabindex=0) rather than
  // individual cells. In a virtualized grid, cells can be detached by
  // subsequent render cycles (e.g., SelectionPlugin's requestAfterRender
  // → RAF → row recycling). A detached focused cell causes activeElement
  // to revert to <body>, breaking keyboard navigation.
  // Visual focus is managed by the .cell-focus CSS class + data-has-focus.
  //
  // BUT: don't steal focus from a real focused descendant (toolpanel
  // input, shell-header button, registered overlay control). Cell focus
  // is virtual; if the user is actively typing in a non-cell input, we
  // must leave that input alone. We only reclaim focus when nothing
  // meaningful inside the grid currently holds it (active element is
  // outside grid, on the grid host itself, or on a bare cell).
  const active = document.activeElement;
  const meaningful =
    active instanceof HTMLElement &&
    active !== grid &&
    typeof grid.contains === 'function' &&
    grid.contains(active) &&
    !active.classList.contains('cell') &&
    !active.closest('.cell');
  if (!meaningful && active !== grid) {
    grid.focus({ preventScroll: true });
  }
}

/**
 * Scroll the viewport (virtualized or static) so the focused cell's row is visible
 * and apply visual focus styling / tabindex management.
 */
export function ensureCellVisible(grid: GridHost, options?: EnsureCellVisibleOptions): void {
  scrollFocusedRowIntoView(grid);

  const isEditing = isRowEditing(grid) || !!grid._isGridEditMode;
  // Skip refreshVirtualWindow when in edit mode to avoid wiping editors
  if (!isEditing) grid.refreshVirtualWindow(false);

  clearCellFocus(grid._bodyEl);
  // Clear previous aria-selected markers
  Array.from(grid._bodyEl.querySelectorAll('[aria-selected="true"]')).forEach((el) => {
    el.setAttribute('aria-selected', 'false');
  });

  const focused = findFocusedCell(grid);
  if (!focused) return;
  const { rowEl, cell } = focused;

  cell.classList.add('cell-focus');
  cell.setAttribute('aria-selected', 'true');

  // Skip horizontal scrolling in edit mode to prevent scroll jumps when editors
  // are created — unless forceHorizontalScroll is set (Tab while editing).
  if (!isEditing || options?.forceHorizontalScroll) {
    scrollCellIntoViewHorizontally(grid, rowEl, cell, options);
  }

  applyFocusTarget(grid, cell, isEditing);
}
// #endregion
