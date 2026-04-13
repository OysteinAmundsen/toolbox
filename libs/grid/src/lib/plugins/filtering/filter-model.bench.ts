import { bench, describe } from 'vitest';
import { filterRows, matchesFilter } from './filter-model';
import type { FilterModel } from './types';

// #region Data Generators

function generateRows(count: number) {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: i,
      name: `Employee ${String(i).padStart(6, '0')}`,
      salary: 30_000 + Math.round(Math.random() * 170_000),
      department: ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'][i % 5],
      active: i % 3 !== 0,
    });
  }
  return rows;
}

// #endregion

// #region Single filter — text contains

describe('filterRows — text contains', () => {
  const rows1K = generateRows(1_000);
  const rows10K = generateRows(10_000);
  const rows100K = generateRows(100_000);
  const filter: FilterModel[] = [{ field: 'name', type: 'text', operator: 'contains', value: '042' }];

  bench('1K rows', () => {
    filterRows(rows1K, filter);
  });

  bench('10K rows', () => {
    filterRows(rows10K, filter);
  });

  bench('100K rows', () => {
    filterRows(rows100K, filter);
  });
});

// #endregion

// #region Single filter — numeric between

describe('filterRows — numeric between', () => {
  const rows10K = generateRows(10_000);
  const rows100K = generateRows(100_000);
  const filter: FilterModel[] = [
    { field: 'salary', type: 'number', operator: 'between', value: 50_000, valueTo: 100_000 },
  ];

  bench('10K rows', () => {
    filterRows(rows10K, filter);
  });

  bench('100K rows', () => {
    filterRows(rows100K, filter);
  });
});

// #endregion

// #region Single filter — set in

describe('filterRows — set in', () => {
  const rows10K = generateRows(10_000);
  const rows100K = generateRows(100_000);
  const filter: FilterModel[] = [
    { field: 'department', type: 'text', operator: 'in', value: ['Engineering', 'Sales'] },
  ];

  bench('10K rows', () => {
    filterRows(rows10K, filter);
  });

  bench('100K rows', () => {
    filterRows(rows100K, filter);
  });
});

// #endregion

// #region Multiple filters (AND)

describe('filterRows — 3 filters AND', () => {
  const rows10K = generateRows(10_000);
  const rows100K = generateRows(100_000);
  const filters: FilterModel[] = [
    { field: 'department', type: 'text', operator: 'in', value: ['Engineering', 'Sales'] },
    { field: 'salary', type: 'number', operator: 'greaterThan', value: 60_000 },
    { field: 'name', type: 'text', operator: 'contains', value: '0' },
  ];

  bench('10K rows', () => {
    filterRows(rows10K, filters);
  });

  bench('100K rows', () => {
    filterRows(rows100K, filters);
  });
});

// #endregion

// #region matchesFilter — single row

describe('matchesFilter — single row', () => {
  const row = { id: 1, name: 'Employee 000042', salary: 75_000, department: 'Engineering', active: true };

  bench('text contains', () => {
    matchesFilter(row, { field: 'name', type: 'text', operator: 'contains', value: '042' });
  });

  bench('numeric greaterThan', () => {
    matchesFilter(row, { field: 'salary', type: 'number', operator: 'greaterThan', value: 50_000 });
  });

  bench('blank check', () => {
    matchesFilter(row, { field: 'name', type: 'text', operator: 'blank', value: '' });
  });
});

// #endregion
