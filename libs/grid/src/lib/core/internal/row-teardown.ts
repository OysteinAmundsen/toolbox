/**
 * Row teardown shared by the core render path and plugin-rendered rows
 * (loading placeholders), so framework-adapter cleanup has one implementation.
 */
import type { GridHost } from '../types';
import { removeCellLoadingOverlay, removeRowLoadingOverlay } from './loading';

/**
 * Release a pooled row's adapter-owned content — its row loader, cell loaders, then
 * cell views — before the row is discarded. Callers own the `beginBatch`/`endBatch`
 * bracket so a multi-row teardown collapses into one deferred commit (#330).
 */
export function releasePooledRow(adapter: GridHost['__frameworkAdapter'], rowEl: HTMLElement): void {
  if (!adapter?.releaseCell && !adapter?.unmount) return;
  removeRowLoadingOverlay(rowEl, adapter);
  const cells = rowEl.children;
  for (let c = 0; c < cells.length; c++) {
    const cell = cells[c] as HTMLElement;
    removeCellLoadingOverlay(cell, adapter);
    if (cell.firstElementChild) adapter.releaseCell?.(cell);
  }
}

/**
 * Wipe a pooled row's cells ahead of a full rebuild.
 *
 * Framework views are released BEFORE the DOM is wiped — without this,
 * Angular EmbeddedViewRefs / React roots / Vue apps created by renderers and
 * editor factories stay alive in the adapter's tracking arrays after their DOM
 * is destroyed, leaking memory on every recycle. Wrapped in `beginBatch`/`endBatch`
 * because `innerHTML = ''` detaches every cell as a group, letting adapters defer
 * per-cell sync commits to a single render once detachment completes (#330).
 */
export function clearRowForRebuild(grid: Pick<GridHost, '__frameworkAdapter'> & HTMLElement, rowEl: HTMLElement): void {
  // Clear loading state before rebuild — grid re-applies it after render for
  // actually-loading rows. Prevents a stale tbw-row-loading class from
  // persisting when pool elements are recycled.
  rowEl.classList.remove('tbw-row-loading');
  rowEl.removeAttribute('aria-busy');

  const adapter = grid.__frameworkAdapter;
  if (!adapter?.releaseCell && !adapter?.unmount) {
    rowEl.innerHTML = '';
    return;
  }
  adapter.beginBatch?.(grid);
  try {
    removeRowLoadingOverlay(rowEl, adapter);
    const children = rowEl.children;
    for (let i = children.length - 1; i >= 0; i--) {
      const cell = children[i] as HTMLElement;
      removeCellLoadingOverlay(cell, adapter);
      adapter.releaseCell?.(cell);
    }
    rowEl.innerHTML = '';
  } finally {
    adapter.endBatch?.(grid);
  }
}
