import { bench, describe } from 'vitest';
import type { ColumnConfig } from '../../core/types';
import { computeColumnGroups, mergeGroups, resolveColumnGroupDefs } from './grouping-columns';
import type { ColumnGroupDefinition } from './types';

// #region Data Generators

function generateGroupedColumns(count: number, groupCount: number): ColumnConfig[] {
  const columns: ColumnConfig[] = [];
  const colsPerGroup = Math.floor(count / groupCount);

  for (let i = 0; i < count; i++) {
    const groupIdx = Math.floor(i / colsPerGroup);
    const groupId = groupIdx < groupCount ? `group-${groupIdx}` : undefined;
    columns.push({
      field: `col${i}`,
      header: `Column ${i}`,
      width: 120,
      group: groupId ? { id: groupId, label: `Group ${groupIdx}` } : undefined,
    } as ColumnConfig);
  }
  return columns;
}

function generateGroupDefs(count: number): ColumnGroupDefinition[] {
  const defs: ColumnGroupDefinition[] = [];
  for (let i = 0; i < count; i++) {
    defs.push({
      header: `Group ${i}`,
      children: [`col${i * 3}`, `col${i * 3 + 1}`, `col${i * 3 + 2}`],
    });
  }
  return defs;
}

// #endregion

// #region computeColumnGroups

describe('computeColumnGroups', () => {
  const cols10_3groups = generateGroupedColumns(10, 3);
  const cols50_10groups = generateGroupedColumns(50, 10);
  const cols200_20groups = generateGroupedColumns(200, 20);

  bench('10 columns — 3 groups', () => {
    computeColumnGroups(cols10_3groups);
  });

  bench('50 columns — 10 groups', () => {
    computeColumnGroups(cols50_10groups);
  });

  bench('200 columns — 20 groups', () => {
    computeColumnGroups(cols200_20groups);
  });
});

// #endregion

// #region resolveColumnGroupDefs

describe('resolveColumnGroupDefs', () => {
  const defs10 = generateGroupDefs(10);
  const defs50 = generateGroupDefs(50);

  bench('10 group definitions', () => {
    resolveColumnGroupDefs(defs10);
  });

  bench('50 group definitions', () => {
    resolveColumnGroupDefs(defs50);
  });
});

// #endregion

// #region mergeGroups

describe('mergeGroups', () => {
  const cols50_10groups = generateGroupedColumns(50, 10);
  const cols200_20groups = generateGroupedColumns(200, 20);

  const groups50 = computeColumnGroups(cols50_10groups);
  const groups200 = computeColumnGroups(cols200_20groups);

  bench('10 groups', () => {
    mergeGroups(groups50);
  });

  bench('20 groups', () => {
    mergeGroups(groups200);
  });
});

// #endregion
