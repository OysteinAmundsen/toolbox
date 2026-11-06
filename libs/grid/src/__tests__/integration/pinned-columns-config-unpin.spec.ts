/**
 * PinnedColumnsPlugin: unpinning a column pinned in the config (#624).
 * - A column pinned through the deprecated `meta.pinned` fallback must actually unpin: the plugin
 *   still honors `meta.pinned`, so unpin clears it as well as the top-level `pinned`.
 * - A config pin (top-level or legacy) returns to its declared slot, not the edge it was moved to.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createGrid, waitUpgrade } from '../../../test/helpers';
import '../../lib/core/grid';
import type { DataGridElement } from '../../lib/core/grid';
import type { ColumnConfig } from '../../lib/core/types';
import { PinnedColumnsPlugin } from '../../lib/plugins/pinned-columns/pinned-columns-plugin';
import { PivotPlugin } from '../../lib/plugins/pivot/pivot-plugin';

async function setup(columns: ColumnConfig[]) {
  const pinned = new PinnedColumnsPlugin();
  const grid = createGrid();
  grid.gridConfig = { columns, plugins: [pinned] };
  grid.rows = [{ a: 1, b: 2, c: 3 }];
  await waitUpgrade(grid);
  return { grid, pinned };
}

const fields = (grid: DataGridElement) => grid.columns.map((c) => c.field);
const config = (): ColumnConfig[] => [{ field: 'a' }, { field: 'b', pinned: 'left' }, { field: 'c' }];
const headerCell = (grid: DataGridElement, field: string) =>
  grid.querySelector<HTMLElement>(`.header-row .cell[data-field="${field}"]`);

describe('PinnedColumns unpin of a config-pinned column (#624)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it.each([
    ['left', ['b', 'a', 'c']],
    ['right', ['a', 'c', 'b']],
  ] as const)('unpins a column pinned %s in the config back to its declared slot', async (side, initial) => {
    const { grid, pinned } = await setup([{ field: 'a' }, { field: 'b', pinned: side }, { field: 'c' }]);
    expect(fields(grid)).toEqual(initial);

    pinned.setPinPosition('b', undefined);
    await waitUpgrade(grid);

    expect(fields(grid)).toEqual(['a', 'b', 'c']);
  });

  it('unpins the column and restores its original slot', async () => {
    const { grid, pinned } = await setup([{ field: 'a' }, { field: 'b', meta: { pinned: 'left' } }, { field: 'c' }]);
    expect(fields(grid)).toEqual(['b', 'a', 'c']);
    expect(headerCell(grid, 'b')?.classList.contains('sticky-left')).toBe(true);

    pinned.setPinPosition('b', undefined);
    await waitUpgrade(grid);

    expect(fields(grid)).toEqual(['a', 'b', 'c']);
    expect(headerCell(grid, 'b')?.classList.contains('sticky-left')).toBe(false);
    expect(pinned.getLeftPinnedColumns()).toEqual([]);
  });

  it('keeps other meta keys and does not mutate the user config', async () => {
    const userMeta = { pinned: 'left', note: 'keep' };
    const { grid, pinned } = await setup([{ field: 'a' }, { field: 'b', meta: userMeta }, { field: 'c' }]);

    pinned.setPinPosition('b', undefined);
    await waitUpgrade(grid);

    expect(grid.columns.find((c) => c.field === 'b')?.meta).toEqual({ note: 'keep' });
    expect(userMeta).toEqual({ pinned: 'left', note: 'keep' });
  });

  it('unpins after the legacy pin was moved to the other side', async () => {
    const { grid, pinned } = await setup([{ field: 'a' }, { field: 'b', meta: { pinned: 'left' } }, { field: 'c' }]);

    pinned.setPinPosition('b', 'right');
    await waitUpgrade(grid);
    expect(fields(grid)).toEqual(['a', 'c', 'b']);

    pinned.setPinPosition('b', undefined);
    await waitUpgrade(grid);

    expect(fields(grid)).toEqual(['a', 'b', 'c']);
    expect(headerCell(grid, 'b')?.classList.contains('sticky-right')).toBe(false);
  });

  // Later COLUMNS passes re-feed the partitioned list, so the declared slot must be captured before (PR #637 review).
  describe('keeps the declared slot across passes that re-feed the partitioned list', () => {
    it('a visibility change before the unpin', async () => {
      const { grid, pinned } = await setup(config());
      grid.setColumnVisible('c', false);
      await waitUpgrade(grid);

      pinned.setPinPosition('b', undefined);
      await waitUpgrade(grid);
      grid.setColumnVisible('c', true);
      await waitUpgrade(grid);

      expect(fields(grid)).toEqual(['a', 'b', 'c']);
    });

    it('applyColumnState before the unpin', async () => {
      const { grid, pinned } = await setup(config());
      grid.applyColumnState(grid.getColumnState());
      await waitUpgrade(grid);

      pinned.setPinPosition('b', undefined);
      await waitUpgrade(grid);

      expect(fields(grid)).toEqual(['a', 'b', 'c']);
    });

    it.each(['pinned-first', 'pivot-first'])('a pivot round-trip (%s)', async (order) => {
      const pinned = new PinnedColumnsPlugin();
      const pivot = new PivotPlugin({
        rowGroupFields: ['c0'],
        columnGroupFields: ['c2'],
        valueFields: [{ field: 'c1', aggFunc: 'sum' }],
        showToolPanel: false,
      });
      const grid = createGrid();
      grid.gridConfig = {
        columns: [{ field: 'c0' }, { field: 'b', pinned: 'left' }, { field: 'c1' }, { field: 'c2' }],
        plugins: order === 'pinned-first' ? [pinned, pivot] : [pivot, pinned],
      };
      grid.rows = Array.from({ length: 4 }, (_, i) => ({ c0: 'A', b: i, c1: i, c2: `k${i % 2}` }));
      await waitUpgrade(grid);
      const step = async (action: () => void) => {
        action();
        await waitUpgrade(grid);
      };

      await step(() => pinned.setPinPosition('k1|c1', 'left'));
      await step(() => pivot.disablePivot());
      expect(fields(grid)).toEqual(['b', 'c0', 'c1', 'c2']);
      await step(() => pinned.setPinPosition('b', undefined));

      expect(fields(grid)).toEqual(['c0', 'b', 'c1', 'c2']);
    });
  });

  // A `columns` replacement re-declares a pin's slot; the old snapshot must not override it (PR #637 review).
  describe('takes a re-declared slot from a columns replacement', () => {
    it('a field that was unpinned before', async () => {
      const { grid, pinned } = await setup([
        { field: 'a' },
        { field: 'b' },
        { field: 'c' },
        { field: 'd', pinned: 'right' },
      ]);
      grid.columns = [{ field: 'c' }, { field: 'b', pinned: 'left' }, { field: 'a' }, { field: 'd', pinned: 'right' }];
      await waitUpgrade(grid);

      pinned.setPinPosition('b', undefined);
      await waitUpgrade(grid);

      expect(fields(grid)).toEqual(['c', 'b', 'a', 'd']);
    });

    it('a pin that went through an unpinned layout', async () => {
      const { grid, pinned } = await setup(config());
      grid.columns = [{ field: 'a' }, { field: 'b' }, { field: 'c' }];
      await waitUpgrade(grid);
      grid.columns = [{ field: 'a' }, { field: 'c' }, { field: 'b', pinned: 'left' }];
      await waitUpgrade(grid);

      pinned.setPinPosition('b', undefined);
      await waitUpgrade(grid);

      expect(fields(grid)).toEqual(['a', 'c', 'b']);
    });

    it.each([
      [
        'a new pin before a known pin',
        [{ field: 'a' }, { field: 'x', pinned: 'left' }, { field: 'b', pinned: 'left' }, { field: 'c' }],
        ['x', 'b'],
        ['a', 'x', 'b', 'c'],
      ],
      [
        'a newly pinned leading column',
        [{ field: 'a', pinned: 'left' }, { field: 'b', pinned: 'left' }, { field: 'c' }],
        ['a', 'b'],
        ['a', 'b', 'c'],
      ],
    ] as const)('keeps declared order with %s', async (_name, columns, unpin, expected) => {
      const { grid, pinned } = await setup(config());
      grid.columns = columns.map((c) => ({ ...c }));
      await waitUpgrade(grid);

      for (const field of unpin) {
        pinned.setPinPosition(field, undefined);
        await waitUpgrade(grid);
      }

      expect(fields(grid)).toEqual(expected);
    });
  });
});
