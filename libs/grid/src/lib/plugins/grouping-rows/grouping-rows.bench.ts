import { randomInt } from 'node:crypto';
import { bench, describe } from 'vitest';
import { buildGroupedRowModel } from './grouping-rows';
import type { GroupingRowsConfig } from './types';

// #region Data Generators

function generateRows(count: number) {
  const departments = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'];
  const teams = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];
  const locations = ['NYC', 'SF', 'London', 'Berlin', 'Tokyo'];
  const rows: Record<string, unknown>[] = [];

  for (let i = 0; i < count; i++) {
    rows.push({
      id: i,
      name: `Employee ${i}`,
      department: departments[i % departments.length],
      team: teams[i % teams.length],
      location: locations[i % locations.length],
      salary: randomInt(30_000, 200_001),
    });
  }
  return rows;
}

// #endregion

// #region Single-level grouping

describe('buildGroupedRowModel — single level', () => {
  const rows1K = generateRows(1_000);
  const rows10K = generateRows(10_000);
  const rows100K = generateRows(100_000);

  const config: GroupingRowsConfig = {
    groupOn: (row: Record<string, unknown>) => [row['department']],
  };

  bench('1K rows — 5 groups', () => {
    buildGroupedRowModel({ rows: rows1K, config, expanded: new Set() });
  });

  bench('10K rows — 5 groups', () => {
    buildGroupedRowModel({ rows: rows10K, config, expanded: new Set() });
  });

  bench('100K rows — 5 groups', () => {
    buildGroupedRowModel({ rows: rows100K, config, expanded: new Set() });
  });
});

// #endregion

// #region Multi-level grouping

describe('buildGroupedRowModel — multi-level', () => {
  const rows1K = generateRows(1_000);
  const rows10K = generateRows(10_000);
  const rows100K = generateRows(100_000);

  const config2: GroupingRowsConfig = {
    groupOn: (row: Record<string, unknown>) => [row['department'], row['team']],
  };
  const config3: GroupingRowsConfig = {
    groupOn: (row: Record<string, unknown>) => [row['department'], row['team'], row['location']],
  };

  bench('1K rows — 2 levels (dept → team)', () => {
    buildGroupedRowModel({ rows: rows1K, config: config2, expanded: new Set() });
  });

  bench('10K rows — 2 levels (dept → team)', () => {
    buildGroupedRowModel({ rows: rows10K, config: config2, expanded: new Set() });
  });

  bench('10K rows — 3 levels (dept → team → location)', () => {
    buildGroupedRowModel({ rows: rows10K, config: config3, expanded: new Set() });
  });

  bench('100K rows — 2 levels (dept → team)', () => {
    buildGroupedRowModel({ rows: rows100K, config: config2, expanded: new Set() });
  });
});

// #endregion

// #region Expanded groups (flattening)

describe('buildGroupedRowModel — expanded', () => {
  const rows10K = generateRows(10_000);

  const config: GroupingRowsConfig = {
    groupOn: (row: Record<string, unknown>) => [row['department']],
  };

  bench('10K rows — all collapsed', () => {
    buildGroupedRowModel({ rows: rows10K, config, expanded: new Set() });
  });

  bench('10K rows — all expanded', () => {
    const allKeys = new Set(['Engineering', 'Sales', 'Marketing', 'HR', 'Finance']);
    buildGroupedRowModel({ rows: rows10K, config, expanded: allKeys });
  });
});

// #endregion

// #region High cardinality

describe('buildGroupedRowModel — high cardinality', () => {
  const rows10K = generateRows(10_000);

  const uniqueConfig: GroupingRowsConfig = {
    groupOn: (row: Record<string, unknown>) => [`id-${row['id']}`],
  };

  bench('10K rows — 10K groups (unique)', () => {
    buildGroupedRowModel({ rows: rows10K, config: uniqueConfig, expanded: new Set() });
  });
});

// #endregion
