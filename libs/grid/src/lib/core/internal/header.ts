/**
 * Header Rendering Module
 *
 * Handles rendering of the grid header row with sorting and resize affordances.
 */

import type { ColumnInternal, IconValue, InternalGrid } from '../types';
import { DEFAULT_GRID_ICONS } from '../types';
import { addPart } from './columns';
import { toggleSort } from './sorting';

/**
 * Set an icon value on an element. Handles both string and HTMLElement icons.
 */
function setIcon(element: HTMLElement, icon: IconValue): void {
  if (typeof icon === 'string') {
    element.textContent = icon;
  } else if (icon instanceof HTMLElement) {
    element.innerHTML = '';
    element.appendChild(icon.cloneNode(true));
  }
}

/**
 * Rebuild the header row DOM based on current column configuration, attaching
 * sorting and resize affordances where enabled.
 */
export function renderHeader(grid: InternalGrid): void {
  grid._headerRowEl = grid.findHeaderRow!();
  const headerRow = grid._headerRowEl as HTMLElement;

  // Guard: DOM may not be built yet
  if (!headerRow) {
    return;
  }

  headerRow.innerHTML = '';

  grid._visibleColumns.forEach((col: ColumnInternal, i: number) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    addPart(cell, 'header-cell');
    cell.setAttribute('role', 'columnheader');

    // aria-colindex is 1-based
    cell.setAttribute('aria-colindex', String(i + 1));
    cell.setAttribute('data-field', col.field);
    cell.setAttribute('data-col', String(i)); // Add data-col for consistency with body cells

    // Column grouping styling is handled by the grouping-columns plugin via afterRender
    const maybeTpl = col.__headerTemplate;
    if (maybeTpl) Array.from(maybeTpl.childNodes).forEach((n) => cell.appendChild(n.cloneNode(true)));
    else {
      const label = col.header || col.field;
      const span = document.createElement('span');
      span.textContent = label;
      cell.appendChild(span);
    }
    if (col.sortable) {
      cell.classList.add('sortable');
      cell.tabIndex = 0;
      const icon = document.createElement('span');
      addPart(icon, 'sort-indicator');
      const active = grid._sortState?.field === col.field ? grid._sortState.direction : 0;
      // Use grid-level icons (fall back to defaults)
      const icons = { ...DEFAULT_GRID_ICONS, ...grid.icons };
      const iconValue = active === 1 ? icons.sortAsc : active === -1 ? icons.sortDesc : icons.sortNone;
      setIcon(icon, iconValue);
      cell.appendChild(icon);
      // Always set a baseline aria-sort for sortable headers for assistive tech clarity.
      cell.setAttribute('aria-sort', active === 0 ? 'none' : active === 1 ? 'ascending' : 'descending');
      cell.addEventListener('click', (e) => {
        // Ignore clicks that are the result of a resize drag ending
        if (grid._resizeController?.isResizing) return;
        // Let plugins handle the click first (e.g., multi-sort)
        if (grid._dispatchHeaderClick?.(e, i, cell)) return;
        toggleSort(grid, col);
      });
      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          // Let plugins handle the keydown first
          if (grid._dispatchHeaderClick?.(e as unknown as MouseEvent, i, cell)) return;
          toggleSort(grid, col);
        }
      });
    }
    if (col.resizable) {
      // Add class for resize handle positioning context (CSS provides position: relative)
      // Note: If a plugin applies position: sticky (e.g., PinnedColumnsPlugin), it will override this
      cell.classList.add('resizable');
      const handle = document.createElement('div');
      handle.className = 'resize-handle';
      handle.setAttribute('aria-hidden', 'true');
      handle.addEventListener('mousedown', (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        grid._resizeController.start(e, i, cell);
      });
      // Double-click to reset column width to default
      handle.addEventListener('dblclick', (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        grid._resizeController.resetColumn(i);
      });
      cell.appendChild(handle);
    }
    headerRow.appendChild(cell);
  });

  // Ensure every sortable header has a baseline aria-sort if not already set during construction.
  headerRow.querySelectorAll('.cell.sortable').forEach((el) => {
    if (!el.getAttribute('aria-sort')) el.setAttribute('aria-sort', 'none');
  });

  // Set ARIA role only if header has children (role="row" requires columnheader children)
  // When grid is cleared with 0 columns, the header row should not have role="row"
  if (headerRow.children.length > 0) {
    headerRow.setAttribute('role', 'row');
    headerRow.setAttribute('aria-rowindex', '1');
  } else {
    headerRow.removeAttribute('role');
    headerRow.removeAttribute('aria-rowindex');
  }
}
