/**
 * Header Rendering Module
 *
 * Handles rendering of the grid header row with sorting and resize affordances.
 */

import type { ColumnConfig, IconValue, InternalGrid } from '../types';
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
  grid.headerRowEl = (grid.findHeaderRow! as any)();
  const headerRow = grid.headerRowEl as HTMLElement;
  headerRow.innerHTML = '';
  // ARIA row index for header row is always 1
  headerRow.setAttribute('role', 'row');
  headerRow.setAttribute('aria-rowindex', '1');

  grid.visibleColumns.forEach((col: ColumnConfig<any>, i: number) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    addPart(cell, 'header-cell');
    cell.setAttribute('role', 'columnheader');

    // aria-colindex is 1-based
    cell.setAttribute('aria-colindex', String(i + 1));
    cell.setAttribute('data-field', col.field);
    cell.setAttribute('data-col', String(i)); // Add data-col for consistency with body cells

    // Apply sticky class if column has sticky property
    if ((col as any).sticky === 'left') {
      cell.classList.add('sticky-left');
    } else if ((col as any).sticky === 'right') {
      cell.classList.add('sticky-right');
    }

    // Column grouping styling is handled by the grouping-columns plugin via afterRender
    const maybeTpl = (col as any).__headerTemplate as HTMLElement | undefined;
    if (maybeTpl) Array.from(maybeTpl.childNodes).forEach((n) => cell.appendChild(n.cloneNode(true)));
    else {
      const label = (col as any).header || col.field;
      const span = document.createElement('span');
      span.textContent = label;
      cell.appendChild(span);
    }
    if (col.sortable) {
      cell.classList.add('sortable');
      cell.tabIndex = 0;
      const icon = document.createElement('span');
      addPart(icon as any, 'sort-indicator');
      icon.style.opacity = '0.6';
      const active = grid.sortState?.field === col.field ? grid.sortState.direction : 0;
      // Use grid-level icons (fall back to defaults)
      const icons = { ...DEFAULT_GRID_ICONS, ...grid.icons };
      const iconValue = active === 1 ? icons.sortAsc : active === -1 ? icons.sortDesc : icons.sortNone;
      setIcon(icon, iconValue);
      cell.appendChild(icon);
      // Always set a baseline aria-sort for sortable headers for assistive tech clarity.
      cell.setAttribute('aria-sort', active === 0 ? 'none' : active === 1 ? 'ascending' : 'descending');
      cell.addEventListener('click', (e) => {
        // Ignore clicks that are the result of a resize drag ending
        if (grid.resizeController?.isResizing) return;
        // Let plugins handle the click first (e.g., multi-sort)
        if (grid.dispatchHeaderClick?.(e, i, cell)) return;
        toggleSort(grid, col);
      });
      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          // Let plugins handle the keydown first
          if (grid.dispatchHeaderClick?.(e as unknown as MouseEvent, i, cell)) return;
          toggleSort(grid, col);
        }
      });
    }
    if (col.resizable) {
      // Only set position: relative if column is not sticky (sticky already creates positioning context)
      if (!(col as any).sticky) {
        cell.style.position = 'relative';
      }
      const handle = document.createElement('div');
      handle.className = 'resize-handle';
      handle.setAttribute('aria-hidden', 'true');
      handle.addEventListener('mousedown', (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        grid.resizeController.start(e, i, cell);
      });
      cell.appendChild(handle);
    }
    headerRow.appendChild(cell);
  });
  // If a column grouping row exists (handled in component render), we also mirror grouped class onto header-group-row cells in a post-pass
  try {
    const hostRoot = (grid as any).shadowRoot as ShadowRoot | undefined;
    if (hostRoot) {
      const groupCells = hostRoot.querySelectorAll('.header-group-row .cell');
      groupCells.forEach((gc) => {
        const id = gc.getAttribute('data-group');
        if (id) gc.classList.add('grouped');
      });
    }
  } catch {
    /* empty */
  }
  // Ensure every sortable header has a baseline aria-sort if not already set during construction.
  headerRow.querySelectorAll('.cell.sortable').forEach((el) => {
    if (!el.getAttribute('aria-sort')) el.setAttribute('aria-sort', 'none');
  });
}
