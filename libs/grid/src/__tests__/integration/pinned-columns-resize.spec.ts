/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGrid, nextFrame, waitUpgrade } from '../../../test/helpers';
import '../../lib/core/grid';
import { GroupingColumnsPlugin } from '../../lib/plugins/grouping-columns';
import { PinnedColumnsPlugin } from '../../lib/plugins/pinned-columns/pinned-columns-plugin';

/**
 * An in-place resize only rewrites the grid template — nothing renders, so `afterRender` never runs.
 * PinnedColumns must still re-measure its sticky offsets (#676).
 */
describe('PinnedColumns re-measures sticky offsets after an in-place resize (#676)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  async function setup() {
    const grid = createGrid();
    const pinned = new PinnedColumnsPlugin();
    grid.gridConfig = {
      fitMode: 'fixed',
      plugins: [pinned],
      columns: Array.from({ length: 6 }, (_, i) => ({
        field: `c${i}`,
        width: 100,
        pinned: i < 2 ? 'left' : undefined,
      })),
    };
    grid.rows = [{ c0: 'a' }];
    // happy-dom has no layout: a cell is as wide as its track in the APPLIED template, so a measure
    // taken before the resize controller's template update reads the old width, as in a browser.
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      const index = grid._visibleColumns.findIndex((c) => c.field === this.getAttribute('data-field'));
      return parseFloat(grid.style.getPropertyValue('--tbw-column-template').split(' ')[index]) || 0;
    });
    await waitUpgrade(grid);
    const leftOf = (field: string) =>
      [...grid.querySelectorAll<HTMLElement>(`.cell[data-field="${field}"]`)].map((cell) => cell.style.left);
    return { grid, pinned, leftOf };
  }

  it('moves the next pinned column when a pinned column is resized', async () => {
    const { grid, leftOf } = await setup();
    expect(leftOf('c1')).toEqual(['100px', '100px']);

    grid._resizeController.setColumnWidth(0, 116);
    await waitUpgrade(grid);

    expect(leftOf('c1')).toEqual(['116px', '116px']);
  });

  it('moves it back when the resized column is reset', async () => {
    const { grid, leftOf } = await setup();
    grid._resizeController.setColumnWidth(0, 116);
    await waitUpgrade(grid);
    expect(leftOf('c1')).toEqual(['116px', '116px']);

    grid._resizeController.resetColumn(0);
    await waitUpgrade(grid);

    expect(leftOf('c1')).toEqual(['100px', '100px']);
  });

  it('measures after a resize that follows a reset in the same tick', async () => {
    const { grid, leftOf } = await setup();
    grid._resizeController.setColumnWidth(0, 116);
    await waitUpgrade(grid);

    // The reset updates the template synchronously; the resize queues its template frame after.
    grid._resizeController.resetColumn(0);
    grid._resizeController.setColumnWidth(0, 200);
    await waitUpgrade(grid);

    expect(leftOf('c1')).toEqual(['200px', '200px']);
  });

  it('re-measures once per frame however many resizes it coalesces', async () => {
    const { grid, pinned, leftOf } = await setup();
    const refresh = vi.spyOn(pinned, 'refreshStickyOffsets');

    grid._resizeController.setColumnWidth(0, 110);
    grid._resizeController.setColumnWidth(0, 120);
    grid._resizeController.setColumnWidth(0, 130);
    await waitUpgrade(grid);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(leftOf('c1')).toEqual(['130px', '130px']);
  });

  /**
   * A labelled group spanning a pinned and an unpinned column is split into two fragments; scrolling moves its
   * label into the pinned fragment and back (PR #677). happy-dom has no layout: the stub puts the scrollable
   * fragment's right edge past the pinned one until `scrolled` is set.
   */
  async function setupSplitGroup() {
    const grid = createGrid();
    const pinned = new PinnedColumnsPlugin();
    grid.gridConfig = {
      fitMode: 'fixed',
      columns: [
        { field: 'name', width: 120, pinned: 'left' },
        { field: 'email', width: 200 },
        { field: 'dept', width: 120 },
      ],
      columnGroups: [{ id: 'personal', header: 'Personal', children: ['name', 'email'] }],
      plugins: [new GroupingColumnsPlugin(), pinned],
    };
    grid.rows = [{ name: 'a' }];
    let scrolled = false;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const right = this.classList.contains('sticky-left') ? 100 : scrolled ? 50 : 300;
      return DOMRect.fromRect({ x: right, width: 0 });
    });
    await waitUpgrade(grid);
    const scrollTo = async (value: boolean) => {
      scrolled = value;
      grid.querySelector('.tbw-scroll-area')!.dispatchEvent(new Event('scroll'));
      await nextFrame();
    };
    const pinnedLabel = () => grid.querySelector('.header-group-cell.sticky-left[data-group="personal"]')?.textContent;
    const resize = async () => {
      grid._resizeController.setColumnWidth(2, 80);
      await waitUpgrade(grid);
    };
    return { scrollTo, pinnedLabel, resize };
  }

  it('keeps moving a split group label on scroll after a resize', async () => {
    const { scrollTo, pinnedLabel, resize } = await setupSplitGroup();
    await resize();

    await scrollTo(true);
    expect(pinnedLabel()).toBe('Personal');
    await scrollTo(false);
    expect(pinnedLabel()).toBe('');
  });

  it('moves a label transferred before a resize back on scroll', async () => {
    const { scrollTo, pinnedLabel, resize } = await setupSplitGroup();
    await scrollTo(true);
    expect(pinnedLabel()).toBe('Personal');

    await resize();
    await scrollTo(false);

    expect(pinnedLabel()).toBe('');
  });
});
