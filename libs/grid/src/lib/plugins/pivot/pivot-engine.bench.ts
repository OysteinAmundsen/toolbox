import { bench, describe } from 'vitest';
import { buildPivot, flattenPivotRows, getAllGroupKeys, sortPivotMulti } from './pivot-engine';
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
      revenue: 1000 + Math.round(Math.random() * 99_000),
      cost: 500 + Math.round(Math.random() * 49_000),
      units: Math.round(Math.random() * 1000),
    });
  }
  return rows;
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
