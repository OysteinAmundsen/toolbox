import { afterEach, describe, expect, it } from 'vitest';
import '../../lib/core/grid';
import { nextFrame, waitUpgrade } from '../../../test/helpers';

describe('grid.sort() API', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('sort(field, direction) applies sort and updates sortModel getter', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.appendChild(grid);
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', width: 80, type: 'number', sortable: true },
        { field: 'name', header: 'Name', width: 120, sortable: true },
      ],
      fitMode: 'fixed',
    };
    grid.rows = [
      { id: 3, name: 'Charlie' },
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
    await waitUpgrade(grid);

    grid.sort('id', 'asc');
    await nextFrame(2);

    expect(grid.sortModel).toEqual({ field: 'id', direction: 'asc' });
    expect(grid._rows.map((r: any) => r.id)).toEqual([1, 2, 3]);
  });

  it('sort(field, "desc") sorts descending', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.appendChild(grid);
    grid.gridConfig = {
      columns: [{ field: 'id', header: 'ID', width: 80, type: 'number', sortable: true }],
      fitMode: 'fixed',
    };
    grid.rows = [{ id: 1 }, { id: 3 }, { id: 2 }];
    await waitUpgrade(grid);

    grid.sort('id', 'desc');
    await nextFrame(2);

    expect(grid.sortModel).toEqual({ field: 'id', direction: 'desc' });
    expect(grid._rows.map((r: any) => r.id)).toEqual([3, 2, 1]);
  });

  it('sort(null) clears sort and restores original order', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.appendChild(grid);
    grid.gridConfig = {
      columns: [{ field: 'id', header: 'ID', width: 80, type: 'number', sortable: true }],
      fitMode: 'fixed',
    };
    grid.rows = [{ id: 3 }, { id: 1 }, { id: 2 }];
    await waitUpgrade(grid);

    grid.sort('id', 'asc');
    await nextFrame(2);
    expect(grid._rows.map((r: any) => r.id)).toEqual([1, 2, 3]);

    grid.sort(null);
    await nextFrame(2);

    expect(grid.sortModel).toBeNull();
    expect(grid._rows.map((r: any) => r.id)).toEqual([3, 1, 2]);
  });

  it('sort(field) without direction toggles through asc → desc → none', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.appendChild(grid);
    grid.gridConfig = {
      columns: [{ field: 'id', header: 'ID', width: 80, type: 'number', sortable: true }],
      fitMode: 'fixed',
    };
    grid.rows = [{ id: 2 }, { id: 1 }, { id: 3 }];
    await waitUpgrade(grid);

    // First toggle: asc
    grid.sort('id');
    await nextFrame(2);
    expect(grid.sortModel?.direction).toBe('asc');

    // Second toggle: desc
    grid.sort('id');
    await nextFrame(2);
    expect(grid.sortModel?.direction).toBe('desc');

    // Third toggle: clear
    grid.sort('id');
    await nextFrame(2);
    expect(grid.sortModel).toBeNull();
  });

  it('sort() fires sort-change event', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.appendChild(grid);
    grid.gridConfig = {
      columns: [{ field: 'id', header: 'ID', width: 80, type: 'number', sortable: true }],
      fitMode: 'fixed',
    };
    grid.rows = [{ id: 1 }, { id: 2 }];
    await waitUpgrade(grid);

    const events: any[] = [];
    grid.addEventListener('sort-change', (e: any) => events.push(e.detail));

    grid.sort('id', 'desc');
    expect(events.length).toBe(1);
    expect(events[0]).toEqual({ field: 'id', direction: -1 });

    grid.sort(null);
    expect(events.length).toBe(2);
    expect(events[1]).toEqual({ field: 'id', direction: 0 });
  });
});
