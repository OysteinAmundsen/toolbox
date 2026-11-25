/**
 * Tests for the Transaction API (applyTransaction, applyTransactionAsync)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import '../../index';
import { BaseGridPlugin } from '../../lib/core/plugin/base-plugin';
import type { GridConfig } from '../../lib/core/types';
import { FilteringPlugin } from '../../lib/plugins/filtering';
import { TreePlugin } from '../../lib/plugins/tree/tree-plugin';

interface TestRow {
  id: string;
  name: string;
  status: string;
  count: number;
}

async function createGrid<T>(rows: T[], config?: Partial<GridConfig<T>>) {
  const grid = document.createElement('tbw-grid') as any;
  if (config) {
    grid.gridConfig = config;
  }
  grid.rows = rows;
  document.body.appendChild(grid);
  await grid.ready();
  return grid;
}

function makeRows(count = 3): TestRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `r${i + 1}`,
    name: `Row ${i + 1}`,
    status: 'active',
    count: (i + 1) * 10,
  }));
}

async function createFilteredGrid() {
  const rows = makeRows();
  rows[1].status = 'inactive';
  rows[2].status = 'inactive';
  const filtering = new FilteringPlugin({});
  const grid = await createGrid(rows, {
    columns: [{ field: 'status', filterable: true }, { field: 'count' }],
    getRowId: (row) => row.id,
    plugins: [filtering],
  });
  filtering.setFilter('status', { type: 'text', operator: 'equals', value: 'active' });
  await vi.waitFor(() => expect(grid.rows.map((row: TestRow) => row.id)).toEqual(['r1']));
  return { grid, rows, filtering };
}

describe('Transaction API', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // #region applyTransaction — basic operations

  describe('applyTransaction', () => {
    it('adds rows', async () => {
      const grid = await createGrid(makeRows());
      const result = await grid.applyTransaction(
        { add: [{ id: 'r4', name: 'Row 4', status: 'active', count: 40 }] },
        false,
      );

      expect(result.added).toHaveLength(1);
      expect(result.updated).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(grid.rows).toHaveLength(4);
      expect(grid.rows[3].id).toBe('r4');
    });

    it('updates rows in-place', async () => {
      const grid = await createGrid(makeRows());
      const result = await grid.applyTransaction(
        { update: [{ id: 'r2', changes: { status: 'inactive', count: 99 } }] },
        false,
      );

      expect(result.updated).toHaveLength(1);
      expect(result.updated[0].status).toBe('inactive');
      expect(result.updated[0].count).toBe(99);
      expect(grid.rows).toHaveLength(3);
      // original row mutated in-place
      expect(grid.rows[1].status).toBe('inactive');
    });

    it('removes rows by id', async () => {
      const grid = await createGrid(makeRows());
      const result = await grid.applyTransaction({ remove: [{ id: 'r2' }] }, false);

      expect(result.removed).toHaveLength(1);
      expect(result.removed[0].id).toBe('r2');
      expect(grid.rows).toHaveLength(2);
      expect(grid.rows.map((r: TestRow) => r.id)).toEqual(['r1', 'r3']);
    });

    it('updates and removes filtered-out source rows', async () => {
      const { grid, rows, filtering } = await createFilteredGrid();

      const changes: Array<{ rowId: string; rowIndex: number }> = [];
      grid.on('cell-change', (detail: { rowId: string; rowIndex: number }) => changes.push(detail));
      const result = await grid.applyTransaction(
        {
          update: [
            { id: 'r2', changes: { count: 99 } },
            { id: 'r3', changes: { count: 100 } },
          ],
          remove: [{ id: 'r3' }, { id: 'r3' }],
        },
        false,
      );

      expect(result.updated).toEqual([rows[1]]);
      expect(result.removed).toEqual([rows[2]]);
      expect(rows[1].count).toBe(99);
      expect(rows[2].count).toBe(30);
      expect(changes).toMatchObject([{ rowId: 'r2', rowIndex: -1 }]);
      expect(grid.sourceRows.map((row: TestRow) => row.id)).toEqual(['r1', 'r2']);

      filtering.clearAllFilters();
      await vi.waitFor(() => expect(grid.rows.map((row: TestRow) => row.id)).toEqual(['r1', 'r2']));
    });

    it('resolves bulk visible, hidden, and missing IDs without rescanning per ID', async () => {
      const rows = makeRows(1_000);
      for (let i = 0; i < 20; i++) rows[i].status = 'inactive';

      let rowIdResolutions = 0;
      const filtering = new FilteringPlugin({});
      const grid = await createGrid(rows, {
        columns: [{ field: 'status', filterable: true }, { field: 'count' }],
        getRowId: (row) => {
          rowIdResolutions++;
          return row.id;
        },
        plugins: [filtering],
      });
      filtering.setFilter('status', { type: 'text', operator: 'equals', value: 'active' });
      await vi.waitFor(() => expect(grid.rows).toHaveLength(980));
      rowIdResolutions = 0;

      const changes: Array<{ rowId: string; rowIndex: number }> = [];
      grid.on('cell-change', (detail: { rowId: string; rowIndex: number }) => changes.push(detail));
      const result = await grid.applyTransaction(
        {
          remove: [
            ...Array.from({ length: 10 }, (_, i) => ({ id: `r${i + 21}` })),
            ...Array.from({ length: 10 }, (_, i) => ({ id: `r${i + 1}` })),
            ...Array.from({ length: 10 }, (_, i) => ({ id: `missing-${i}` })),
          ],
          update: [
            ...Array.from({ length: 10 }, (_, i) => ({
              id: `r${i + 11}`,
              changes: { count: 999 },
            })),
            ...Array.from({ length: 10 }, (_, i) => ({
              id: `missing-update-${i}`,
              changes: { count: 999 },
            })),
          ],
        },
        false,
      );

      expect(result.removed).toHaveLength(20);
      expect(result.updated).toEqual(rows.slice(10, 20));
      expect(rows.slice(10, 20).every((row) => row.count === 999)).toBe(true);
      expect(grid.sourceRows).toHaveLength(980);
      expect(changes).toHaveLength(10);
      expect(changes.every((change) => change.rowIndex === -1)).toBe(true);
      expect(rowIdResolutions).toBeLessThan(5 * rows.length);
    });

    it('updates and removes rows outside a paged view', async () => {
      class FirstPagePlugin extends BaseGridPlugin {
        readonly name = 'test-first-page';
        override processRows(rows: readonly TestRow[]): TestRow[] {
          return rows.slice(0, 1);
        }
      }

      const rows = makeRows();
      const grid = await createGrid(rows, { plugins: [new FirstPagePlugin()] });
      expect(grid.rows.map((row: TestRow) => row.id)).toEqual(['r1']);

      const result = await grid.applyTransaction(
        { update: [{ id: 'r2', changes: { count: 42 } }], remove: [{ id: 'r3' }] },
        false,
      );
      expect(result).toMatchObject({ updated: [rows[1]], removed: [rows[2]] });
      expect(grid.sourceRows.map((row: TestRow) => row.id)).toEqual(['r1', 'r2']);
      expect(rows[1].count).toBe(42);
    });

    it('handles a mixed transaction (add + update + remove)', async () => {
      const grid = await createGrid(makeRows());
      const result = await grid.applyTransaction(
        {
          remove: [{ id: 'r1' }],
          update: [{ id: 'r2', changes: { name: 'Updated' } }],
          add: [{ id: 'r4', name: 'New', status: 'new', count: 0 }],
        },
        false,
      );

      expect(result.removed).toHaveLength(1);
      expect(result.updated).toHaveLength(1);
      expect(result.added).toHaveLength(1);
      expect(grid.rows).toHaveLength(3);
      expect(grid.rows.map((r: TestRow) => r.id)).toEqual(['r2', 'r3', 'r4']);
      expect(grid.rows[0].name).toBe('Updated');
    });

    it('handles empty transaction gracefully', async () => {
      const grid = await createGrid(makeRows());
      const result = await grid.applyTransaction({}, false);

      expect(result.added).toHaveLength(0);
      expect(result.updated).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(grid.rows).toHaveLength(3);
    });

    it('skips updates for non-existent row ids', async () => {
      const grid = await createGrid(makeRows());
      const result = await grid.applyTransaction(
        {
          update: [{ id: 'missing', changes: { name: 'Ghost' } }],
          remove: [{ id: 'also-missing' }],
        },
        false,
      );

      expect(result.updated).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(grid.rows).toHaveLength(3);
    });

    it('updates sourceRows for structural changes', async () => {
      const rows = makeRows();
      const grid = await createGrid(rows);

      await grid.applyTransaction(
        {
          add: [{ id: 'r4', name: 'Added', status: 'new', count: 0 }],
          remove: [{ id: 'r1' }],
        },
        false,
      );

      expect(grid.sourceRows).toHaveLength(3);
      expect(grid.sourceRows.map((r: TestRow) => r.id)).toContain('r4');
      expect(grid.sourceRows.map((r: TestRow) => r.id)).not.toContain('r1');
    });

    it('dispatches cell-change events for each updated field', async () => {
      const grid = await createGrid(makeRows());

      const events: any[] = [];
      grid.addEventListener('cell-change', (e: CustomEvent) => events.push(e.detail));

      await grid.applyTransaction(
        {
          update: [{ id: 'r1', changes: { name: 'NewName', count: 999 } }],
        },
        false,
      );

      expect(events).toHaveLength(2);
      expect(events.map((e) => e.field).sort()).toEqual(['count', 'name']);
      expect(events[0].source).toBe('api');
    });

    it('does not dispatch cell-change if value is unchanged', async () => {
      const rows = makeRows();
      const grid = await createGrid(rows);

      const events: any[] = [];
      grid.addEventListener('cell-change', (e: CustomEvent) => events.push(e.detail));

      await grid.applyTransaction(
        {
          update: [{ id: 'r1', changes: { name: 'Row 1' } }], // same value
        },
        false,
      );

      expect(events).toHaveLength(0);
    });

    it('adds multiple rows in one transaction', async () => {
      const grid = await createGrid(makeRows());
      const newRows: TestRow[] = [
        { id: 'a1', name: 'A1', status: 'new', count: 0 },
        { id: 'a2', name: 'A2', status: 'new', count: 1 },
        { id: 'a3', name: 'A3', status: 'new', count: 2 },
      ];

      const result = await grid.applyTransaction({ add: newRows }, false);

      expect(result.added).toHaveLength(3);
      expect(grid.rows).toHaveLength(6);
    });

    it('removes multiple rows in one transaction', async () => {
      const rows = makeRows();
      const grid = await createGrid(rows);
      const result = await grid.applyTransaction({ remove: [{ id: 'r1' }, { id: 'r3' }] }, false);

      expect(result.removed).toHaveLength(2);
      expect(result.removed.map((row: TestRow) => row.id)).toEqual(['r1', 'r3']);
      expect(grid.rows).toHaveLength(1);
      expect(grid.rows[0].id).toBe('r2');
      expect(rows).toHaveLength(3);
    });

    it('revalidates animated removals after concurrent transactions', async () => {
      const rows = makeRows();
      const grid = await createGrid(rows);
      const animatedRows: string[] = [];
      const findRenderedRowElement = grid.findRenderedRowElement.bind(grid);
      vi.spyOn(grid, 'findRenderedRowElement').mockImplementation((...args: unknown[]) => {
        const [index] = args;
        if (typeof index !== 'number') throw new TypeError('Expected a row index');
        animatedRows.push(grid.rows[index]?.id ?? 'missing');
        return findRenderedRowElement(index);
      });

      const firstRemoval = grid.applyTransaction({ remove: [{ id: 'r1' }, { id: 'r2' }] });
      await vi.waitFor(() => expect(animatedRows).toHaveLength(1));
      const concurrentRemoval = await grid.applyTransaction({ remove: [{ id: 'r2' }] }, false);
      const firstResult = await firstRemoval;

      expect(animatedRows).toEqual(['r1']);
      expect(concurrentRemoval.removed).toEqual([rows[1]]);
      expect(firstResult.removed).toEqual([rows[0]]);
      expect(grid.rows).toEqual([rows[2]]);
    });

    it('does not update a hidden row removed during an animated transaction', async () => {
      const { grid, rows } = await createFilteredGrid();
      const findRenderedRowElement = vi.spyOn(grid, 'findRenderedRowElement');

      const firstRemoval = grid.applyTransaction({
        remove: [{ id: 'r1' }, { id: 'missing' }],
        update: [{ id: 'r2', changes: { count: 999 } }],
      });
      await vi.waitFor(() => expect(findRenderedRowElement).toHaveBeenCalledTimes(1));
      const concurrentRemoval = await grid.applyTransaction({ remove: [{ id: 'r2' }] }, false);
      const firstResult = await firstRemoval;

      expect(concurrentRemoval.removed).toEqual([rows[1]]);
      expect(firstResult.removed).toEqual([rows[0]]);
      expect(firstResult.updated).toEqual([]);
      expect(rows[1].count).toBe(20);
      expect(grid.sourceRows).toEqual([rows[2]]);
    });

    it('clears a removal animation when a concurrent transaction removes the same row', async () => {
      const rows = makeRows();
      const grid = await createGrid(rows);
      const removalElement: HTMLElement = grid.findRenderedRowElement(0);

      const firstRemoval = grid.applyTransaction({ remove: [{ id: 'r1' }] });
      await vi.waitFor(() => expect(removalElement.getAttribute('data-animating')).toBe('remove'));
      const concurrentRemoval = await grid.applyTransaction(
        {
          remove: [{ id: 'r1' }],
          add: [{ id: 'r4', name: 'Row 4', status: 'active', count: 40 }],
        },
        false,
      );
      expect(grid.findRenderedRowElement(0)).toBe(removalElement);

      const firstResult = await firstRemoval;
      await vi.waitFor(() => expect(removalElement.hasAttribute('data-animating')).toBe(false));

      expect(concurrentRemoval.removed).toEqual([rows[0]]);
      expect(firstResult.removed).toEqual([]);
      expect(grid.rows.map((row: TestRow) => row.id)).toEqual(['r2', 'r3', 'r4']);
    });

    it('removes a visible tree child from the processed rows', async () => {
      const child: TestRow = { id: 'r2', name: 'Child', status: 'active', count: 20 };
      const parent = { ...makeRows(1)[0], children: [child] };
      const tree = new TreePlugin({ defaultExpanded: true });
      const grid = await createGrid([parent], {
        getRowId: (row) => row.id,
        plugins: [tree],
      });
      await vi.waitFor(() => expect(grid.rows.map((row: TestRow) => row.id)).toEqual(['r1', 'r2']));

      const result = await grid.applyTransaction({ remove: [{ id: child.id }] }, false);

      expect(result.removed).toEqual([child]);
      expect(grid.rows).toEqual([parent]);
      expect(grid.sourceRows).toEqual([parent]);
    });

    it('re-keys the transaction resolver when a hidden row ID changes', async () => {
      const rows = [
        { key: 'visible', name: 'Visible', status: 'active', count: 1 },
        { key: 'hidden', name: 'Hidden', status: 'inactive', count: 2 },
      ];
      const filtering = new FilteringPlugin({});
      const grid = await createGrid(rows, {
        columns: [{ field: 'status', filterable: true }, { field: 'name' }],
        getRowId: (row) => row.key,
        plugins: [filtering],
      });
      filtering.setFilter('status', { type: 'text', operator: 'equals', value: 'active' });
      await vi.waitFor(() => expect(grid.rows).toHaveLength(1));

      const result = await grid.applyTransaction(
        {
          update: [
            { id: 'hidden', changes: { key: 'renamed' } },
            { id: 'renamed', changes: { name: 'Updated by new ID' } },
            { id: 'hidden', changes: { name: 'Must not update' } },
          ],
        },
        false,
      );

      expect(rows[1]).toMatchObject({ key: 'renamed', name: 'Updated by new ID' });
      expect(result.updated).toEqual([rows[1], rows[1]]);
    });

    it('refreshes a cached transaction lookup after updateRow changes a hidden ID during a tree-child animation', async () => {
      const child = { key: 'child', name: 'Child', status: 'active', count: 2 };
      const parent = { ...makeRows(1)[0], key: 'parent', children: [child] };
      const hidden = { key: 'hidden', name: 'Hidden', status: 'inactive', count: 3 };
      const rows = [parent, hidden];
      const filtering = new FilteringPlugin({});
      const tree = new TreePlugin({ defaultExpanded: true });
      const grid = await createGrid(rows, {
        columns: [{ field: 'status', filterable: true }, { field: 'name' }],
        getRowId: (row) => row.key,
        plugins: [tree, filtering],
      });
      filtering.setFilter('status', { type: 'text', operator: 'equals', value: 'active' });
      await vi.waitFor(() => expect(grid.rows.map((row: (typeof rows)[number]) => row.key)).toEqual(['parent', 'child']));

      const transaction = grid.applyTransaction({
        remove: [{ id: 'missing' }, { id: 'child' }],
        update: [
          { id: 'renamed', changes: { name: 'Updated by new ID' } },
          { id: 'hidden', changes: { name: 'Must not update old ID' } },
        ],
      });
      const childElement: HTMLElement = grid.findRenderedRowElement(1);
      await vi.waitFor(() => expect(childElement.getAttribute('data-animating')).toBe('remove'));
      grid.updateRow('hidden', { key: 'renamed' });

      const result = await transaction;

      expect(hidden).toMatchObject({ key: 'renamed', name: 'Updated by new ID' });
      expect(grid._getRowEntry('hidden')).toBeUndefined();
      expect(result.updated).toEqual([hidden]);
      expect(grid.rows).toEqual([parent]);
    });

    it('refreshes a cached transaction lookup after updateRow changes a hidden ID in a cell-change listener', async () => {
      const rows = [
        { key: 'visible', name: 'Visible', status: 'active', count: 1 },
        { key: 'hidden', name: 'Hidden', status: 'inactive', count: 2 },
      ];
      const filtering = new FilteringPlugin({});
      const grid = await createGrid(rows, {
        columns: [{ field: 'status', filterable: true }, { field: 'name' }],
        getRowId: (row) => row.key,
        plugins: [filtering],
      });
      filtering.setFilter('status', { type: 'text', operator: 'equals', value: 'active' });
      await vi.waitFor(() => expect(grid.rows).toHaveLength(1));

      let renamed = false;
      grid.on('cell-change', (detail: { row: (typeof rows)[number] }) => {
        if (!renamed && detail.row === rows[0]) {
          renamed = true;
          grid.updateRow('hidden', { key: 'renamed' });
        }
      });

      const result = await grid.applyTransaction(
        {
          remove: [{ id: 'missing' }],
          update: [
            { id: 'visible', changes: { name: 'Trigger listener' } },
            { id: 'renamed', changes: { name: 'Updated by new ID' } },
            { id: 'hidden', changes: { name: 'Must not update old ID' } },
          ],
        },
        false,
      );

      expect(renamed).toBe(true);
      expect(rows[1]).toMatchObject({ key: 'renamed', name: 'Updated by new ID' });
      expect(grid._getRowEntry('hidden')).toBeUndefined();
      expect(result.updated).toEqual([rows[0], rows[1]]);
    });

    it('rebuilds a cached transaction lookup when getRowId changes during an animation', async () => {
      const child = {
        key: 'child',
        alternateKey: 'child',
        name: 'Child',
        status: 'active',
        count: 2,
      };
      const parent = {
        ...makeRows(1)[0],
        key: 'parent',
        alternateKey: 'parent',
        children: [child],
      };
      const hidden = {
        key: 'hidden',
        alternateKey: 'renamed',
        name: 'Hidden',
        status: 'inactive',
        count: 3,
      };
      const rows = [parent, hidden];
      const filtering = new FilteringPlugin({});
      const tree = new TreePlugin({ defaultExpanded: true });
      const grid = await createGrid(rows, {
        columns: [{ field: 'status', filterable: true }, { field: 'name' }],
        getRowId: (row) => row.key,
        plugins: [tree, filtering],
      });
      filtering.setFilter('status', { type: 'text', operator: 'equals', value: 'active' });
      await vi.waitFor(() =>
        expect(grid.rows.map((row: (typeof rows)[number]) => row.key)).toEqual(['parent', 'child']),
      );

      const transaction = grid.applyTransaction({
        remove: [{ id: 'missing' }, { id: 'child' }],
        update: [
          { id: 'renamed', changes: { name: 'Updated by new ID' } },
          { id: 'hidden', changes: { name: 'Must not update old ID' } },
        ],
      });
      const childElement: HTMLElement = grid.findRenderedRowElement(1);
      await vi.waitFor(() => expect(childElement.getAttribute('data-animating')).toBe('remove'));

      const replacementGetRowId = (row: (typeof rows)[number]) => row.alternateKey;
      grid.gridConfig = { ...grid.gridConfig, getRowId: replacementGetRowId };
      await vi.waitFor(() => expect(grid.effectiveConfig?.getRowId).toBe(replacementGetRowId));

      const result = await transaction;

      expect(hidden).toMatchObject({ alternateKey: 'renamed', name: 'Updated by new ID' });
      expect(result.updated).toEqual([hidden]);
    });

    it('preserves original sort order through batched removals and additions', async () => {
      const rows = makeRows();
      const grid = await createGrid(rows);
      grid.sort('name', 'desc');
      await grid.forceLayout();

      await grid.applyTransaction(
        {
          remove: [{ id: 'r2' }],
          add: [{ id: 'r4', name: 'Row 4', status: 'active', count: 40 }],
        },
        false,
      );
      grid.sort(null);
      await grid.forceLayout();

      expect(grid.rows.map((row: TestRow) => row.id)).toEqual(['r1', 'r3', 'r4']);
      expect(rows).toHaveLength(3);
    });

    it('processes removes before updates (no stale update)', async () => {
      const grid = await createGrid(makeRows());
      // Remove r2 and try to update it in the same transaction
      const result = await grid.applyTransaction(
        {
          remove: [{ id: 'r2' }],
          update: [{ id: 'r2', changes: { name: 'Should not apply' } }],
        },
        false,
      );

      // r2 removed first, so update should find nothing
      expect(result.removed).toHaveLength(1);
      expect(result.updated).toHaveLength(0);
    });

    it('works with custom getRowId', async () => {
      const rows = [
        { key: 'k1', label: 'One' },
        { key: 'k2', label: 'Two' },
      ];
      const grid = await createGrid(rows, {
        getRowId: (row: any) => row.key,
      });

      const result = await grid.applyTransaction(
        {
          update: [{ id: 'k1', changes: { label: 'Updated' } }],
          remove: [{ id: 'k2' }],
        },
        false,
      );

      expect(result.updated).toHaveLength(1);
      expect(result.removed).toHaveLength(1);
      expect(grid.rows).toHaveLength(1);
      expect(grid.rows[0].label).toBe('Updated');
    });
  });

  // #endregion

  // #region applyTransactionAsync — batching

  describe('applyTransactionAsync', () => {
    it('applies merged transactions to filtered-out rows', async () => {
      const { grid, rows } = await createFilteredGrid();

      const [update, remove] = await Promise.all([
        grid.applyTransactionAsync({ update: [{ id: 'r2', changes: { count: 42 } }] }),
        grid.applyTransactionAsync({ remove: [{ id: 'r3' }] }),
      ]);

      expect(update).toBe(remove);
      expect(update.updated).toEqual([rows[1]]);
      expect(update.removed).toEqual([rows[2]]);
      expect(rows[1].count).toBe(42);
      expect(grid.sourceRows.map((row: TestRow) => row.id)).toEqual(['r1', 'r2']);
    });

    it('batches multiple calls within one frame', async () => {
      const grid = await createGrid(makeRows());

      // Fire three transactions without awaiting
      const p1 = grid.applyTransactionAsync({
        add: [{ id: 'a1', name: 'A1', status: 'new', count: 0 }],
      });
      const p2 = grid.applyTransactionAsync({
        add: [{ id: 'a2', name: 'A2', status: 'new', count: 0 }],
      });
      const p3 = grid.applyTransactionAsync({
        update: [{ id: 'r1', changes: { name: 'BatchUpdated' } }],
      });

      // All resolve with the same batched result
      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

      // Each resolver gets the merged result
      expect(r1.added).toHaveLength(2);
      expect(r1.updated).toHaveLength(1);
      expect(r2).toBe(r1); // same result object
      expect(r3).toBe(r1);

      expect(grid.rows).toHaveLength(5);
      expect(grid.rows[0].name).toBe('BatchUpdated');
    });

    it('merges removes across batched calls', async () => {
      const grid = await createGrid(makeRows());

      const p1 = grid.applyTransactionAsync({ remove: [{ id: 'r1' }] });
      const p2 = grid.applyTransactionAsync({ remove: [{ id: 'r3' }] });

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1.removed).toHaveLength(2);
      expect(r2).toBe(r1);
      expect(grid.rows).toHaveLength(1);
      expect(grid.rows[0].id).toBe('r2');
    });

    it('processes a new batch after the first frame completes', async () => {
      const grid = await createGrid(makeRows());

      // First batch
      await grid.applyTransactionAsync({
        add: [{ id: 'a1', name: 'A1', status: 'new', count: 0 }],
      });
      expect(grid.rows).toHaveLength(4);

      // Second batch (next RAF)
      await grid.applyTransactionAsync({
        add: [{ id: 'a2', name: 'A2', status: 'new', count: 0 }],
      });
      expect(grid.rows).toHaveLength(5);
    });
  });

  // #endregion
});
