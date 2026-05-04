import { afterEach, describe, expect, it } from 'vitest';
import type { ScrollEvent } from '../../core/plugin/types';
import type { ColumnConfig } from '../../core/types';
import { StickyRowsPlugin } from './StickyRowsPlugin';

/**
 * Unit tests for StickyRowsPlugin.
 *
 * Validates predicate evaluation, displayed-index computation across
 * `'push'` and `'stack'` modes, container DOM placement, clone reuse, and
 * push-mode displacement math.
 */

interface MockGridOpts {
  rows?: unknown[];
  columns?: ColumnConfig[];
  /** Pre-rendered row indices to seed `.rows .data-grid-row` elements for. */
  renderedIndices?: number[];
  rowHeight?: number;
}

function createMockGrid(opts: MockGridOpts = {}): HTMLElement {
  const grid = document.createElement('div');

  const root = document.createElement('div');
  root.className = 'tbw-grid-root';
  const scrollArea = document.createElement('div');
  scrollArea.className = 'tbw-scroll-area';
  const rowsBodyWrapper = document.createElement('div');
  rowsBodyWrapper.className = 'rows-body-wrapper';
  const rowsBody = document.createElement('div');
  rowsBody.className = 'rows-body';
  const header = document.createElement('div');
  header.className = 'header';
  const rowsContainer = document.createElement('div');
  rowsContainer.className = 'rows-container';
  const rowsViewport = document.createElement('div');
  rowsViewport.className = 'rows-viewport';
  const rowsEl = document.createElement('div');
  rowsEl.className = 'rows';

  rowsViewport.appendChild(rowsEl);
  rowsContainer.appendChild(rowsViewport);
  rowsBody.appendChild(header);
  rowsBody.appendChild(rowsContainer);
  rowsBodyWrapper.appendChild(rowsBody);
  scrollArea.appendChild(rowsBodyWrapper);
  root.appendChild(scrollArea);
  grid.appendChild(root);

  // Seed pool rows for the requested indices so `findRenderedRow` can locate
  // them. Each row needs a single cell whose `data-row` matches.
  const rendered = opts.renderedIndices ?? [];
  const cols = opts.columns ?? [];
  for (const idx of rendered) {
    const rowEl = document.createElement('div');
    rowEl.className = 'data-grid-row';
    rowEl.setAttribute('role', 'row');
    rowEl.dataset['testRow'] = String(idx);
    for (let c = 0; c < Math.max(1, cols.length); c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('data-row', String(idx));
      cell.setAttribute('data-col', String(c));
      cell.textContent = `R${idx}C${c}`;
      rowEl.appendChild(cell);
    }
    rowsEl.appendChild(rowEl);
  }

  Object.defineProperty(grid, 'rows', { get: () => opts.rows ?? [], configurable: true });
  Object.defineProperty(grid, 'sourceRows', { get: () => opts.rows ?? [], configurable: true });
  Object.defineProperty(grid, 'columns', { get: () => opts.columns ?? [], configurable: true });
  Object.defineProperty(grid, '_visibleColumns', {
    get: () => opts.columns ?? [],
    configurable: true,
  });
  Object.defineProperty(grid, '_virtualization', {
    value: { start: 0, end: rendered.length, rowHeight: opts.rowHeight ?? 28, positionCache: null },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(grid, '_hostElement', { get: () => grid, configurable: true });
  Object.defineProperty(grid, 'getPluginState', { value: () => null, configurable: true });

  document.body.appendChild(grid);
  return grid;
}

function scrollEvent(scrollTop: number): ScrollEvent {
  return { scrollTop, scrollLeft: 0, scrollHeight: 0, scrollWidth: 0, clientHeight: 0, clientWidth: 0 };
}

describe('StickyRowsPlugin', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // #region constructor / defaults

  describe('defaults', () => {
    it('exposes correct plugin name', () => {
      const plugin = new StickyRowsPlugin({ isSticky: () => false });
      expect(plugin.name).toBe('stickyRows');
    });

    it('defaults to push mode with unbounded stacking', () => {
      const plugin = new StickyRowsPlugin({ isSticky: () => false });
      const grid = createMockGrid();
      plugin.attach(grid);
      expect(plugin.config.mode).toBe('push');
      expect(plugin.config.maxStacked).toBe(Infinity);
    });
  });

  // #endregion

  // #region predicate forms

  describe('isSticky resolution', () => {
    const rows = [{ flag: false }, { flag: true }, { flag: false }, { flag: true }, { flag: false }];

    it('accepts a field-name shorthand', () => {
      const plugin = new StickyRowsPlugin({ isSticky: 'flag' });
      const grid = createMockGrid({ rows, renderedIndices: [0, 1, 2, 3, 4] });
      plugin.attach(grid);
      plugin.afterRender();
      // Scrolling past row 1 should stick row 1 (push mode default).
      plugin.onScroll(scrollEvent(28 + 1));
      const sticky = grid.querySelectorAll('.tbw-sticky-rows .tbw-sticky-row');
      expect(sticky.length).toBe(1);
      expect((sticky[0] as HTMLElement).dataset['stickyRow']).toBe('1');
    });

    it('accepts a predicate function', () => {
      const plugin = new StickyRowsPlugin({
        isSticky: (row, idx) => idx % 2 === 1,
      });
      const grid = createMockGrid({ rows, renderedIndices: [0, 1, 2, 3, 4] });
      plugin.attach(grid);
      plugin.afterRender();
      plugin.onScroll(scrollEvent(100));
      const stuck = grid.querySelectorAll('.tbw-sticky-rows .tbw-sticky-row');
      expect(stuck.length).toBe(1);
      // 100px / 28px ≈ index 3, so row 3 is the highest qualifying.
      expect((stuck[0] as HTMLElement).dataset['stickyRow']).toBe('3');
    });

    it('renders nothing when no row qualifies', () => {
      const plugin = new StickyRowsPlugin({ isSticky: () => false });
      const grid = createMockGrid({ rows, renderedIndices: [0, 1, 2] });
      plugin.attach(grid);
      plugin.afterRender();
      plugin.onScroll(scrollEvent(500));
      expect(grid.querySelectorAll('.tbw-sticky-rows .tbw-sticky-row').length).toBe(0);
    });
  });

  // #endregion

  // #region container DOM placement

  describe('container placement', () => {
    it('inserts .tbw-sticky-rows as the first child of .rows-viewport so it overlays the row pool', () => {
      const plugin = new StickyRowsPlugin({ isSticky: 'flag' });
      const grid = createMockGrid({ rows: [{ flag: true }], renderedIndices: [0] });
      plugin.attach(grid);
      plugin.afterRender();

      const rowsViewport = grid.querySelector('.rows-viewport')!;
      const sticky = rowsViewport.querySelector('.tbw-sticky-rows');
      expect(sticky).not.toBeNull();
      // Must be the first child so the absolute-positioned overlay sits at
      // the top of the viewport above `.rows`.
      expect(rowsViewport.firstElementChild).toBe(sticky);
    });

    it('removes container on detach', () => {
      const plugin = new StickyRowsPlugin({ isSticky: 'flag' });
      const grid = createMockGrid({ rows: [{ flag: true }], renderedIndices: [0] });
      plugin.attach(grid);
      plugin.afterRender();
      expect(grid.querySelector('.tbw-sticky-rows')).not.toBeNull();

      plugin.detach();
      expect(grid.querySelector('.tbw-sticky-rows')).toBeNull();
    });

    it('applies a custom className to the container', () => {
      const plugin = new StickyRowsPlugin({ isSticky: 'flag', className: 'my-clones' });
      const grid = createMockGrid({ rows: [{ flag: true }], renderedIndices: [0] });
      plugin.attach(grid);
      plugin.afterRender();
      expect(grid.querySelector('.tbw-sticky-rows.my-clones')).not.toBeNull();
    });
  });

  // #endregion

  // #region mode behavior

  describe("'push' mode", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ flag: i === 3 || i === 8 || i === 15 }));
    const rendered = Array.from({ length: 20 }, (_, i) => i);

    it('shows only the highest qualifying sticky row', () => {
      const plugin = new StickyRowsPlugin({ isSticky: 'flag', mode: 'push' });
      const grid = createMockGrid({ rows, renderedIndices: rendered });
      plugin.attach(grid);
      plugin.afterRender();
      // Scroll past rows 3 + 8, but not 15 → only 8 should be stuck.
      plugin.onScroll(scrollEvent(8 * 28 + 1));
      const stuck = grid.querySelectorAll('.tbw-sticky-rows .tbw-sticky-row');
      expect(stuck.length).toBe(1);
      expect((stuck[0] as HTMLElement).dataset['stickyRow']).toBe('8');
    });

    it('swaps the stuck row when a higher-indexed sticky row passes', () => {
      const plugin = new StickyRowsPlugin({ isSticky: 'flag', mode: 'push' });
      const grid = createMockGrid({ rows, renderedIndices: rendered });
      plugin.attach(grid);
      plugin.afterRender();

      plugin.onScroll(scrollEvent(3 * 28 + 1));
      let stuck = grid.querySelectorAll('.tbw-sticky-rows .tbw-sticky-row');
      expect((stuck[0] as HTMLElement).dataset['stickyRow']).toBe('3');

      plugin.onScroll(scrollEvent(15 * 28 + 1));
      stuck = grid.querySelectorAll('.tbw-sticky-rows .tbw-sticky-row');
      expect(stuck.length).toBe(1);
      expect((stuck[0] as HTMLElement).dataset['stickyRow']).toBe('15');
    });

    it('translates the stuck row upward when the next sticky row approaches', () => {
      const plugin = new StickyRowsPlugin({ isSticky: 'flag', mode: 'push' });
      const grid = createMockGrid({ rows, renderedIndices: rendered });
      plugin.attach(grid);
      plugin.afterRender();

      const rowH = 28;
      // Stick row 3, then scroll until row 8's top is 10px from the top — the
      // overlap should be (28 - 10) = 18 pixels of upward translation.
      const targetScroll = 8 * rowH - 10;
      plugin.onScroll(scrollEvent(targetScroll));

      const stuck = grid.querySelector('.tbw-sticky-rows .tbw-sticky-row') as HTMLElement | null;
      expect(stuck).not.toBeNull();
      expect((stuck as HTMLElement).dataset['stickyRow']).toBe('3');
      // Transform is applied to the container so push mode and stack-mode
      // anticipation can both slide uniformly.
      const container = grid.querySelector('.tbw-sticky-rows') as HTMLElement;
      expect(container.style.transform).toBe('translateY(-18px)');
    });

    it('clears the transform when no upward push is needed', () => {
      const plugin = new StickyRowsPlugin({ isSticky: 'flag', mode: 'push' });
      const grid = createMockGrid({ rows, renderedIndices: rendered });
      plugin.attach(grid);
      plugin.afterRender();

      // Push first
      plugin.onScroll(scrollEvent(8 * 28 - 10));
      // Then scroll back to a position where 3 is stuck and 8 is far below.
      plugin.onScroll(scrollEvent(3 * 28 + 1));
      const container = grid.querySelector('.tbw-sticky-rows') as HTMLElement;
      expect(container.style.transform).toBe('');
    });
  });

  describe("'stack' mode", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ flag: i === 3 || i === 8 || i === 15 }));
    const rendered = Array.from({ length: 20 }, (_, i) => i);

    it('stacks every qualifying sticky row in order', () => {
      const plugin = new StickyRowsPlugin({ isSticky: 'flag', mode: 'stack' });
      const grid = createMockGrid({ rows, renderedIndices: rendered });
      plugin.attach(grid);
      plugin.afterRender();
      plugin.onScroll(scrollEvent(15 * 28 + 1));
      const stuck = grid.querySelectorAll('.tbw-sticky-rows .tbw-sticky-row');
      expect(Array.from(stuck).map((el) => (el as HTMLElement).dataset['stickyRow'])).toEqual(['3', '8', '15']);
    });

    it('caps the stack at maxStacked, evicting the oldest entries', () => {
      const plugin = new StickyRowsPlugin({ isSticky: 'flag', mode: 'stack', maxStacked: 2 });
      const grid = createMockGrid({ rows, renderedIndices: rendered });
      plugin.attach(grid);
      plugin.afterRender();
      plugin.onScroll(scrollEvent(15 * 28 + 1));
      const stuck = grid.querySelectorAll('.tbw-sticky-rows .tbw-sticky-row');
      expect(Array.from(stuck).map((el) => (el as HTMLElement).dataset['stickyRow'])).toEqual(['8', '15']);
    });

    it('stacks the next sticky as soon as its top reaches the bottom of the prior stuck row', () => {
      // Sticky indices 3 and 8. rowHeight 28. offset(8) = 224.
      // With idx=3 already stuck (height 28), idx=8 should latch when its
      // top reaches the bottom of the stack — i.e. scrollTop + 28 > 224,
      // so scrollTop > 196. NOT 224 (which would be after idx=8 has been
      // fully covered by idx=3).
      const plugin = new StickyRowsPlugin({ isSticky: 'flag', mode: 'stack' });
      const grid = createMockGrid({ rows, renderedIndices: rendered });
      plugin.attach(grid);
      plugin.afterRender();
      // scrollTop = 197 → idx=3 stuck (offset 84 < 197), idx=8 should also
      // qualify because offset(8)=224 < 197 + 28 = 225.
      plugin.onScroll(scrollEvent(197));
      let stuck = grid.querySelectorAll('.tbw-sticky-rows .tbw-sticky-row');
      expect(Array.from(stuck).map((el) => (el as HTMLElement).dataset['stickyRow'])).toEqual(['3', '8']);
      // scrollTop = 195 → idx=8 should NOT yet qualify (224 < 223 is false).
      plugin.onScroll(scrollEvent(195));
      stuck = grid.querySelectorAll('.tbw-sticky-rows .tbw-sticky-row');
      expect(Array.from(stuck).map((el) => (el as HTMLElement).dataset['stickyRow'])).toEqual(['3']);
    });

    it('animates the swap when at maxStacked: slides the stack up as the live next sticky approaches', () => {
      // Sticky indices 3, 8, 15. rowHeight 28. maxStacked=2 → settles to
      // [8, 15] once idx=15 has fully crossed the slot of idx=3. During
      // anticipation we keep showing [3, 8] but translate the container
      // upward as live idx=15 scrolls into the stack region — the live
      // row scrolls naturally beneath the stack (no clone added, no
      // duplicate row visible).
      //
      // sumStuckHeight for [3, 8] = 56. offsetOf(15) = 420.
      // Anticipation activates when distance < 0 — i.e. live idx=15's top
      // has reached the bottom of the stack: scrollTop + 56 > 420, so
      // scrollTop > 364. Push offset = scrollTop - 364, capped at
      // heightOf(3) = 28. Swap (evict-and-promote) at scrollTop > 392.
      const plugin = new StickyRowsPlugin({ isSticky: 'flag', mode: 'stack', maxStacked: 2 });
      const grid = createMockGrid({ rows, renderedIndices: rendered });
      plugin.attach(grid);
      plugin.afterRender();

      // scrollTop=336 → distance=28, no anticipation, [3, 8] no transform.
      plugin.onScroll(scrollEvent(336));
      let container = grid.querySelector('.tbw-sticky-rows') as HTMLElement;
      expect(
        Array.from(container.querySelectorAll('.tbw-sticky-row')).map((el) => (el as HTMLElement).dataset['stickyRow']),
      ).toEqual(['3', '8']);
      expect(container.style.transform).toBe('');

      // scrollTop=378 → distance=-14, push 14. Still [3, 8] (no clone for
      // 15 yet — live row scrolls beneath the stack).
      plugin.onScroll(scrollEvent(378));
      container = grid.querySelector('.tbw-sticky-rows') as HTMLElement;
      expect(
        Array.from(container.querySelectorAll('.tbw-sticky-row')).map((el) => (el as HTMLElement).dataset['stickyRow']),
      ).toEqual(['3', '8']);
      expect(container.style.transform).toBe('translateY(-14px)');

      // scrollTop=393 → idx=15 fully crosses idx=3's slot
      // (420 < 393 + 56 - 28 = 421). Evict-and-promote: [8, 15], no
      // transform. At this exact pixel the live idx=15 sits at slot-3 of
      // the new stack, so the swap is seamless.
      plugin.onScroll(scrollEvent(393));
      container = grid.querySelector('.tbw-sticky-rows') as HTMLElement;
      expect(
        Array.from(container.querySelectorAll('.tbw-sticky-row')).map((el) => (el as HTMLElement).dataset['stickyRow']),
      ).toEqual(['8', '15']);
      expect(container.style.transform).toBe('');
    });
  });

  // #endregion

  // #region clone hygiene

  describe('clones', () => {
    it('marks clones as aria-hidden and strips focus styling', () => {
      const plugin = new StickyRowsPlugin({ isSticky: 'flag' });
      const grid = createMockGrid({ rows: [{ flag: true }, { flag: false }], renderedIndices: [0, 1] });
      // Add focus styling to the source row to verify the clone strips it.
      const liveRow = grid.querySelector('.rows .data-grid-row') as HTMLElement;
      liveRow.classList.add('row-focus');
      liveRow.setAttribute('tabindex', '0');

      plugin.attach(grid);
      plugin.afterRender();
      plugin.onScroll(scrollEvent(28));

      const clone = grid.querySelector('.tbw-sticky-rows .tbw-sticky-row') as HTMLElement;
      expect(clone.getAttribute('aria-hidden')).toBe('true');
      expect(clone.classList.contains('row-focus')).toBe(false);
      expect(clone.hasAttribute('tabindex')).toBe(false);
    });

    it('keeps cached clones when the underlying row leaves the rendered window', () => {
      const plugin = new StickyRowsPlugin({ isSticky: 'flag' });
      // Initially row 0 is rendered.
      const grid = createMockGrid({
        rows: [{ flag: true }, { flag: false }, { flag: false }, { flag: false }],
        renderedIndices: [0, 1, 2, 3],
      });
      plugin.attach(grid);
      plugin.afterRender();
      plugin.onScroll(scrollEvent(28));
      expect(grid.querySelector('.tbw-sticky-rows .tbw-sticky-row')).not.toBeNull();

      // Simulate virtualization sliding row 0 out of the window: remove it
      // from the .rows pool. The clone should remain visible.
      const liveRow = grid.querySelector('.rows .data-grid-row[data-test-row="0"]')?.parentElement
        ? (grid.querySelector('.rows .data-grid-row[data-test-row="0"]') as HTMLElement)
        : (grid.querySelector('.rows .data-grid-row') as HTMLElement);
      liveRow.remove();

      plugin.onScroll(scrollEvent(56));
      const stuck = grid.querySelectorAll('.tbw-sticky-rows .tbw-sticky-row');
      expect(stuck.length).toBe(1);
      expect((stuck[0] as HTMLElement).dataset['stickyRow']).toBe('0');
    });
  });

  // #endregion
});
