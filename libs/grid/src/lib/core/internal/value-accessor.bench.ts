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
import { resolveCellValue } from './value-accessor';

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

const ROWS: Row[] = Array.from({ length: 1_000 }, (_, i) => ({
  id: i,
  name: `Row ${i}`,
  nested: { value: i * 2 },
}));

// Pre-warm cached row references for the cache-hit bench so the first call's
// WeakMap insert isn't measured.
for (const row of ROWS) resolveCellValue(row, accessorCol);

// #endregion

describe('resolveCellValue', () => {
  bench('plain field — direct property read', () => {
    for (const row of ROWS) resolveCellValue(row, plainCol);
  });

  bench('valueAccessor — cache hit', () => {
    // Same rows the warmup populated; expect WeakMap lookup only.
    for (const row of ROWS) resolveCellValue(row, accessorCol);
  });

  bench('valueAccessor — cache miss (fresh rows)', () => {
    // Fresh row objects → WeakMap miss → accessor invocation + insert.
    const fresh = ROWS.map((r) => ({ ...r }));
    for (const row of fresh) resolveCellValue(row, accessorCol);
  });
});
