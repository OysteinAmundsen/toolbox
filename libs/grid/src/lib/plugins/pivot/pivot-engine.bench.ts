import { bench, describe } from 'vitest';
import {
  buildPivot,
  calculateTotals,
  flattenPivotRows,
  getAllGroupKeys,
  getColumnTotals,
  sortPivotMulti,
} from './pivot-engine';
import type { PivotConfig, PivotValueField } from './types';

// #region Data Generators

function generateRows(count: number) {
  const departments = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'];
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  const regions = ['North', 'South', 'East', 'West'];
  const products = ['Widget A', 'Widget B', 'Widget C', 'Widget D', 'Widget E'];
  const rows: Record<string, unknown>[] = [];

  for (let i = 0; i < count; i++) {
    rows.push({
      id: i,
      department: departments[i % departments.length],
      quarter: quarters[i % quarters.length],
      region: regions[i % regions.length],
      product: products[i % products.length],
      revenue: 1_000 + ((Math.imul(i + 1, 2_654_435_761) >>> 0) % 99_001),
      cost: 500 + ((Math.imul(i + 1, 2_246_822_519) >>> 0) % 49_001),
      units: (Math.imul(i + 1, 3_266_489_917) >>> 0) % 1_001,
    });
  }
  return rows;
}

function generateHighCardinalityRows(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    account: `Account ${i % 1_000}`,
    period: `P${i % 20}`,
    revenue: i % 17 === 0 ? null : (Math.imul(i + 1, 2_654_435_761) >>> 0) % 100_000,
    cost: i % 23 === 0 ? '' : (Math.imul(i + 1, 2_246_822_519) >>> 0) % 50_000,
    units: (Math.imul(i + 1, 3_266_489_917) >>> 0) % 1_001,
  }));
}

// #endregion

// #region buildPivot — single row group

describe('buildPivot — single row group', () => {
  const rows1K = generateRows(1_000);
  const rows10K = generateRows(10_000);
  const rows100K = generateRows(100_000);

  const config: PivotConfig = {
    rowGroupFields: ['department'],
    columnGroupFields: ['quarter'],
    valueFields: [{ field: 'revenue', aggFunc: 'sum' }],
  };

  bench('1K rows — 5 groups × 4 cols', () => {
    buildPivot(rows1K, config);
  });

  bench('10K rows — 5 groups × 4 cols', () => {
    buildPivot(rows10K, config);
  });

  bench('100K rows — 5 groups × 4 cols', () => {
    buildPivot(rows100K, config);
  });
});

// #endregion

// #region buildPivot — multi-level row groups

describe('buildPivot — multi-level row groups', () => {
  const rows10K = generateRows(10_000);
  const rows100K = generateRows(100_000);

  const config2: PivotConfig = {
    rowGroupFields: ['department', 'region'],
    columnGroupFields: ['quarter'],
    valueFields: [{ field: 'revenue', aggFunc: 'sum' }],
  };

  const config3: PivotConfig = {
    rowGroupFields: ['department', 'region', 'product'],
    columnGroupFields: ['quarter'],
    valueFields: [{ field: 'revenue', aggFunc: 'sum' }],
  };

  bench('10K rows — 2 row levels', () => {
    buildPivot(rows10K, config2);
  });

  bench('100K rows — 2 row levels', () => {
    buildPivot(rows100K, config2);
  });

  bench('10K rows — 3 row levels', () => {
    buildPivot(rows10K, config3);
  });
});

// #endregion

// #region buildPivot — multiple value fields

describe('buildPivot — multiple value fields', () => {
  const rows10K = generateRows(10_000);

  const config: PivotConfig = {
    rowGroupFields: ['department'],
    columnGroupFields: ['quarter'],
    valueFields: [
      { field: 'revenue', aggFunc: 'sum' },
      { field: 'cost', aggFunc: 'sum' },
      { field: 'units', aggFunc: 'avg' },
      { field: 'revenue', aggFunc: 'max' },
    ],
  };

  bench('10K rows — 4 value fields', () => {
    buildPivot(rows10K, config);
  });
});

describe('buildPivot — high cardinality with blanks', () => {
  const rows10K = generateHighCardinalityRows(10_000);
  const rows100K = generateHighCardinalityRows(100_000);
  const config: PivotConfig = {
    rowGroupFields: ['account'],
    columnGroupFields: ['period'],
    valueFields: [
      { field: 'revenue', aggFunc: 'sum' },
      { field: 'revenue', aggFunc: 'avg' },
      { field: 'cost', aggFunc: 'max' },
      { field: 'units', aggFunc: 'sum' },
    ],
  };

  bench('10K rows — 1K groups × 20 cols × 4 values', () => {
    buildPivot(rows10K, config);
  });

  bench('100K rows — 1K groups × 20 cols × 4 values', () => {
    buildPivot(rows100K, config);
  });
});

// #endregion

// #region totals traversal

describe('pivot totals traversal', () => {
  const rows = generateHighCardinalityRows(100_000);
  const valueFields: PivotValueField[] = [
    { field: 'revenue', aggFunc: 'sum' },
    { field: 'revenue', aggFunc: 'avg' },
    { field: 'cost', aggFunc: 'max' },
    { field: 'units', aggFunc: 'sum' },
  ];
  const result = buildPivot(rows, {
    rowGroupFields: ['account'],
    columnGroupFields: ['period'],
    valueFields,
  });

  bench('calculateTotals — 1K rows × 80 value keys', () => {
    calculateTotals(result.rows, result.columnKeys, valueFields);
  });

  bench('getColumnTotals — 1K rows × 80 value keys', () => {
    getColumnTotals(result.rows, result.columnKeys, valueFields);
  });
});

// #endregion

// #region flattenPivotRows

describe('flattenPivotRows', () => {
  const rows10K = generateRows(10_000);
  const config: PivotConfig = {
    rowGroupFields: ['department', 'region'],
    columnGroupFields: ['quarter'],
    valueFields: [{ field: 'revenue', aggFunc: 'sum' }],
  };

  const result = buildPivot(rows10K, config);
  const allKeys = getAllGroupKeys(result.rows);
  const expandedAll = new Set(allKeys);
  const expandedNone = new Set<string>();

  bench('all expanded', () => {
    flattenPivotRows(result.rows, expandedAll, true);
  });

  bench('all collapsed', () => {
    flattenPivotRows(result.rows, expandedNone, false);
  });
});

// #endregion

// #region sortPivotMulti

describe('sortPivotMulti', () => {
  const rows10K = generateRows(10_000);
  const valueFields: PivotValueField[] = [{ field: 'revenue', aggFunc: 'sum' }];
  const config: PivotConfig = {
    rowGroupFields: ['department', 'region'],
    columnGroupFields: ['quarter'],
    valueFields,
  };

  bench('sort by label asc', () => {
    const result = buildPivot(rows10K, config);
    sortPivotMulti(result.rows, [{ by: 'label', direction: 'asc' }], valueFields);
  });

  bench('sort by value desc', () => {
    const result = buildPivot(rows10K, config);
    sortPivotMulti(result.rows, [{ by: 'value', direction: 'desc' }], valueFields);
  });
});

// #endregion
