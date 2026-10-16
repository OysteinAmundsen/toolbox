/**
 * Row teardown shared by the core render path and plugin-rendered rows
 * (loading placeholders), so framework-adapter cleanup has one implementation.
 */
import type { GridHost } from '../types';

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
  if (!adapter?.releaseCell) {
    rowEl.innerHTML = '';
    return;
  }
  adapter.beginBatch?.(grid);
  try {
    const children = rowEl.children;
    for (let i = children.length - 1; i >= 0; i--) {
      adapter.releaseCell(children[i] as HTMLElement);
    }
    rowEl.innerHTML = '';
  } finally {
    adapter.endBatch?.(grid);
  }
}
