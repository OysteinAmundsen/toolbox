/**
 * Loading placeholder rows shared by plugins that synthesize them (ServerSide
 * blocks in flight, GroupingRows groups being fetched). Inlined into each
 * plugin bundle that imports it — core never calls it.
 */
import { setRowLoadingState } from '../../core/internal/loading';
import { clearRowForRebuild } from '../../core/internal/row-teardown';
import type { GridHost, RowElementInternal } from '../../core/types';

/**
 * Marker class on placeholder rows. Lets layout plugins (Responsive card mode)
 * tell a placeholder apart from a data row — `tbw-row-loading` is not enough,
 * because `grid.setRowLoading()` puts that on real rows too.
 */
export const PLACEHOLDER_ROW_CLASS = 'placeholder-row';

/**
 * Render a placeholder as one full-width cell in the core row-loading state, so
 * no column renderer runs for a row that holds no data.
 *
 * Call from a plugin `renderRow` hook and return `true`. The previous cells are
 * released through the framework adapter first (a pooled element may have held
 * React portals / Vue teleports / Angular views for a loaded row). The row is
 * flagged `__isCustomRow`, which forces a full rebuild once real data replaces
 * the placeholder; that rebuild also clears the loading state.
 *
 * Height: the row occupies exactly what virtualization reserves for it — the
 * height a plugin reports through `getRowHeight()` (e.g. a Responsive card), else
 * the default row height. Any inline height a recycled element carried (a
 * Responsive card height, a per-row `--tbw-row-height`) is dropped.
 */
export function renderLoadingPlaceholderRow(grid: GridHost, rowEl: HTMLElement, row: unknown, rowIndex: number): void {
  const el = rowEl as RowElementInternal;
  syncPlaceholderHeight(grid, el, row, rowIndex);
  // Same placeholder, still intact: nothing else to do (renders run every scroll frame).
  if (el.__rowDataRef === row && el.__isCustomRow && el.classList.contains('tbw-row-loading')) return;

  clearRowForRebuild(grid, el);
  el.className = `data-grid-row ${PLACEHOLDER_ROW_CLASS}`;
  el.__isCustomRow = true;
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.style.gridColumn = '1 / -1';
  cell.setAttribute('role', 'gridcell');
  cell.textContent = '\u00A0'; // keeps the row at its normal height
  el.appendChild(cell);
  setRowLoadingState(el, true, grid.effectiveConfig?.loadingRenderer);
}

/** Match the row's DOM height to the slot virtualization reserves for it. Writes only on change. */
function syncPlaceholderHeight(grid: GridHost, el: HTMLElement, row: unknown, rowIndex: number): void {
  const { style } = el;
  if (style.getPropertyValue('--tbw-row-height')) style.removeProperty('--tbw-row-height');
  const pluginHeight = grid._getPluginRowHeight?.(row, rowIndex);
  const height = pluginHeight !== undefined && pluginHeight > 0 ? `${pluginHeight}px` : '';
  if (style.height !== height) style.height = height;
}
