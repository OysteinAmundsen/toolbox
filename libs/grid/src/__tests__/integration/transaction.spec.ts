/**
 * Tests for the Transaction API (applyTransaction, applyTransactionAsync)
 */
import { afterEach, describe, expect, it } from 'vitest';

import '../../index';
import type { GridConfig } from '../../lib/core/types';

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
      const grid = await createGrid(makeRows());
      const result = await grid.applyTransaction({ remove: [{ id: 'r1' }, { id: 'r3' }] }, false);

      expect(result.removed).toHaveLength(2);
      expect(grid.rows).toHaveLength(1);
      expect(grid.rows[0].id).toBe('r2');
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
