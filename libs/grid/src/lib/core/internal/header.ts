/**
 * Header Rendering Module
 *
 * Handles rendering of the grid header row with sorting and resize affordances.
 * Supports custom header renderers via `headerRenderer` (full control) and
 * `headerLabelRenderer` (label only) column properties.
 */

import type { ColumnInternal, HeaderCellContext, IconValue, InternalGrid } from '../types';
import { DEFAULT_GRID_ICONS } from '../types';
import { addPart } from './columns';
import { sanitizeHTML } from './sanitize';
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
 * Create a sort indicator element for a column.
 */
function createSortIndicator(grid: InternalGrid, col: ColumnInternal): HTMLElement {
  const icon = document.createElement('span');
  addPart(icon, 'sort-indicator');
  const active = grid._sortState?.field === col.field ? grid._sortState.direction : 0;
  const icons = { ...DEFAULT_GRID_ICONS, ...grid.icons };
  const iconValue = active === 1 ? icons.sortAsc : active === -1 ? icons.sortDesc : icons.sortNone;
  setIcon(icon, iconValue);
  return icon;
}

/**
 * Create a resize handle element.
 */
function createResizeHandle(grid: InternalGrid, colIndex: number, cell: HTMLElement): HTMLElement {
  const handle = document.createElement('div');
  handle.className = 'resize-handle';
  handle.setAttribute('aria-hidden', 'true');
  handle.addEventListener('mousedown', (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    grid._resizeController.start(e, colIndex, cell);
  });
  handle.addEventListener('dblclick', (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    grid._resizeController.resetColumn(colIndex);
  });
  return handle;
}

/**
 * Setup sorting click/keyboard handlers for a header cell.
 */
function setupSortHandlers(grid: InternalGrid, col: ColumnInternal, colIndex: number, cell: HTMLElement): void {
  cell.classList.add('sortable');
  cell.tabIndex = 0;
  const active = grid._sortState?.field === col.field ? grid._sortState.direction : 0;
  cell.setAttribute('aria-sort', active === 0 ? 'none' : active === 1 ? 'ascending' : 'descending');

  cell.addEventListener('click', (e) => {
    if (grid._resizeController?.isResizing) return;
    if (grid._dispatchHeaderClick?.(e, colIndex, cell)) return;
    toggleSort(grid, col);
  });
  cell.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (grid._dispatchHeaderClick?.(e as unknown as MouseEvent, colIndex, cell)) return;
      toggleSort(grid, col);
    }
  });
}

/**
 * Append renderer output to cell element.
 * Handles Node, string (with sanitization), or null/void (no-op).
 */
function appendRendererOutput(cell: HTMLElement, output: Node | string | void | null): void {
  if (output == null) return;
  if (typeof output === 'string') {
    // sanitizeHTML returns a sanitized HTML string, use a container to convert to DOM
    const container = document.createElement('span');
    container.innerHTML = sanitizeHTML(output);
    // Move all child nodes to the cell
    while (container.firstChild) {
      cell.appendChild(container.firstChild);
    }
  } else if (output instanceof Node) {
    cell.appendChild(output);
  }
}

/**
 * Rebuild the header row DOM based on current column configuration, attaching
 * sorting and resize affordances where enabled.
 *
 * Rendering precedence:
 * 1. `headerRenderer` - Full control over header cell content
 * 2. `headerLabelRenderer` - Custom label, framework handles icons/interactions
 * 3. `__headerTemplate` - Light DOM template (framework adapter)
 * 4. `header` property - Plain text header
 * 5. `field` - Fallback to field name
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

    // Compute header value and sort state for context
    const headerValue = col.header ?? col.field;
    const sortDirection = grid._sortState?.field === col.field ? grid._sortState.direction : 0;
    const sortState: 'asc' | 'desc' | null = sortDirection === 1 ? 'asc' : sortDirection === -1 ? 'desc' : null;

    // Check for headerRenderer (full control mode)
    if (col.headerRenderer) {
      // Create context with helper functions
      const ctx: HeaderCellContext<any> = {
        column: col,
        value: headerValue,
        sortState,
        filterActive: false, // Will be set by FilteringPlugin if active
        cellEl: cell,
        renderSortIcon: () => (col.sortable ? createSortIndicator(grid, col) : null),
        renderFilterButton: () => null, // FilteringPlugin adds filter button via afterRender
        renderResizeHandle: () => createResizeHandle(grid, i, cell),
      };

      const output = col.headerRenderer(ctx);
      appendRendererOutput(cell, output);

      // Setup sort handlers if sortable (user may not have included sort icon but still want click-to-sort)
      if (col.sortable) {
        setupSortHandlers(grid, col, i, cell);
      }

      // Add resizable class if resizable (for CSS positioning context)
      if (col.resizable) {
        cell.classList.add('resizable');
        // Note: User should call ctx.renderResizeHandle() and append it themselves
        // But we ensure the class is set for CSS purposes
      }
    }
    // Check for headerLabelRenderer (label-only mode)
    else if (col.headerLabelRenderer) {
      const ctx = {
        column: col,
        value: headerValue,
      };

      const output = col.headerLabelRenderer(ctx);
      // Wrap output in a span for consistency with default rendering
      const span = document.createElement('span');
      if (output == null) {
        span.textContent = headerValue;
      } else if (typeof output === 'string') {
        span.innerHTML = sanitizeHTML(output);
      } else if (output instanceof Node) {
        span.appendChild(output);
      }
      cell.appendChild(span);

      // Framework handles the rest: sort icon, resize handle
      if (col.sortable) {
        setupSortHandlers(grid, col, i, cell);
        cell.appendChild(createSortIndicator(grid, col));
      }
      if (col.resizable) {
        cell.classList.add('resizable');
        cell.appendChild(createResizeHandle(grid, i, cell));
      }
    }
    // Light DOM template (framework adapter)
    else if (col.__headerTemplate) {
      Array.from(col.__headerTemplate.childNodes).forEach((n) => cell.appendChild(n.cloneNode(true)));

      // Standard affordances
      if (col.sortable) {
        setupSortHandlers(grid, col, i, cell);
        cell.appendChild(createSortIndicator(grid, col));
      }
      if (col.resizable) {
        cell.classList.add('resizable');
        cell.appendChild(createResizeHandle(grid, i, cell));
      }
    }
    // Default: plain text header
    else {
      const span = document.createElement('span');
      span.textContent = headerValue;
      cell.appendChild(span);

      // Standard affordances
      if (col.sortable) {
        setupSortHandlers(grid, col, i, cell);
        cell.appendChild(createSortIndicator(grid, col));
      }
      if (col.resizable) {
        cell.classList.add('resizable');
        cell.appendChild(createResizeHandle(grid, i, cell));
      }
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
