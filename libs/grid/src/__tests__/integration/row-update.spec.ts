/**
 * Tests for the Row Update API (updateRow, updateRows, getRow, getRowId)
 */
import { afterEach, describe, expect, it } from 'vitest';

import '../../index';
import type { GridConfig } from '../../lib/core/types';

// Test data type
interface TestRow {
  id: string;
  name: string;
  status: string;
  count: number;
}

// Helper to create and wait for grid
async function createGrid<T>(rows: T[], config?: Partial<GridConfig<T>>) {
  const grid = document.createElement('tbw-grid') as any;
  // Set config BEFORE rows so getRowId is available when row ID map is built
  if (config) {
    grid.gridConfig = config;
  }
  grid.rows = rows;
  document.body.appendChild(grid);
  await grid.ready();
  return grid;
}

describe('Row Update API', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('getRowId', () => {
    it('uses configured getRowId function', async () => {
      const rows: TestRow[] = [{ id: 'r1', name: 'Alice', status: 'active', count: 10 }];
      const grid = await createGrid(rows, {
        getRowId: (row) => `custom-${row.id}`,
      });

      expect(grid.getRowId(rows[0])).toBe('custom-r1');
    });

    it('falls back to row.id when getRowId not configured', async () => {
      const rows: TestRow[] = [{ id: 'r1', name: 'Alice', status: 'active', count: 10 }];
      const grid = await createGrid(rows);

      expect(grid.getRowId(rows[0])).toBe('r1');
    });

    it('falls back to row._id when no id field', async () => {
      const rows = [{ _id: 'mongo-123', name: 'Bob' }];
      const grid = await createGrid(rows);

      expect(grid.getRowId(rows[0])).toBe('mongo-123');
    });

    it('throws when no ID can be determined', async () => {
      const rows = [{ name: 'NoId' }];
      const grid = await createGrid(rows);

      expect(() => grid.getRowId(rows[0])).toThrow('[tbw-grid] Cannot determine row ID');
    });
  });

  describe('getRow', () => {
    it('returns row by ID', async () => {
      const rows: TestRow[] = [
        { id: 'r1', name: 'Alice', status: 'active', count: 10 },
        { id: 'r2', name: 'Bob', status: 'pending', count: 20 },
      ];
      const grid = await createGrid(rows);

      const row = grid.getRow('r2');
      expect(row).toBeDefined();
      expect(row.name).toBe('Bob');
    });

    it('returns undefined for unknown ID', async () => {
      const rows: TestRow[] = [{ id: 'r1', name: 'Alice', status: 'active', count: 10 }];
      const grid = await createGrid(rows);

      expect(grid.getRow('unknown')).toBeUndefined();
    });

    it('uses custom getRowId for lookup', async () => {
      const rows: TestRow[] = [{ id: 'r1', name: 'Alice', status: 'active', count: 10 }];
      const grid = await createGrid(rows, {
        getRowId: (row) => `prefix-${row.id}`,
      });

      expect(grid.getRow('r1')).toBeUndefined();
      expect(grid.getRow('prefix-r1')?.name).toBe('Alice');
    });
  });

  describe('updateRow', () => {
    it('updates row in-place', async () => {
      const rows: TestRow[] = [{ id: 'r1', name: 'Alice', status: 'active', count: 10 }];
      const grid = await createGrid(rows);

      grid.updateRow('r1', { status: 'inactive', count: 15 });

      expect(rows[0].status).toBe('inactive');
      expect(rows[0].count).toBe(15);
      expect(rows[0].name).toBe('Alice'); // Unchanged
    });

    it('emits cell-change for each changed field', async () => {
      const rows: TestRow[] = [{ id: 'r1', name: 'Alice', status: 'active', count: 10 }];
      const grid = await createGrid(rows);

      const changes: any[] = [];
      grid.addEventListener('cell-change', (e: CustomEvent) => changes.push(e.detail));

      grid.updateRow('r1', { status: 'inactive', count: 15 });

      expect(changes).toHaveLength(2);
      expect(changes[0].field).toBe('status');
      expect(changes[0].oldValue).toBe('active');
      expect(changes[0].newValue).toBe('inactive');
      expect(changes[0].source).toBe('api');
      expect(changes[0].rowId).toBe('r1');

      expect(changes[1].field).toBe('count');
      expect(changes[1].oldValue).toBe(10);
      expect(changes[1].newValue).toBe(15);
    });

    it('does not emit for unchanged fields', async () => {
      const rows: TestRow[] = [{ id: 'r1', name: 'Alice', status: 'active', count: 10 }];
      const grid = await createGrid(rows);

      const changes: any[] = [];
      grid.addEventListener('cell-change', (e: CustomEvent) => changes.push(e.detail));

      grid.updateRow('r1', { status: 'active' }); // Same value

      expect(changes).toHaveLength(0);
    });

    it('throws for unknown row ID', async () => {
      const rows: TestRow[] = [{ id: 'r1', name: 'Alice', status: 'active', count: 10 }];
      const grid = await createGrid(rows);

      expect(() => grid.updateRow('unknown', { status: 'x' })).toThrow('[tbw-grid] Row with ID "unknown" not found');
    });

    it('respects source parameter', async () => {
      const rows: TestRow[] = [{ id: 'r1', name: 'Alice', status: 'active', count: 10 }];
      const grid = await createGrid(rows);

      const changes: any[] = [];
      grid.addEventListener('cell-change', (e: CustomEvent) => changes.push(e.detail));

      grid.updateRow('r1', { status: 'cascade-updated' }, 'cascade');

      expect(changes[0].source).toBe('cascade');
    });

    it('uses custom getRowId for lookup', async () => {
      const rows: TestRow[] = [{ id: 'r1', name: 'Alice', status: 'active', count: 10 }];
      const grid = await createGrid(rows, {
        getRowId: (row) => `custom-${row.id}`,
      });

      grid.updateRow('custom-r1', { status: 'updated' });
      expect(rows[0].status).toBe('updated');
    });
  });

  describe('updateRows', () => {
    it('updates multiple rows in single call', async () => {
      const rows: TestRow[] = [
        { id: 'r1', name: 'Alice', status: 'active', count: 10 },
        { id: 'r2', name: 'Bob', status: 'active', count: 20 },
        { id: 'r3', name: 'Carol', status: 'active', count: 30 },
      ];
      const grid = await createGrid(rows);

      grid.updateRows([
        { id: 'r1', changes: { status: 'shipped' } },
        { id: 'r3', changes: { status: 'shipped', count: 35 } },
      ]);

      expect(rows[0].status).toBe('shipped');
      expect(rows[1].status).toBe('active'); // Unchanged
      expect(rows[2].status).toBe('shipped');
      expect(rows[2].count).toBe(35);
    });

    it('emits cell-change for all changed fields', async () => {
      const rows: TestRow[] = [
        { id: 'r1', name: 'Alice', status: 'active', count: 10 },
        { id: 'r2', name: 'Bob', status: 'active', count: 20 },
      ];
      const grid = await createGrid(rows);

      const changes: any[] = [];
      grid.addEventListener('cell-change', (e: CustomEvent) => changes.push(e.detail));

      grid.updateRows([
        { id: 'r1', changes: { status: 'shipped' } },
        { id: 'r2', changes: { status: 'shipped', count: 25 } },
      ]);

      expect(changes).toHaveLength(3); // 1 for r1, 2 for r2
      expect(changes.map((c) => c.rowId)).toEqual(['r1', 'r2', 'r2']);
    });

    it('throws for unknown row ID', async () => {
      const rows: TestRow[] = [{ id: 'r1', name: 'Alice', status: 'active', count: 10 }];
      const grid = await createGrid(rows);

      expect(() =>
        grid.updateRows([
          { id: 'r1', changes: { status: 'ok' } },
          { id: 'unknown', changes: { status: 'bad' } },
        ]),
      ).toThrow('[tbw-grid] Row with ID "unknown" not found');
    });
  });

  describe('cascade safety', () => {
    it('source tracking enables cascade prevention', async () => {
      const rows: TestRow[] = [{ id: 'r1', name: 'Alice', status: 'active', count: 10 }];
      const grid = await createGrid(rows);

      const userChanges: any[] = [];
      const cascadeChanges: any[] = [];

      grid.addEventListener('cell-change', (e: CustomEvent) => {
        const detail = e.detail;
        if (detail.source === 'user') {
          userChanges.push(detail);
        } else if (detail.source === 'cascade') {
          cascadeChanges.push(detail);
        }

        // Simulate cascade: when status changes from user, clear count
        if (detail.field === 'status' && detail.source === 'user') {
          grid.updateRow('r1', { count: 0 }, 'cascade');
        }
        // This cascade handler should NOT trigger on cascade source
        // (prevents infinite loop)
      });

      // Trigger with source: 'user'
      grid.updateRow('r1', { status: 'changed' }, 'user');

      expect(userChanges).toHaveLength(1);
      expect(userChanges[0].field).toBe('status');

      expect(cascadeChanges).toHaveLength(1);
      expect(cascadeChanges[0].field).toBe('count');
      expect(cascadeChanges[0].newValue).toBe(0);
    });
  });

  describe('insertRow + updateRow interaction', () => {
    it('updateRow does not move an insertRow-d row to its sorted position (ghost row bug)', async () => {
      // Scenario: grid has sorted data, user inserts a new row at index 0,
      // then updates it (e.g. cascaded field change). The row should stay at
      // index 0 — NOT jump to the end of the list as a "ghost" duplicate.
      const rows: TestRow[] = [
        { id: 'r1', name: 'Alice', status: 'active', count: 10 },
        { id: 'r2', name: 'Bob', status: 'active', count: 20 },
        { id: 'r3', name: 'Carol', status: 'active', count: 30 },
      ];
      const grid = await createGrid(rows, {
        columns: [
          { field: 'id', header: 'ID', sortable: true },
          { field: 'name', header: 'Name' },
          { field: 'status', header: 'Status' },
          { field: 'count', header: 'Count' },
        ],
      });

      // Insert a new row at index 0 (top of the visible list)
      const newRow: TestRow = { id: 'new-1', name: '', status: 'draft', count: 0 };
      grid.insertRow(0, newRow, false);

      // Verify the inserted row is at position 0
      expect(grid.rows[0]).toBe(newRow);
      expect(grid.rows.length).toBe(4);

      // Simulate a cascaded update (e.g. user picks a terminal → status changes)
      grid.updateRow('new-1', { status: 'confirmed', name: 'NewCargo' });

      // The row must remain at index 0 — NOT appear at the end
      expect(grid.rows[0]).toBe(newRow);
      expect(grid.rows[0].status).toBe('confirmed');
      expect(grid.rows[0].name).toBe('NewCargo');
      expect(grid.rows.length).toBe(4);

      // Verify no duplicate/ghost row at the end
      const ids = grid.rows.map((r: TestRow) => r.id);
      expect(ids).toEqual(['new-1', 'r1', 'r2', 'r3']);
    });

    it('updateRow on an insertRow-d row with active sort keeps row position', async () => {
      // Same scenario but with an active core sort applied before insert
      const rows: TestRow[] = [
        { id: 'r3', name: 'Carol', status: 'active', count: 30 },
        { id: 'r1', name: 'Alice', status: 'active', count: 10 },
        { id: 'r2', name: 'Bob', status: 'active', count: 20 },
      ];
      const grid = await createGrid(rows, {
        columns: [
          { field: 'name', header: 'Name', sortable: true },
          { field: 'id', header: 'ID' },
          { field: 'status', header: 'Status' },
          { field: 'count', header: 'Count' },
        ],
      });

      // Click the Name header to sort ascending
      const header = grid.querySelector('[role="columnheader"]');
      header?.click();
      // Wait for sort to apply
      await new Promise((r) => requestAnimationFrame(r));

      // After sort: Alice(r1), Bob(r2), Carol(r3)
      expect(grid.rows.map((r: TestRow) => r.id)).toEqual(['r1', 'r2', 'r3']);

      // Insert new row at top
      const newRow: TestRow = { id: 'new-1', name: '', status: 'draft', count: 0 };
      grid.insertRow(0, newRow, false);

      expect(grid.rows[0]).toBe(newRow);

      // Update the inserted row — should NOT trigger re-sort
      grid.updateRow('new-1', { name: 'Zara', status: 'confirmed' });

      // Row stays at index 0 despite 'Zara' sorting after 'Carol'
      expect(grid.rows[0]).toBe(newRow);
      expect(grid.rows[0].name).toBe('Zara');
      expect(grid.rows.length).toBe(4);
      expect(grid.rows.map((r: TestRow) => r.id)).toEqual(['new-1', 'r1', 'r2', 'r3']);
    });
  });

  describe('insertRow + updateRow with MultiSortPlugin', () => {
    it('updateRow does not re-sort an insertRow-d row via MultiSortPlugin', async () => {
      const { MultiSortPlugin } = await import('../../lib/plugins/multi-sort');

      const rows: TestRow[] = [
        { id: 'r3', name: 'Carol', status: 'active', count: 30 },
        { id: 'r1', name: 'Alice', status: 'active', count: 10 },
        { id: 'r2', name: 'Bob', status: 'active', count: 20 },
      ];
      const plugin = new MultiSortPlugin();
      const grid = await createGrid(rows, {
        columns: [
          { field: 'name', header: 'Name', sortable: true },
          { field: 'id', header: 'ID' },
          { field: 'status', header: 'Status' },
          { field: 'count', header: 'Count' },
        ],
        plugins: [plugin],
      });

      // Apply multi-sort ascending on name
      plugin.setSortModel([{ field: 'name', direction: 'asc' }]);
      // Wait for the ROWS-phase render to apply the sort
      await new Promise((r) => requestAnimationFrame(r));

      // After sort: Alice(r1), Bob(r2), Carol(r3)
      expect(grid.rows.map((r: TestRow) => r.id)).toEqual(['r1', 'r2', 'r3']);

      // Insert new row at top
      const newRow: TestRow = { id: 'new-1', name: '', status: 'draft', count: 0 };
      grid.insertRow(0, newRow, false);
      expect(grid.rows[0]).toBe(newRow);

      // Update the inserted row — should NOT trigger MultiSort re-sort
      grid.updateRow('new-1', { name: 'Zara', status: 'confirmed' });

      // Row stays at index 0 despite 'Zara' sorting after 'Carol'
      expect(grid.rows[0]).toBe(newRow);
      expect(grid.rows[0].name).toBe('Zara');
      expect(grid.rows.length).toBe(4);
      expect(grid.rows.map((r: TestRow) => r.id)).toEqual(['new-1', 'r1', 'r2', 'r3']);
    });
  });

  describe('insertRow + updateRow with FilteringPlugin', () => {
    it('updateRow does not filter out an insertRow-d row', async () => {
      const { FilteringPlugin } = await import('../../lib/plugins/filtering');

      const rows: TestRow[] = [
        { id: 'r1', name: 'Alice', status: 'active', count: 10 },
        { id: 'r2', name: 'Bob', status: 'active', count: 20 },
        { id: 'r3', name: 'Carol', status: 'inactive', count: 30 },
      ];
      const plugin = new FilteringPlugin({});
      const grid = await createGrid(rows, {
        columns: [
          { field: 'name', header: 'Name' },
          { field: 'id', header: 'ID' },
          { field: 'status', header: 'Status', filterable: true },
          { field: 'count', header: 'Count' },
        ],
        plugins: [plugin],
      });

      // Filter to only 'active' rows
      plugin.setFilter('status', { type: 'text', operator: 'equals', value: 'active' });
      // Wait for the ROWS-phase render to apply the filter
      await new Promise((r) => requestAnimationFrame(r));

      // Only Alice and Bob visible
      expect(grid.rows.length).toBe(2);
      expect(grid.rows.map((r: TestRow) => r.id)).toEqual(['r1', 'r2']);

      // Insert a new row at top — it starts with status 'draft' which does NOT
      // match the filter, but it should stay visible until the next full pipeline run.
      const newRow: TestRow = { id: 'new-1', name: 'NewEntry', status: 'draft', count: 0 };
      grid.insertRow(0, newRow, false);
      expect(grid.rows[0]).toBe(newRow);
      expect(grid.rows.length).toBe(3);

      // Update the inserted row — should NOT trigger re-filter and remove it
      grid.updateRow('new-1', { name: 'Updated', count: 5 });

      // Row must still be visible at index 0
      expect(grid.rows[0]).toBe(newRow);
      expect(grid.rows[0].name).toBe('Updated');
      expect(grid.rows.length).toBe(3);
      expect(grid.rows.map((r: TestRow) => r.id)).toEqual(['new-1', 'r1', 'r2']);
    });

    it('updateRow on an existing row does not re-filter it out of view', async () => {
      const { FilteringPlugin } = await import('../../lib/plugins/filtering');

      const rows: TestRow[] = [
        { id: 'r1', name: 'Alice', status: 'active', count: 10 },
        { id: 'r2', name: 'Bob', status: 'active', count: 20 },
      ];
      const plugin = new FilteringPlugin({});
      const grid = await createGrid(rows, {
        columns: [
          { field: 'name', header: 'Name' },
          { field: 'status', header: 'Status', filterable: true },
          { field: 'count', header: 'Count' },
        ],
        plugins: [plugin],
      });

      // Filter status = 'active'
      plugin.setFilter('status', { type: 'text', operator: 'equals', value: 'active' });
      // Wait for the ROWS-phase render to apply the filter
      await new Promise((r) => requestAnimationFrame(r));
      expect(grid.rows.length).toBe(2);

      // Change Bob's status to 'inactive' via updateRow — the row should NOT
      // vanish immediately (that would be disorienting mid-edit)
      grid.updateRow('r2', { status: 'inactive' });

      expect(grid.rows.length).toBe(2);
      expect(grid.rows[1].status).toBe('inactive');
      expect(grid.rows.map((r: TestRow) => r.id)).toEqual(['r1', 'r2']);
    });
  });

  describe('row map rebuilding', () => {
    it('rebuilds map when rows array is replaced', async () => {
      const rows1: TestRow[] = [{ id: 'r1', name: 'Alice', status: 'active', count: 10 }];
      const grid = await createGrid(rows1);

      expect(grid.getRow('r1')).toBeDefined();
      expect(grid.getRow('r2')).toBeUndefined();

      // Replace rows array
      const rows2: TestRow[] = [{ id: 'r2', name: 'Bob', status: 'pending', count: 20 }];
      grid.rows = rows2;
      await grid.ready();

      expect(grid.getRow('r1')).toBeUndefined();
      expect(grid.getRow('r2')).toBeDefined();
    });
  });
});
