import { randomInt } from 'node:crypto';
import { bench, describe } from 'vitest';
import { builtInSort, defaultComparator } from './sorting';

// #region Data Generators

function generateRows(count: number) {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: i,
      name: `Employee ${String(count - i).padStart(6, '0')}`,
      salary: randomInt(0, 200_001),
      department: ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'][i % 5],
      hired: new Date(2020, 0, 1 + (i % 365)).toISOString(),
    });
  }
  return rows;
}

const COLUMNS = [{ field: 'name' }, { field: 'salary' }, { field: 'department' }];

// #endregion

// #region defaultComparator

describe('defaultComparator', () => {
  bench('number comparison', () => {
    defaultComparator(42, 99);
  });

  bench('string comparison', () => {
    defaultComparator('alpha', 'beta');
  });

  bench('null handling', () => {
    defaultComparator(null, 42);
  });
});

// #endregion

// #region builtInSort — string field

describe('builtInSort — string field', () => {
  const rows1K = generateRows(1_000);
  const rows10K = generateRows(10_000);
  const rows100K = generateRows(100_000);
  const sortState = { field: 'name', direction: 1 as const };

  bench('1K rows', () => {
    builtInSort(rows1K, sortState, COLUMNS);
  });

  bench('10K rows', () => {
    builtInSort(rows10K, sortState, COLUMNS);
  });

  bench('100K rows', () => {
    builtInSort(rows100K, sortState, COLUMNS);
  });
});

// #endregion

// #region builtInSort — numeric field

describe('builtInSort — numeric field', () => {
  const rows1K = generateRows(1_000);
  const rows10K = generateRows(10_000);
  const rows100K = generateRows(100_000);
  const sortState = { field: 'salary', direction: 1 as const };

  bench('1K rows', () => {
    builtInSort(rows1K, sortState, COLUMNS);
  });

  bench('10K rows', () => {
    builtInSort(rows10K, sortState, COLUMNS);
  });

  bench('100K rows', () => {
    builtInSort(rows100K, sortState, COLUMNS);
  });
});

// #endregion

// #region builtInSort — custom comparator

describe('builtInSort — custom comparator', () => {
  const rows10K = generateRows(10_000);
  const rows100K = generateRows(100_000);
  const sortState = { field: 'salary', direction: 1 as const };
  const columnsWithComparator = [
    {
      field: 'salary',
      sortComparator: (a: unknown, b: unknown) => (Number(a) || 0) - (Number(b) || 0),
    },
  ];

  bench('10K rows', () => {
    builtInSort(rows10K, sortState, columnsWithComparator);
  });

  bench('100K rows', () => {
    builtInSort(rows100K, sortState, columnsWithComparator);
  });
});

// #endregion
