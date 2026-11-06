/**
 * A column `order` is an INITIAL position (#629). It must not be re-applied when the grid's own
 * runtime columns are written back to `grid.columns` (as `setPinPosition` does), or pinning an
 * unrelated column reshuffles the unpinned ones and undoes a runtime reorder.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGrid, waitUpgrade } from '../../../test/helpers';
import '../../lib/core/grid';
import type { DataGridElement } from '../../lib/core/grid';
import type { ColumnConfig } from '../../lib/core/types';
import { PinnedColumnsPlugin } from '../../lib/plugins/pinned-columns/pinned-columns-plugin';

const fields = ['c0', 'c1', 'c2', 'c3'];
const declared = (c1Order = 1): ColumnConfig[] =>
  fields.map((field) => ({ field, header: field, width: 100, ...(field === 'c1' ? { order: c1Order } : {}) }));

async function setup(c1Order = 1) {
  const pinned = new PinnedColumnsPlugin();
  const grid = createGrid();
  grid.gridConfig = { columns: declared(c1Order), plugins: [pinned] };
  grid.rows = [{ c0: 1, c1: 2, c2: 3, c3: 4 }];
  await waitUpgrade(grid);
  return { grid, pinned };
}

const layout = (grid: DataGridElement) => grid.columns.map((c) => c.field + (c.pinned ? '@' + c.pinned : ''));

describe('PinnedColumns with an explicit column `order` (#629)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('pinning a second column does not move the unpinned columns', async () => {
    const { grid, pinned } = await setup();
    pinned.setPinPosition('c3', 'left');
    await waitUpgrade(grid);
    expect(layout(grid)).toEqual(['c3@left', 'c0', 'c1', 'c2']);

    pinned.setPinPosition('c2', 'right');
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['c3@left', 'c0', 'c1', 'c2@right']);
  });

  type Op = [field: string, position: 'left' | 'right' | undefined];
  it.each<[string, Op[], Op[], string[] | null]>([
    [
      'two pins',
      [],
      [
        ['c3', 'left'],
        ['c2', 'right'],
      ],
      ['c3@left', 'c0', 'c1', 'c2@right'],
    ],
    [
      'pin + unpin after an earlier pin',
      [['c3', 'left']],
      [
        ['c2', 'right'],
        ['c3', undefined],
      ],
      null,
    ],
  ])('after a live `order` change, same-tick %s match separate ticks (PR #639)', async (_, before, ops, expected) => {
    const run = async (sameTick: boolean) => {
      const { grid, pinned } = await setup(0);
      for (const [field, position] of before) pinned.setPinPosition(field, position);
      await waitUpgrade(grid);
      const c1 = grid.columns.find((c) => c.field === 'c1');
      if (c1) c1.order = 1;
      for (const [field, position] of ops) {
        pinned.setPinPosition(field, position);
        if (!sameTick) await waitUpgrade(grid);
      }
      await waitUpgrade(grid);
      return layout(grid);
    };

    const separate = await run(false);
    if (expected) expect(separate).toEqual(expected);
    expect(await run(true)).toEqual(separate);
  });

  it('unpinning restores the declared layout', async () => {
    const { grid, pinned } = await setup();
    pinned.setPinPosition('c3', 'left');
    await waitUpgrade(grid);
    pinned.setPinPosition('c2', 'right');
    await waitUpgrade(grid);

    pinned.setPinPosition('c3', undefined);
    await waitUpgrade(grid);
    pinned.setPinPosition('c2', undefined);
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['c0', 'c1', 'c2', 'c3']);
  });

  it('pinning keeps a runtime reorder of the `order` column', async () => {
    const { grid, pinned } = await setup();
    grid.setColumnOrder(['c0', 'c2', 'c3', 'c1']);
    await waitUpgrade(grid);

    pinned.setPinPosition('c0', 'left');
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['c0@left', 'c2', 'c3', 'c1']);
  });

  it('still applies `order` to newly assigned column objects', async () => {
    const { grid } = await setup();
    grid.columns = [{ field: 'c3' }, { field: 'c0' }, { field: 'c2', order: 0 }, { field: 'c1' }];
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['c2', 'c3', 'c0', 'c1']);
  });

  it('re-applies an `order` changed on a runtime column', async () => {
    const { grid } = await setup();
    grid.columns = grid.columns.map((c) => (c.field === 'c3' ? { ...c, order: 0 } : c));
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['c3', 'c0', 'c1', 'c2']);
  });

  it('updates a pinned column return position when its live `order` changes and it switches sides', async () => {
    const { grid, pinned } = await setup();
    pinned.setPinPosition('c1', 'left');
    await waitUpgrade(grid);

    grid.columns.find((c) => c.field === 'c1')!.order = 3;
    pinned.setPinPosition('c1', 'right');
    await waitUpgrade(grid);
    expect(layout(grid)).toEqual(['c0', 'c2', 'c3', 'c1@right']);

    pinned.setPinPosition('c1', undefined);
    await waitUpgrade(grid);
    expect(layout(grid)).toEqual(['c0', 'c2', 'c3', 'c1']);
  });

  it('updates a pinned column return position when a columns write-back changes its `order`', async () => {
    const { grid, pinned } = await setup();
    pinned.setPinPosition('c1', 'left');
    await waitUpgrade(grid);

    grid.columns = grid.columns.map((column) => (column.field === 'c1' ? { ...column, order: 3 } : { ...column }));
    await waitUpgrade(grid);

    pinned.setPinPosition('c1', undefined);
    await waitUpgrade(grid);
    expect(layout(grid)).toEqual(['c0', 'c2', 'c3', 'c1']);
  });

  const setupTiedOrderWriteBack = async () => {
    const pinned = new PinnedColumnsPlugin();
    const grid = createGrid();
    grid.gridConfig = {
      columns: [{ field: 'a' }, { field: 'b' }, { field: 'c', order: 2 }, { field: 'd' }],
      plugins: [pinned],
    };
    grid.rows = [{ a: 1, b: 2, c: 3, d: 4 }];
    await waitUpgrade(grid);

    pinned.setPinPosition('c', 'right');
    await waitUpgrade(grid);
    grid.columns = grid.columns.map((column) =>
      column.field === 'b' || column.field === 'c' ? { ...column, order: 0 } : { ...column },
    );
    await waitUpgrade(grid);
    return { grid, pinned };
  };

  it('preserves unchanged runtime-ordered peers when a pinned order changes to a consumed tie', async () => {
    const pinned = new PinnedColumnsPlugin();
    const grid = createGrid();
    grid.gridConfig = {
      columns: [{ field: 'a' }, { field: 'd' }, { field: 'b', order: 0 }, { field: 'c', order: 2 }],
      plugins: [pinned],
    };
    grid.rows = [{ a: 1, b: 2, c: 3, d: 4 }];
    await waitUpgrade(grid);
    grid.setColumnOrder(['a', 'd', 'b', 'c']);
    await waitUpgrade(grid);
    pinned.setPinPosition('c', 'right');
    await waitUpgrade(grid);

    grid.columns = grid.columns.map((column) => (column.field === 'c' ? { ...column, order: 0 } : { ...column }));
    await waitUpgrade(grid);
    expect(layout(grid)).toEqual(['a', 'd', 'b', 'c@right']);

    pinned.setPinPosition('c', undefined);
    await waitUpgrade(grid);
    expect(layout(grid)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('preserves other placements when pinned columns change to distinct orders together', async () => {
    const pinned = new PinnedColumnsPlugin();
    const grid = createGrid();
    grid.gridConfig = {
      columns: [
        { field: 'a' },
        { field: 'b', order: 0 },
        { field: 'c', order: 2 },
        { field: 'd' },
        { field: 'e', order: 4 },
      ],
      plugins: [pinned],
    };
    grid.rows = [{ a: 1, b: 2, c: 3, d: 4, e: 5 }];
    await waitUpgrade(grid);
    grid.setColumnOrder(['a', 'd', 'b', 'c', 'e']);
    await waitUpgrade(grid);
    pinned.setPinPosition('c', 'right');
    pinned.setPinPosition('e', 'right');
    await waitUpgrade(grid);

    grid.columns = grid.columns.map((column) =>
      column.field === 'c' ? { ...column, order: 0 } : column.field === 'e' ? { ...column, order: 3 } : { ...column },
    );
    await waitUpgrade(grid);

    pinned.setPinPosition('c', undefined);
    await waitUpgrade(grid);
    pinned.setPinPosition('e', undefined);
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['a', 'd', 'b', 'e', 'c']);
  });

  it('uses the full-list order index when refreshing a pin after an earlier pin', async () => {
    const pinned = new PinnedColumnsPlugin();
    const grid = createGrid();
    grid.gridConfig = {
      columns: [{ field: 'a' }, { field: 'b' }, { field: 'c', order: 2 }, { field: 'd' }],
      plugins: [pinned],
    };
    grid.rows = [{ a: 1, b: 2, c: 3, d: 4 }];
    await waitUpgrade(grid);

    pinned.setPinPosition('a', 'left');
    await waitUpgrade(grid);
    pinned.setPinPosition('c', 'right');
    await waitUpgrade(grid);

    grid.columns = grid.columns.map((column) => (column.field === 'c' ? { ...column, order: 1 } : { ...column }));
    await waitUpgrade(grid);
    pinned.setPinPosition('c', undefined);
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['a@left', 'c', 'b', 'd']);
  });

  it('places distinct simultaneous order changes before capturing the pin anchor', async () => {
    const pinned = new PinnedColumnsPlugin();
    const grid = createGrid();
    grid.gridConfig = {
      columns: [
        { field: 'a' },
        { field: 'b', order: 2 },
        { field: 'c', order: 1 },
        { field: 'p', order: 3, pinned: 'right' },
      ],
      plugins: [pinned],
    };
    grid.rows = [{ a: 1, b: 2, c: 3, p: 4 }];
    await waitUpgrade(grid);

    grid.columns.find((column) => column.field === 'c')!.order = 0;
    grid.columns.find((column) => column.field === 'p')!.order = 0;
    grid.columns.find((column) => column.field === 'b')!.order = 1;
    pinned.setPinPosition('p', 'left');
    await waitUpgrade(grid);
    pinned.setPinPosition('p', undefined);
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['c', 'b', 'p', 'a']);
  });

  it('preserves consumed unpinned positions when changing a pinned and unpinned order together', async () => {
    const pinned = new PinnedColumnsPlugin();
    const grid = createGrid();
    grid.gridConfig = {
      columns: [
        { field: 'a' },
        { field: 'd' },
        { field: 'b', order: 0 },
        { field: 'c', order: 2 },
        { field: 'p', order: 4, pinned: 'right' },
      ],
      plugins: [pinned],
    };
    grid.rows = [{ a: 1, b: 2, c: 3, d: 4, p: 5 }];
    await waitUpgrade(grid);
    grid.setColumnOrder(['a', 'd', 'b', 'c', 'p']);
    await waitUpgrade(grid);

    grid.columns.find((column) => column.field === 'c')!.order = 0;
    grid.columns.find((column) => column.field === 'p')!.order = 1;
    pinned.setPinPosition('p', 'left');
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['p@left', 'a', 'd', 'b', 'c']);
  });

  it('does not consume an unpinned order change during a visibility-only pass', async () => {
    const pinned = new PinnedColumnsPlugin();
    const grid = createGrid();
    grid.gridConfig = {
      columns: [{ field: 'a' }, { field: 'b' }, { field: 'c', order: 2 }, { field: 'd' }],
      plugins: [pinned],
    };
    grid.rows = [{ a: 1, b: 2, c: 3, d: 4 }];
    await waitUpgrade(grid);

    grid.columns.find((column) => column.field === 'c')!.order = 0;
    expect(grid.setColumnVisible('d', false)).toBe(true);
    await waitUpgrade(grid);
    pinned.setPinPosition('a', 'left');
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['a@left', 'c', 'b', 'd']);
  });

  it('matches a columns write-back for an unpinned-only order change before switching a pin', async () => {
    const run = async (writeBack: boolean) => {
      const pinned = new PinnedColumnsPlugin();
      const grid = createGrid();
      grid.gridConfig = {
        columns: [
          { field: 'a' },
          { field: 'd' },
          { field: 'b', order: 0 },
          { field: 'c', order: 2 },
          { field: 'p', order: 4, pinned: 'right' },
        ],
        plugins: [pinned],
      };
      grid.rows = [{ a: 1, b: 2, c: 3, d: 4, p: 5 }];
      await waitUpgrade(grid);
      grid.setColumnOrder(['a', 'd', 'b', 'c', 'p']);
      await waitUpgrade(grid);

      grid.columns.find((column) => column.field === 'c')!.order = 0;
      if (writeBack) {
        grid.columns = grid.columns.map((column) => ({ ...column }));
        await waitUpgrade(grid);
      }
      pinned.setPinPosition('p', 'left');
      await waitUpgrade(grid);
      return layout(grid);
    };

    expect(await run(false)).toEqual(await run(true));
    expect(await run(false)).toEqual(['p@left', 'c', 'a', 'd', 'b']);
  });

  it('matches pending unpinned-order placement to an awaited pin operation', async () => {
    const run = async (sameTick: boolean) => {
      const pinned = new PinnedColumnsPlugin();
      const grid = createGrid();
      grid.gridConfig = {
        columns: [{ field: 'a' }, { field: 'd' }, { field: 'b', order: 0 }, { field: 'c', order: 2 }],
        plugins: [pinned],
      };
      grid.rows = [{ a: 1, b: 2, c: 3, d: 4 }];
      await waitUpgrade(grid);
      grid.setColumnOrder(['a', 'd', 'b', 'c']);
      await waitUpgrade(grid);

      pinned.setPinPosition('a', 'left');
      if (!sameTick) await waitUpgrade(grid);
      grid.columns.find((column) => column.field === 'c')!.order = 0;
      pinned.setPinPosition('d', 'right');
      await waitUpgrade(grid);
      return layout(grid);
    };

    const separate = await run(false);
    expect(await run(true)).toEqual(separate);
    expect(separate).toEqual(['a@left', 'c', 'b', 'd@right']);
  });

  it('matches immediate pin operations with an awaited columns write-back after a pinned order change', async () => {
    const run = async (writeBack: boolean, pinAnotherFirst: boolean) => {
      const pinned = new PinnedColumnsPlugin();
      const grid = createGrid();
      grid.gridConfig = {
        columns: [{ field: 'a' }, { field: 'd' }, { field: 'b', order: 0 }, { field: 'c', order: 2, pinned: 'right' }],
        plugins: [pinned],
      };
      grid.rows = [{ a: 1, b: 2, c: 3, d: 4 }];
      await waitUpgrade(grid);
      grid.setColumnOrder(['a', 'd', 'b', 'c']);
      await waitUpgrade(grid);

      grid.columns.find((column) => column.field === 'c')!.order = 0;
      if (writeBack) {
        grid.columns = grid.columns.map((column) => ({ ...column }));
        await waitUpgrade(grid);
      }
      if (pinAnotherFirst) {
        pinned.setPinPosition('a', 'left');
        await waitUpgrade(grid);
      }
      pinned.setPinPosition('c', undefined);
      await waitUpgrade(grid);
      if (pinAnotherFirst) {
        pinned.setPinPosition('a', undefined);
        await waitUpgrade(grid);
      }
      return layout(grid);
    };

    const immediateUnpin = await run(false, false);
    const writeBackUnpin = await run(true, false);
    expect(immediateUnpin).toEqual(writeBackUnpin);
    expect(immediateUnpin).toEqual(['a', 'd', 'b', 'c']);

    const immediateOtherPin = await run(false, true);
    const writeBackOtherPin = await run(true, true);
    expect(immediateOtherPin).toEqual(writeBackOtherPin);
    expect(immediateOtherPin).toEqual(['a', 'd', 'b', 'c']);
  });

  it.each([false, true])('carries a newly ordered column through source merges (lightDom=%s)', async (lightDom) => {
    const pinned = new PinnedColumnsPlugin();
    const grid = createGrid();
    if (lightDom) {
      grid.innerHTML = `
        <tbw-grid-column field="a"></tbw-grid-column>
        <tbw-grid-column field="b"></tbw-grid-column>
        <tbw-grid-column field="c"></tbw-grid-column>
        <tbw-grid-column field="d"></tbw-grid-column>
      `;
    }
    grid.gridConfig = {
      columns: ['a', 'b', 'c', 'd'].map((field) => ({ field })),
      plugins: [pinned],
    };
    grid.rows = [{ a: 1, b: 2, c: 3, d: 4 }];
    await waitUpgrade(grid);

    grid.columns.find((column) => column.field === 'b')!.order = 2;
    pinned.setPinPosition('b', 'left');
    pinned.setPinPosition('d', 'right');
    await waitUpgrade(grid);
    pinned.setPinPosition('b', undefined);
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['a', 'c', 'b', 'd@right']);
  });

  it('places a changed pinned order before a newly added tied column', async () => {
    const pinned = new PinnedColumnsPlugin();
    const grid = createGrid();
    grid.gridConfig = {
      columns: [{ field: 'a' }, { field: 'c', order: 1 }, { field: 'd' }],
      plugins: [pinned],
    };
    grid.rows = [{ a: 1, b: 2, c: 3, d: 4 }];
    await waitUpgrade(grid);

    pinned.setPinPosition('c', 'left');
    await waitUpgrade(grid);
    grid.columns = [
      ...grid.columns.map((column) => (column.field === 'c' ? { ...column, order: 0 } : { ...column })),
      { field: 'b', order: 0 },
    ];
    await waitUpgrade(grid);
    pinned.setPinPosition('c', undefined);
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['c', 'b', 'a', 'd']);
  });

  it('keeps fractional orders in the same floored placement cohort', async () => {
    const pinned = new PinnedColumnsPlugin();
    const grid = createGrid();
    grid.gridConfig = {
      columns: [{ field: 'a' }, { field: 'b' }, { field: 'c', order: 2 }, { field: 'd' }],
      plugins: [pinned],
    };
    grid.rows = [{ a: 1, b: 2, c: 3, d: 4 }];
    await waitUpgrade(grid);

    pinned.setPinPosition('c', 'left');
    await waitUpgrade(grid);
    grid.columns = grid.columns.map((column) =>
      column.field === 'c' ? { ...column, order: 0.1 } : column.field === 'b' ? { ...column, order: 0.9 } : column,
    );
    await waitUpgrade(grid);
    pinned.setPinPosition('c', undefined);
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['c', 'b', 'a', 'd']);
  });

  it('preserves saved columnState order when gridConfig changes declarative order', async () => {
    const pinned = new PinnedColumnsPlugin();
    const grid = createGrid();
    const columns = [{ field: 'a' }, { field: 'b', order: 1, pinned: 'left' as const }, { field: 'c' }, { field: 'd' }];
    const savedState = {
      columns: [
        { field: 'a', order: 0, visible: true },
        { field: 'c', order: 1, visible: true },
        { field: 'b', order: 2, visible: true },
        { field: 'd', order: 3, visible: true },
      ],
    };
    grid.gridConfig = { columns, columnState: savedState, plugins: [pinned] };
    grid.rows = [{ a: 1, b: 2, c: 3, d: 4 }];
    await waitUpgrade(grid);
    expect(layout(grid)).toEqual(['b@left', 'a', 'c', 'd']);

    grid.gridConfig = {
      columns: columns.map((column) =>
        column.field === 'b' || column.field === 'c' ? { ...column, order: 0 } : { ...column },
      ),
      columnState: savedState,
      plugins: [pinned],
    };
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['b@left', 'a', 'c', 'd']);
  });

  it('notifies pinned columns when saved order already matches the current order', async () => {
    const pinned = new PinnedColumnsPlugin();
    const grid = createGrid();
    const savedState = {
      columns: [
        { field: 'c', order: 0, visible: true },
        { field: 'a', order: 1, visible: true },
        { field: 'd', order: 2, visible: true },
        { field: 'e', order: 3, visible: true },
        { field: 'b', order: 4, visible: true },
      ],
    };
    grid.gridConfig = {
      columns: [
        { field: 'a' },
        { field: 'd' },
        { field: 'b', order: 0 },
        { field: 'e', order: 4, pinned: 'right' },
        { field: 'c', order: 2, pinned: 'right' },
      ],
      columnState: savedState,
      plugins: [pinned],
    };
    grid.rows = [{ a: 1, b: 2, c: 3, d: 4, e: 5 }];
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['a', 'd', 'b', 'c@right', 'e@right']);
    const onColumnStateOrderApplied = vi.spyOn(pinned, 'onColumnStateOrderApplied');

    const runtimeColumns = grid.columns;
    const columns = ['c', 'a', 'd', 'e', 'b'].map((field) => {
      const column = runtimeColumns.find((candidate) => candidate.field === field)!;
      if (field === 'c') return { ...column, order: 0 };
      if (field === 'e') return { ...column, order: 3 };
      return { ...column };
    });
    grid.gridConfig = { columns, columnState: savedState, plugins: [pinned] };
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['a', 'd', 'b', 'c@right', 'e@right']);
    expect(onColumnStateOrderApplied).toHaveBeenCalledOnce();
  });

  it('preserves visibility when a changed-order pin is hidden in the same tick', async () => {
    const { grid, pinned } = await setup();
    pinned.setPinPosition('c1', 'left');
    await waitUpgrade(grid);

    grid.columns.find((column) => column.field === 'c1')!.order = 3;
    pinned.setPinPosition('c1', 'right');
    expect(grid.setColumnVisible('c1', false)).toBe(true);
    await waitUpgrade(grid);

    expect(grid.columns.find((column) => column.field === 'c1')?.hidden).toBe(true);
  });

  it('does not let width-only column state suppress a later changed-order placement', async () => {
    const pinned = new PinnedColumnsPlugin();
    const grid = createGrid();
    grid.gridConfig = {
      columns: [{ field: 'a' }, { field: 'd' }, { field: 'b', order: 0 }, { field: 'c', order: 2 }],
      plugins: [pinned],
    };
    grid.rows = [{ a: 1, b: 2, c: 3, d: 4 }];
    await waitUpgrade(grid);

    grid.setColumnOrder(['a', 'd', 'b', 'c']);
    await waitUpgrade(grid);
    pinned.setPinPosition('c', 'right');
    await waitUpgrade(grid);
    grid.applyColumnState(grid.getColumnState());
    await waitUpgrade(grid);

    grid.columns.find((column) => column.field === 'c')!.order = 0;
    grid.columns = [...grid.columns];
    await waitUpgrade(grid);
    pinned.setPinPosition('c', undefined);
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('does not let width-only state suppress a same-tick columns write-back', async () => {
    const pinned = new PinnedColumnsPlugin();
    const grid = createGrid();
    grid.gridConfig = {
      columns: [{ field: 'a' }, { field: 'd' }, { field: 'b', order: 0 }, { field: 'c', order: 2 }],
      plugins: [pinned],
    };
    grid.rows = [{ a: 1, b: 2, c: 3, d: 4 }];
    await waitUpgrade(grid);

    grid.setColumnOrder(['a', 'd', 'b', 'c']);
    await waitUpgrade(grid);
    pinned.setPinPosition('c', 'right');
    await waitUpgrade(grid);
    grid.applyColumnState(grid.getColumnState());
    grid.columns.find((column) => column.field === 'c')!.order = 0;
    grid.columns = [...grid.columns];
    await waitUpgrade(grid);
    pinned.setPinPosition('c', undefined);
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('keeps changed tied orders placed after a pending pin is written back', async () => {
    const pinned = new PinnedColumnsPlugin();
    const grid = createGrid();
    grid.gridConfig = {
      columns: [{ field: 'a' }, { field: 'b' }, { field: 'c', order: 2 }, { field: 'd' }],
      plugins: [pinned],
    };
    grid.rows = [{ a: 1, b: 2, c: 3, d: 4 }];
    await waitUpgrade(grid);

    pinned.setPinPosition('c', 'right');
    await waitUpgrade(grid);
    grid.columns.find((column) => column.field === 'b')!.order = 0;
    grid.columns.find((column) => column.field === 'c')!.order = 0;
    pinned.setPinPosition('c', 'left');
    grid.columns = [...grid.columns];
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['c@left', 'b', 'a', 'd']);
  });

  it('preserves declared tie order when replacing columns with fresh definitions', async () => {
    const pinned = new PinnedColumnsPlugin();
    const grid = createGrid();
    grid.gridConfig = {
      columns: [
        { field: 'a' },
        { field: 'b', order: 0 },
        { field: 'c', order: 1 },
        { field: 'p', order: 2, pinned: 'right' },
      ],
      plugins: [pinned],
    };
    grid.rows = [{ a: 1, b: 2, c: 3, p: 4 }];
    await waitUpgrade(grid);

    grid.columns = [
      { field: 'a' },
      { field: 'p', order: 0, pinned: 'right' },
      { field: 'c', order: 0 },
      { field: 'b', order: 0 },
    ];
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['c', 'b', 'a', 'p@right']);
  });

  it('preserves a fresh distinct-order placement when replaying a pinned tie cohort', async () => {
    const pinned = new PinnedColumnsPlugin();
    const grid = createGrid();
    grid.gridConfig = {
      columns: [
        { field: 'a' },
        { field: 'b', order: 1 },
        { field: 'c', order: 2 },
        { field: 'p', order: 3, pinned: 'right' },
      ],
      plugins: [pinned],
    };
    grid.rows = [{ a: 1, b: 2, c: 3, p: 4 }];
    await waitUpgrade(grid);

    grid.columns = [
      { field: 'a' },
      { field: 'p', order: 0, pinned: 'right' },
      { field: 'c', order: 0 },
      { field: 'b', order: 1 },
    ];
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['b', 'c', 'a', 'p@right']);
  });

  it('refreshes a pinned return anchor for a fresh unchanged explicit order', async () => {
    const pinned = new PinnedColumnsPlugin();
    const grid = createGrid();
    grid.gridConfig = {
      columns: [{ field: 'a' }, { field: 'b', order: 1, pinned: 'left' }, { field: 'c' }, { field: 'd' }],
      plugins: [pinned],
    };
    grid.rows = [{ a: 1, b: 2, c: 3, d: 4 }];
    await waitUpgrade(grid);

    grid.columns = [{ field: 'd' }, { field: 'a' }, { field: 'b', order: 1, pinned: 'left' }, { field: 'c' }];
    await waitUpgrade(grid);
    pinned.setPinPosition('b', undefined);
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['d', 'b', 'a', 'c']);
  });

  it('a fresh replacement queued right after a side switch restores like one made after awaiting it (PR #639)', async () => {
    const run = async (sameTick: boolean) => {
      const pinned = new PinnedColumnsPlugin();
      const grid = createGrid();
      grid.gridConfig = {
        columns: [{ field: 'a' }, { field: 'b', order: 1, pinned: 'left' }, { field: 'c' }, { field: 'd' }],
        plugins: [pinned],
      };
      grid.rows = [{ a: 1, b: 2, c: 3, d: 4 }];
      await waitUpgrade(grid);

      const b = grid.columns.find((column) => column.field === 'b');
      if (b) b.order = 3;
      pinned.setPinPosition('b', 'right');
      if (!sameTick) await waitUpgrade(grid);
      grid.columns = [{ field: 'd' }, { field: 'a' }, { field: 'c' }, { field: 'b', order: 3, pinned: 'right' }];
      await waitUpgrade(grid);
      pinned.setPinPosition('b', undefined);
      await waitUpgrade(grid);

      return layout(grid);
    };

    const afterAwait = await run(false);
    expect(afterAwait).toEqual(['d', 'a', 'c', 'b']);
    expect(await run(true)).toEqual(afterAwait);
  });

  it('a pin switch after a fresh replacement merged but not yet rendered restores like after the render (PR #639)', async () => {
    const run = async (rendered: boolean) => {
      const pinned = new PinnedColumnsPlugin();
      const grid = createGrid();
      grid.gridConfig = {
        columns: [{ field: 'a' }, { field: 'b', order: 1, pinned: 'left' }, { field: 'c' }, { field: 'd' }],
        plugins: [pinned],
      };
      grid.rows = [{ a: 1, b: 2, c: 3, d: 4 }];
      await waitUpgrade(grid);

      grid.columns = [{ field: 'd' }, { field: 'a' }, { field: 'b', order: 1, pinned: 'left' }, { field: 'c' }];
      // The setter merges in a microtask; `orderColumns` only sees the fresh `order` on the render.
      if (rendered) await waitUpgrade(grid);
      else await Promise.resolve();
      pinned.setPinPosition('b', 'right');
      await waitUpgrade(grid);
      pinned.setPinPosition('b', undefined);
      await waitUpgrade(grid);

      return layout(grid);
    };

    const afterRender = await run(true);
    expect(afterRender).toEqual(['d', 'b', 'a', 'c']);
    expect(await run(false)).toEqual(afterRender);
  });

  it('keeps same-tick side-switch and unpin placement equal to separate ticks', async () => {
    const run = async (sameTick: boolean) => {
      const pinned = new PinnedColumnsPlugin();
      const grid = createGrid();
      grid.gridConfig = {
        columns: [{ field: 'a' }, { field: 'd' }, { field: 'b', order: 0 }, { field: 'c', order: 2 }],
        plugins: [pinned],
      };
      grid.rows = [{ a: 1, b: 2, c: 3, d: 4 }];
      await waitUpgrade(grid);
      grid.setColumnOrder(['a', 'd', 'b', 'c']);
      await waitUpgrade(grid);
      pinned.setPinPosition('c', 'right');
      await waitUpgrade(grid);

      const c = grid.columns.find((column) => column.field === 'c');
      if (c) c.order = 0;
      pinned.setPinPosition('c', 'left');
      if (!sameTick) {
        await waitUpgrade(grid);
        expect(layout(grid)).toEqual(['c@left', 'a', 'd', 'b']);
      }
      pinned.setPinPosition('c', undefined);
      await waitUpgrade(grid);

      return layout(grid);
    };

    const separateTicks = await run(false);
    expect(separateTicks).toEqual(['a', 'd', 'b', 'c']);
    expect(await run(true)).toEqual(separateTicks);
  });

  it('keeps tied order placement when a pinned column is unpinned after a write-back', async () => {
    const { grid, pinned } = await setupTiedOrderWriteBack();
    pinned.setPinPosition('c', undefined);
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('preserves the consumed order marker through later reorders, write-backs, and unpinning', async () => {
    const { grid, pinned } = await setupTiedOrderWriteBack();
    grid.setColumnOrder(['d', 'b', 'a', 'c']);
    await waitUpgrade(grid);
    grid.columns = [...grid.columns];
    await waitUpgrade(grid);
    pinned.setPinPosition('c', undefined);
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['d', 'b', 'c', 'a']);
  });

  it.each([undefined, -1, Number.POSITIVE_INFINITY, Number.NaN])(
    'keeps a pinned column return position when its live `order` is %s',
    async (order) => {
      const { grid, pinned } = await setup();
      pinned.setPinPosition('c1', 'left');
      await waitUpgrade(grid);

      const column = grid.columns.find((c) => c.field === 'c1');
      if (column) {
        if (order === undefined) delete column.order;
        else column.order = order;
      }
      pinned.setPinPosition('c1', undefined);
      await waitUpgrade(grid);

      expect(layout(grid)).toEqual(['c0', 'c1', 'c2', 'c3']);
    },
  );

  it('updates a changed pinned return position when pinning another column', async () => {
    const { grid, pinned } = await setup();
    pinned.setPinPosition('c1', 'left');
    await waitUpgrade(grid);

    grid.columns.find((c) => c.field === 'c1')!.order = 3;
    pinned.setPinPosition('c2', 'right');
    await waitUpgrade(grid);
    pinned.setPinPosition('c1', undefined);
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['c0', 'c3', 'c1', 'c2@right']);
  });

  it('re-applies an `order` that was cleared and set again after a move (PR #639)', async () => {
    const { grid } = await setup();
    const setOrder = (order: number | undefined) =>
      (grid.columns = grid.columns.map((c) => (c.field === 'c3' ? { ...c, order } : c)));
    setOrder(0);
    await waitUpgrade(grid);
    setOrder(undefined);
    await waitUpgrade(grid);
    grid.setColumnOrder(['c0', 'c1', 'c3', 'c2']);
    await waitUpgrade(grid);

    setOrder(0);
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['c3', 'c0', 'c1', 'c2']);
  });

  it("re-applies `order` after a `columnInference: 'merge'` write-back, which rebuilds data-key order (PR #639)", async () => {
    const grid = createGrid();
    grid.gridConfig = { columnInference: 'merge', columns: [{ field: 'c', order: 0 }] };
    grid.rows = [{ a: 1, b: 2, c: 3 }];
    await waitUpgrade(grid);
    expect(layout(grid)).toEqual(['c', 'a', 'b']);

    grid.columns = [...grid.columns];
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['c', 'a', 'b']);
  });

  it("pinning keeps an `order` column in place under `columnInference: 'merge'`", async () => {
    const pinned = new PinnedColumnsPlugin();
    const grid = createGrid();
    grid.gridConfig = { columnInference: 'merge', columns: [{ field: 'c1', order: 1 }], plugins: [pinned] };
    grid.rows = [{ c0: 1, c1: 2, c2: 3, c3: 4 }];
    await waitUpgrade(grid);
    pinned.setPinPosition('c3', 'left');
    await waitUpgrade(grid);
    pinned.setPinPosition('c2', 'right');
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['c3@left', 'c0', 'c1', 'c2@right']);
  });

  it("a merge-mode grid built from another grid's columns leaves that grid's placement alone (PR #639)", async () => {
    const gridA = createGrid();
    gridA.gridConfig = { columns: [{ field: 'a' }, { field: 'b' }, { field: 'x', order: 0 }] };
    gridA.rows = [{ a: 1, b: 2, x: 3 }];
    await waitUpgrade(gridA);
    gridA.setColumnOrder(['a', 'x', 'b']);
    await waitUpgrade(gridA);

    // `x` is absent from B's rows, so the overlay appends A's live column object as-is.
    const gridB = createGrid();
    gridB.gridConfig = { columnInference: 'merge', columns: gridA.columns };
    gridB.rows = [{ a: 1, b: 2 }];
    await waitUpgrade(gridB);

    gridA.columns = [...gridA.columns];
    await waitUpgrade(gridA);

    expect(layout(gridA)).toEqual(['a', 'x', 'b']);
  });

  it('a same-tick pin after clearing and restoring `order` matches separate ticks (PR #639)', async () => {
    const run = async (sameTick: boolean) => {
      const { grid, pinned } = await setup();
      const c1 = () => grid.columns.find((c) => c.field === 'c1');
      delete c1()?.order;
      pinned.setPinPosition('c2', 'left');
      if (!sameTick) await waitUpgrade(grid);
      const live = c1();
      if (live) live.order = 1;
      pinned.setPinPosition('c3', 'right');
      await waitUpgrade(grid);
      return layout(grid);
    };

    expect(await run(true)).toEqual(await run(false));
  });

  it('still applies `order` when gridConfig is reassigned after a pin', async () => {
    const { grid, pinned } = await setup();
    pinned.setPinPosition('c3', 'left');
    await waitUpgrade(grid);

    grid.columns = [];
    grid.gridConfig = { columns: declared(), plugins: [pinned] };
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['c0', 'c1', 'c2', 'c3']);
  });

  it('unpinning a column whose live `order` changed before the pin returns it to the changed slot (PR #639)', async () => {
    const { grid, pinned } = await setup();
    const c1 = grid.columns.find((c) => c.field === 'c1');
    if (c1) c1.order = 3;
    pinned.setPinPosition('c1', 'left');
    await waitUpgrade(grid);
    pinned.setPinPosition('c1', undefined);
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['c0', 'c2', 'c3', 'c1']);
  });

  it('a same-tick write-back of `grid.columns` after a pin still places a changed `order` (PR #639)', async () => {
    const { grid, pinned } = await setup(0);
    const c1 = grid.columns.find((c) => c.field === 'c1');
    if (c1) c1.order = 1;
    pinned.setPinPosition('c3', 'left');
    grid.columns = [...grid.columns];
    await waitUpgrade(grid);

    expect(layout(grid)).toEqual(['c3@left', 'c0', 'c1', 'c2']);
  });

  it('with tied live `order` changes, same-tick pins match separate ticks (PR #639)', async () => {
    const run = async (sameTick: boolean) => {
      const pinned = new PinnedColumnsPlugin();
      const grid = createGrid();
      grid.gridConfig = { columns: ['a', 'b', 'c', 'd', 'e'].map((field) => ({ field })), plugins: [pinned] };
      grid.rows = [{ a: 1, b: 2, c: 3, d: 4, e: 5 }];
      await waitUpgrade(grid);
      for (const c of grid.columns) if (c.field === 'b' || c.field === 'c') c.order = 0;
      pinned.setPinPosition('d', 'left');
      if (!sameTick) await waitUpgrade(grid);
      pinned.setPinPosition('e', 'right');
      await waitUpgrade(grid);
      return layout(grid);
    };

    expect(await run(false)).toEqual(['d@left', 'b', 'c', 'a', 'e@right']);
    expect(await run(true)).toEqual(['d@left', 'b', 'c', 'a', 'e@right']);
  });
});
