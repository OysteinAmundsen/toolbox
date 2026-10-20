/**
 * Integration tests: MultiSortPlugin leaves the consumer's `rows` array alone.
 *
 * With no earlier copying stage, the array MultiSort receives IS `grid.sourceRows`
 * (the consumer's own array). Sorting it in place reordered their data and left
 * nothing to restore when the sort was cleared.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import '../../index';
import '../../lib/features/filtering';
import '../../lib/features/multi-sort';

interface Row {
  id: number;
}

async function createGrid(data: Row[]) {
  const grid = document.createElement('tbw-grid') as any;
  grid.gridConfig = { columns: [{ field: 'id', header: 'Id', sortable: true }], features: { multiSort: true } };
  grid.rows = data;
  document.body.appendChild(grid);
  await grid.ready();
  return grid;
}

const ids = (rows: Row[]) => rows.map((r) => r.id);

describe('MultiSort source rows', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('sorts without reordering the consumer rows array', async () => {
    const data: Row[] = [{ id: 2 }, { id: 0 }, { id: 1 }];
    const grid = await createGrid(data);

    grid.getPluginByName('multiSort').setSortModel([{ field: 'id', direction: 'asc' }]);

    await vi.waitFor(() => expect(ids(grid.rows)).toEqual([0, 1, 2]));
    expect(ids(data)).toEqual([2, 0, 1]);
    expect(ids(grid.sourceRows)).toEqual([2, 0, 1]);
  });

  it('restores the original order when the sort is cleared', async () => {
    const grid = await createGrid([{ id: 2 }, { id: 0 }, { id: 1 }]);
    const multiSort = grid.getPluginByName('multiSort');

    multiSort.setSortModel([{ field: 'id', direction: 'asc' }]);
    await vi.waitFor(() => expect(ids(grid.rows)).toEqual([0, 1, 2]));
    multiSort.clearSort();

    await vi.waitFor(() => expect(ids(grid.rows)).toEqual([2, 0, 1]));
  });
});

describe('grid.sort() leaves the consumer rows array alone (PR #525)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // After an unsorted render `_rows` can BE `sourceRows` (core passes `#rows` through and
  // MultiSort with no model passes its input on), and core's builtin fast path sorts
  // `_rows` in place.
  it.each([
    ['without plugins', undefined],
    ['with MultiSort and no sort model', { multiSort: true }],
  ])('%s', async (_label, features) => {
    const data: Row[] = [{ id: 2 }, { id: 0 }, { id: 1 }];
    const grid = document.createElement('tbw-grid') as any;
    grid.gridConfig = { columns: [{ field: 'id', header: 'Id', sortable: true }], ...(features ? { features } : {}) };
    grid.rows = data;
    document.body.appendChild(grid);
    await grid.ready();
    await vi.waitFor(() => expect(grid.querySelectorAll('.data-grid-row').length).toBe(3));

    grid.sort('id', 'asc');
    await vi.waitFor(() => expect(ids(grid.rows)).toEqual([0, 1, 2]));
    expect(ids(data)).toEqual([2, 0, 1]);

    grid.sort(null);
    await vi.waitFor(() => expect(ids(grid.rows)).toEqual([2, 0, 1]));
    expect(ids(data)).toEqual([2, 0, 1]);
  });
});

describe('grid.sort() does not sort a plugin stage cached array in place (PR #525)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  interface KeepRow {
    id: number;
    keep: boolean;
  }

  // With a filter active, `_rows` IS FilteringPlugin's cached result; sorting it in place
  // left the cache sorted, so the next render after clearing the sort restored the order.
  it.each([
    ['Filtering only', { filtering: true }],
    ['MultiSort (no model) before Filtering', { multiSort: true, filtering: true }],
  ])('clearing the sort survives a later render (%s)', async (_label, features) => {
    const data: KeepRow[] = [
      { id: 2, keep: true },
      { id: 0, keep: true },
      { id: 1, keep: true },
      { id: 3, keep: false },
    ];
    const grid = document.createElement('tbw-grid') as any;
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'Id', sortable: true },
        { field: 'keep', header: 'Keep', type: 'boolean' },
      ],
      features,
    };
    grid.rows = data;
    document.body.appendChild(grid);
    await grid.ready();
    grid.getPluginByName('filtering').setFilter('keep', { type: 'boolean', operator: 'equals', value: true });
    await vi.waitFor(() => expect(ids(grid.rows)).toEqual([2, 0, 1]));

    grid.sort('id', 'asc');
    await vi.waitFor(() => expect(ids(grid.rows)).toEqual([0, 1, 2]));
    grid.sort(null);
    await vi.waitFor(() => expect(ids(grid.rows)).toEqual([2, 0, 1]));

    grid.requestRender(); // ROWS rebuild with an unchanged input reference
    await new Promise((r) => setTimeout(r, 50));
    expect(ids(grid.rows)).toEqual([2, 0, 1]);
  });
});
