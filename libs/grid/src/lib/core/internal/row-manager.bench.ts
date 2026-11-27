import { bench, describe } from 'vitest';
import '../grid';
import type { DataGridElement } from '../grid';

interface BenchRow {
  id: string;
  value: number;
}

for (const [rowCount, delta] of [
  [10_000, 100],
  [10_000, 1_000],
  [20_000, 1_000],
]) {
  const first = Array.from({ length: delta }, (_, i) => ({ id: `first-${i}`, value: 0 }));
  const second = Array.from({ length: delta }, (_, i) => ({ id: `second-${i}`, value: 0 }));
  const remaining = Array.from({ length: rowCount - first.length }, (_, i) => ({
    id: `stable-${i}`,
    value: 0,
  }));
  const removes = [first, second].map((rows) => rows.map(({ id }) => ({ id })));
  const updates = [1, 2].map((value) => remaining.slice(0, 500).map(({ id }) => ({ id, changes: { value } })));
  const grid = document.createElement('tbw-grid') as DataGridElement<BenchRow>;
  grid.gridConfig = { columns: [{ field: 'id' }], getRowId: (row) => row.id };
  grid.rows = [...first, ...remaining];
  document.body.appendChild(grid);
  await grid.ready();

  describe(`transactions: ${rowCount} source rows, ${delta} replacements`, () => {
    let active = 0;

    bench('replace rows and update 500', async () => {
      const next = 1 - active;
      const result = await grid.applyTransaction(
        { remove: removes[active], add: next ? second : first, update: updates[active] },
        false,
      );
      if (
        result.removed.length !== delta ||
        result.added.length !== delta ||
        result.updated.length !== 500 ||
        grid.sourceRows.length !== rowCount
      ) {
        throw new Error('Transaction benchmark did not perform the expected work');
      }
      active = next;
    });
  });
}
