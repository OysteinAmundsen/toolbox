import { bench, describe } from 'vitest';
import { builtInSort, defaultComparator } from './sorting';

// #region Data Generators

function generateRows(count: number) {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: i,
      name: `Employee ${String(count - i).padStart(6, '0')}`,
      salary: Math.imul(i + 1, 2_654_435_761) >>> 0,
      metrics: { rank: Math.imul(i + 1, 2_246_822_519) >>> 0 },
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

  const sortedRows = generateRows(100_000);
  const reverseRows = generateRows(100_000);
  const nearlySortedRows = generateRows(100_000);
  const duplicateHeavyRows = generateRows(100_000);
  const nullHeavyRows = generateRows(100_000).map((row, i) => ({
    ...row,
    salary: i % 3 === 0 ? null : row.salary,
  }));
  for (let i = 0; i < 100_000; i++) {
    sortedRows[i].salary = i;
    reverseRows[i].salary = 100_000 - i;
    nearlySortedRows[i].salary = i;
    duplicateHeavyRows[i].salary = i % 10;
  }
  for (let i = 0; i < 99_999; i += 100) {
    const current = nearlySortedRows[i].salary;
    nearlySortedRows[i].salary = nearlySortedRows[i + 1].salary;
    nearlySortedRows[i + 1].salary = current;
  }

  bench('100K rows — sorted', () => {
    builtInSort(sortedRows, sortState, COLUMNS);
  });

  bench('100K rows — reverse ordered', () => {
    builtInSort(reverseRows, sortState, COLUMNS);
  });

  bench('100K rows — nearly sorted', () => {
    builtInSort(nearlySortedRows, sortState, COLUMNS);
  });

  bench('100K rows — duplicate heavy', () => {
    builtInSort(duplicateHeavyRows, sortState, COLUMNS);
  });

  bench('100K rows — null heavy', () => {
    builtInSort(nullHeavyRows, sortState, COLUMNS);
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

// #region builtInSort — extracted keys

describe('builtInSort — extracted keys', () => {
  const rows10K = generateRows(10_000);
  const rows100K = generateRows(100_000);
  const dottedState = { field: 'metrics.rank', direction: 1 as const };
  const dottedColumns = [{ field: 'metrics.rank' }];
  const accessorState = { field: 'computedRank', direction: 1 as const };
  const accessorColumns = [
    {
      field: 'computedRank',
      valueAccessor: ({ row }: { row: Record<string, unknown> }) => (row.metrics as { rank: number }).rank,
    },
  ];

  bench('10K rows — dotted path', () => {
    builtInSort(rows10K, dottedState, dottedColumns);
  });

  bench('100K rows — dotted path', () => {
    builtInSort(rows100K, dottedState, dottedColumns);
  });

  bench('10K rows — value accessor', () => {
    builtInSort(rows10K, accessorState, accessorColumns);
  });

  bench('100K rows — value accessor', () => {
    builtInSort(rows100K, accessorState, accessorColumns);
  });
});

// #endregion
