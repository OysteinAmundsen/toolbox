/**
 * Value Accessor Benchmarks
 *
 * `resolveCellValue` is called per visible cell per render. A grid showing
 * ~500 cells at 60fps invokes this 30K times/sec; even nanosecond regressions
 * matter. Bench covers:
 *   - Plain field read (no accessor) — the common case, must stay near a raw
 *     property access.
 *   - First-call `valueAccessor` (cache miss) — exercises the WeakMap insert.
 *   - Repeated `valueAccessor` (cache hit) — must be ~free, otherwise the
 *     memo isn't doing its job.
 */

import { bench, describe } from 'vitest';
import type { ColumnConfig } from '../types';
import { invalidateAccessorCache, resolveCellValue } from './value-accessor';

// #region Fixtures

interface Row {
  id: number;
  name: string;
  nested: { value: number };
}

const plainCol: ColumnConfig<Row> = { field: 'name' };
const accessorCol: ColumnConfig<Row> = {
  field: 'nested',
  valueAccessor: ({ row }) => row.nested.value,
};
const otherAccessorCol: ColumnConfig<Row> = {
  field: 'nested',
  valueAccessor: ({ row }) => row.nested.value + 1,
};

const ROWS: Row[] = Array.from({ length: 1_000 }, (_, i) => ({
  id: i,
  name: `Row ${i}`,
  nested: { value: i * 2 },
}));
const SHARED_ROWS = ROWS.map((row) => ({ ...row }));

// Pre-warm cached row references for the cache-hit bench so the first call's
// WeakMap insert isn't measured.
for (const row of ROWS) resolveCellValue(row, accessorCol);
for (const row of SHARED_ROWS) {
  resolveCellValue(row, accessorCol);
  resolveCellValue(row, otherAccessorCol);
}

// #endregion

describe('resolveCellValue', () => {
  bench('plain field — direct property read', () => {
    for (const row of ROWS) resolveCellValue(row, plainCol);
  });

  bench('valueAccessor — cache hit', () => {
    // Same rows the warmup populated.
    for (const row of ROWS) resolveCellValue(row, accessorCol);
  });

  bench('valueAccessor — shared rows with alternating columns', () => {
    for (const row of SHARED_ROWS) {
      resolveCellValue(row, accessorCol);
      resolveCellValue(row, otherAccessorCol);
    }
  });

  bench('valueAccessor — invalidate + cache miss', () => {
    for (const row of ROWS) {
      invalidateAccessorCache(row);
      resolveCellValue(row, accessorCol);
    }
  });
});
