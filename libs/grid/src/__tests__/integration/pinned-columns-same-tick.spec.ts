/**
 * PinnedColumnsPlugin: several `setPinPosition` calls in the same tick all apply (#618).
 * `grid.columns = …` is processed in a microtask, so each call must build on the list the
 * previous call queued, not on the stale processed columns.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createGrid, waitUpgrade } from '../../../test/helpers';
import '../../lib/core/grid';
import type { DataGridElement } from '../../lib/core/grid';
import type { ColumnConfig } from '../../lib/core/types';
import { PinnedColumnsPlugin } from '../../lib/plugins/pinned-columns/pinned-columns-plugin';

async function setup(extra: Record<string, Partial<ColumnConfig>> = {}) {
  const pinned = new PinnedColumnsPlugin();
  const grid = createGrid();
  grid.gridConfig = {
    columns: ['c0', 'c1', 'c2', 'c3'].map((field) => ({ field, header: field, width: 100, ...extra[field] })),
    plugins: [pinned],
  };
  grid.rows = [{ c0: 1, c1: 2, c2: 3, c3: 4 }];
  await waitUpgrade(grid);
  return { grid, pinned };
}

const layout = (grid: DataGridElement) => grid.columns.map((c) => c.field + (c.pinned ? '@' + c.pinned : ''));
const hiddenFields = (grid: DataGridElement) => grid.columns.filter((c) => c.hidden).map((c) => c.field);

describe('PinnedColumns same-tick setPinPosition (#618)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('two pins in the same tick both apply', async () => {
    const { grid, pinned } = await setup();
    pinned.setPinPosition('c3', 'left');
    pinned.setPinPosition('c2', 'right');
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['c3@left', 'c0', 'c1', 'c2@right']);
  });

  it('same-side pins in the same tick keep call order, like separate ticks', async () => {
    const { grid, pinned } = await setup();
    pinned.setPinPosition('c3', 'left');
    pinned.setPinPosition('c1', 'left');
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['c3@left', 'c1@left', 'c0', 'c2']);
  });

  it('pin then unpin of the same column in the same tick restores the original layout', async () => {
    const { grid, pinned } = await setup();
    pinned.setPinPosition('c1', 'left');
    pinned.setPinPosition('c1', undefined);
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['c0', 'c1', 'c2', 'c3']);
  });

  it('unpin in the same tick as another pin keeps that pin', async () => {
    const { grid, pinned } = await setup();
    pinned.setPinPosition('c2', 'left');
    await waitUpgrade(grid);

    pinned.setPinPosition('c3', 'right');
    pinned.setPinPosition('c2', undefined);
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['c0', 'c1', 'c2', 'c3@right']);
  });

  it('a column assignment applied between ticks is not overwritten by the next pin', async () => {
    const { grid, pinned } = await setup();
    pinned.setPinPosition('c3', 'left');
    await waitUpgrade(grid);

    grid.columns = grid.columns.filter((c) => c.field !== 'c1');
    await waitUpgrade(grid);
    pinned.setPinPosition('c0', 'right');
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['c3@left', 'c2', 'c0@right']);
  });

  // A runtime change to the pinned column before the grid applies the pin must survive (PR #628).
  it.each([
    ['pin; hide', ['c3@left', 'c0', 'c1', 'c2']],
    ['pin; hide; pin another', ['c3@left', 'c0', 'c1', 'c2@right']],
  ])('%s in the same tick keeps the hidden state', async (sequence, expected) => {
    const { grid, pinned } = await setup();
    pinned.setPinPosition('c3', 'left');
    grid.setColumnVisible('c3', false);
    if (sequence.endsWith('another')) pinned.setPinPosition('c2', 'right');
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(expected);
    expect(hiddenFields(grid)).toEqual(['c3']);
  });

  it('pinning keeps an explicit column `order` where it was (PR #628)', async () => {
    const { grid, pinned } = await setup({ c1: { order: 1 } });
    pinned.setPinPosition('c3', 'left');
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['c3@left', 'c0', 'c1', 'c2']);
  });

  type Op = [field: string, position: 'left' | 'right' | undefined];
  it.each<[string, Op[], Op[]]>([
    [
      'two pins',
      [],
      [
        ['c3', 'left'],
        ['c2', 'right'],
      ],
    ],
    [
      'pin + unpin after an earlier pin',
      [['c3', 'left']],
      [
        ['c2', 'right'],
        ['c3', undefined],
      ],
    ],
  ])('with an explicit column `order`, same-tick %s match separate ticks', async (_, before, ops) => {
    const run = async (sameTick: boolean) => {
      const { grid, pinned } = await setup({ c1: { order: 1 } });
      for (const [field, position] of before) pinned.setPinPosition(field, position);
      await waitUpgrade(grid);
      for (const [field, position] of ops) {
        pinned.setPinPosition(field, position);
        if (!sameTick) await waitUpgrade(grid);
      }
      await waitUpgrade(grid);
      return layout(grid);
    };

    expect(await run(true)).toEqual(await run(false));
  });
});
