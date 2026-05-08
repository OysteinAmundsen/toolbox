/**
 * Multi-Sort Benchmarks
 *
 * Measures the cost of `applySorts` (the hot path used on every sort change)
 * and `toggleSort` (called per header click). The previous wall-clock
 * "regression budget" assertion in `multi-sort.spec.ts` is replaced by these
 * benches: regressions are caught by the CI bench job comparing against the
 * cached `main` baseline (see `tools/compare-benches.ts`).
 */

import { randomInt } from 'node:crypto';
import { bench, describe } from 'vitest';
import type { ColumnConfig } from '../../core/types';
import { applySorts, toggleSort } from './multi-sort';
import type { SortModel } from './types';

// #region Data Generators

interface Row {
  name: string;
  age: number;
  city: string;
  salary: number;
}

function generateRows(count: number): Row[] {
  const cities = ['NYC', 'LA', 'Chicago', 'Boston', 'Seattle', 'Austin'];
  const rows: Row[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      name: `Person ${String(count - i).padStart(6, '0')}`,
      age: randomInt(18, 80),
      city: cities[i % cities.length],
      salary: randomInt(30_000, 200_001),
    });
  }
  return rows;
}

const COLUMNS: ColumnConfig<Row>[] = [
  { field: 'name', sortable: true },
  { field: 'age', sortable: true },
  { field: 'city', sortable: true },
  { field: 'salary', sortable: true },
];

const SORT_1: SortModel[] = [{ field: 'age', direction: 'asc' }];
const SORT_2: SortModel[] = [
  { field: 'age', direction: 'asc' },
  { field: 'name', direction: 'asc' },
];
const SORT_3: SortModel[] = [
  { field: 'city', direction: 'asc' },
  { field: 'age', direction: 'desc' },
  { field: 'name', direction: 'asc' },
];

// #endregion

// #region applySorts

describe('applySorts — single key', () => {
  const rows1k = generateRows(1_000);
  const rows10k = generateRows(10_000);
  const rows100k = generateRows(100_000);

  bench('1K rows', () => {
    applySorts(rows1k, SORT_1, COLUMNS);
  });

  bench('10K rows', () => {
    applySorts(rows10k, SORT_1, COLUMNS);
  });

  bench('100K rows', () => {
    applySorts(rows100k, SORT_1, COLUMNS);
  });
});

describe('applySorts — two keys', () => {
  const rows1k = generateRows(1_000);
  const rows10k = generateRows(10_000);
  const rows100k = generateRows(100_000);

  bench('1K rows', () => {
    applySorts(rows1k, SORT_2, COLUMNS);
  });

  bench('10K rows', () => {
    applySorts(rows10k, SORT_2, COLUMNS);
  });

  bench('100K rows', () => {
    applySorts(rows100k, SORT_2, COLUMNS);
  });
});

describe('applySorts — three keys', () => {
  const rows10k = generateRows(10_000);
  const rows100k = generateRows(100_000);

  bench('10K rows', () => {
    applySorts(rows10k, SORT_3, COLUMNS);
  });

  bench('100K rows', () => {
    applySorts(rows100k, SORT_3, COLUMNS);
  });
});

// #endregion

// #region toggleSort

describe('toggleSort', () => {
  const empty: SortModel[] = [];
  const single: SortModel[] = [{ field: 'name', direction: 'asc' }];
  const triple: SortModel[] = [
    { field: 'name', direction: 'asc' },
    { field: 'age', direction: 'desc' },
    { field: 'city', direction: 'asc' },
  ];

  bench('add to empty', () => {
    toggleSort(empty, 'name', false, 3);
  });

  bench('flip direction (single)', () => {
    toggleSort(single, 'name', false, 3);
  });

  bench('add to multi (shift)', () => {
    toggleSort(triple, 'salary', true, 4);
  });
});

// #endregion
