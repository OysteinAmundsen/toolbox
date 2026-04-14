/**
 * Render Pipeline Benchmarks
 *
 * Measures the combined cost of operations that the render scheduler
 * executes per flush cycle: sorting → processRows plugins → processColumns
 * plugins → virtualization. This catches regressions from plugin
 * composition overhead that per-function benchmarks miss.
 */

import { randomInt } from 'node:crypto';
import { bench, describe } from 'vitest';
import {
  computeColumnOffsets,
  getColumnWidths,
  getVisibleColumnRange,
} from '../../plugins/column-virtualization/column-virtualization';
import { filterRows } from '../../plugins/filtering/filter-model';
import type { FilterModel } from '../../plugins/filtering/types';
import { buildGroupedRowModel } from '../../plugins/grouping-rows/grouping-rows';
import { reorderColumnsForPinning } from '../../plugins/pinned-columns/pinned-columns';
import { buildPivot, flattenPivotRows, getAllGroupKeys } from '../../plugins/pivot/pivot-engine';
import { expandAll, flattenTree } from '../../plugins/tree/tree-data';
import type { TreeConfig } from '../../plugins/tree/types';
import type { ColumnConfig, SortState } from '../types';
import { inferColumns } from './inference';
import { builtInSort } from './sorting';
import { computeVirtualWindow, createHeightCache, rebuildPositionCache } from './virtualization';

// #region Data Generators

function generateRows(count: number) {
  const departments = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'];
  const teams = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];
  const rows: Record<string, unknown>[] = [];

  for (let i = 0; i < count; i++) {
    rows.push({
      id: i,
      name: `Employee ${i}`,
      department: departments[i % departments.length],
      team: teams[i % teams.length],
      salary: randomInt(30_000, 200_001),
      active: i % 3 !== 0,
    });
  }
  return rows;
}

function generateColumns(count: number): ColumnConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    field: `col${i}`,
    header: `Column ${i}`,
    width: 80 + (i % 5) * 20,
    pinned: i === 0 ? ('left' as const) : i === count - 1 ? ('right' as const) : undefined,
  })) as ColumnConfig[];
}

const SORT_ASC: SortState = { field: 'salary', direction: 1 };
const SALARY_COL: ColumnConfig[] = [{ field: 'salary', header: 'Salary', type: 'number' }] as ColumnConfig[];

function generateTreeData(totalNodes: number, depth: number): Record<string, unknown>[] {
  let id = 0;
  function buildLevel(d: number, budget: number): Record<string, unknown>[] {
    const nodes: Record<string, unknown>[] = [];
    const count = Math.min(5, budget);
    for (let i = 0; i < count && id < totalNodes; i++) {
      const node: Record<string, unknown> = {
        id: id++,
        name: `Node ${id}`,
        department: ['Engineering', 'Sales', 'Marketing'][id % 3],
        value: randomInt(0, 10_001),
      };
      if (d < depth - 1) {
        node.children = buildLevel(d + 1, Math.floor((budget - id) / (count - i)));
      }
      nodes.push(node);
    }
    return nodes;
  }
  return buildLevel(0, totalNodes);
}

// #endregion

// #region Sort → Filter → Virtualization pipeline

describe('pipeline: sort → filter → virtualization (10K rows)', () => {
  const rows = generateRows(10_000);
  const filter: FilterModel[] = [{ field: 'salary', type: 'number', operator: 'greaterThan', value: 100_000 }];

  bench('sort only', () => {
    builtInSort([...rows], SORT_ASC, SALARY_COL);
  });

  bench('filter only', () => {
    filterRows(rows, filter);
  });

  bench('sort + filter', () => {
    const sorted = builtInSort([...rows], SORT_ASC, SALARY_COL);
    filterRows(sorted, filter);
  });

  bench('sort + filter + position cache', () => {
    const sorted = builtInSort([...rows], SORT_ASC, SALARY_COL);
    const filtered = filterRows(sorted, filter);
    rebuildPositionCache(filtered, createHeightCache(), 40, {});
  });

  bench('sort + filter + position cache + virtual window', () => {
    const sorted = builtInSort([...rows], SORT_ASC, SALARY_COL);
    const filtered = filterRows(sorted, filter);
    rebuildPositionCache(filtered, createHeightCache(), 40, {});
    computeVirtualWindow({
      totalRows: filtered.length,
      viewportHeight: 600,
      scrollTop: 1000,
      rowHeight: 40,
      overscan: 5,
    });
  });
});

// #endregion

// #region Sort → Grouping → Virtualization pipeline

describe('pipeline: sort → grouping → virtualization (10K rows)', () => {
  const rows = generateRows(10_000);

  bench('sort + group (2 levels)', () => {
    const sorted = builtInSort([...rows], SORT_ASC, SALARY_COL);
    buildGroupedRowModel({
      rows: sorted,
      config: { groupOn: (row: Record<string, unknown>) => [row['department'], row['team']] },
      expanded: new Set(),
    });
  });

  bench('sort + group + position cache', () => {
    const sorted = builtInSort([...rows], SORT_ASC, SALARY_COL);
    const grouped = buildGroupedRowModel({
      rows: sorted,
      config: { groupOn: (row: Record<string, unknown>) => [row['department'], row['team']] },
      expanded: new Set(['Engineering', 'Sales']),
    });
    rebuildPositionCache(grouped, createHeightCache(), 40, {});
  });
});

// #endregion

// #region Tree flatten → Virtualization pipeline

describe('pipeline: tree flatten → virtualization (10K nodes)', () => {
  const treeData = generateTreeData(10_000, 4);
  const config: TreeConfig = { childrenField: 'children' };
  const expanded = expandAll(treeData, config);

  bench('flatten + position cache', () => {
    const flat = flattenTree(treeData, config, expanded);
    rebuildPositionCache(flat, createHeightCache(), 40, {});
  });
});

// #endregion

// #region Pivot → Flatten → Virtualization pipeline

describe('pipeline: pivot → flatten → virtualization (10K rows)', () => {
  const rows = generateRows(10_000);
  const pivotConfig = {
    rowGroupFields: ['department', 'team'],
    columnGroupFields: ['active'],
    valueFields: [{ field: 'salary', aggFunc: 'sum' as const }],
  };

  bench('build pivot + flatten + position cache', () => {
    const result = buildPivot(rows, pivotConfig);
    const allKeys = getAllGroupKeys(result.rows);
    const flat = flattenPivotRows(result.rows, new Set(allKeys), true);
    rebuildPositionCache(flat, createHeightCache(), 40, {});
  });
});

// #endregion

// #region Column pipeline: pinning + column-virtualization

describe('pipeline: column pinning → column-virtualization (200 columns)', () => {
  const cols = generateColumns(200);

  bench('reorder + offsets + visible range', () => {
    const reordered = reorderColumnsForPinning(cols);
    const offsets = computeColumnOffsets(reordered);
    const widths = getColumnWidths(reordered);
    getVisibleColumnRange(3000, 1280, offsets, widths, 3);
  });
});

// #endregion

// #region Full pipeline: inferColumns → sort → filter → virtualization

describe('pipeline: infer + sort + filter + virtualization (10K rows × 20 cols)', () => {
  const rows = generateRows(10_000);
  // Add extra fields for wider column inference
  for (const row of rows) {
    for (let c = 0; c < 15; c++) {
      row[`extra${c}`] = randomInt(0, 1001);
    }
  }
  const filter: FilterModel[] = [{ field: 'salary', type: 'number', operator: 'greaterThan', value: 100_000 }];

  bench('infer + sort + filter + position cache', () => {
    inferColumns(rows);
    const sorted = builtInSort([...rows], SORT_ASC, SALARY_COL);
    const filtered = filterRows(sorted, filter);
    rebuildPositionCache(filtered, createHeightCache(), 40, {});
  });
});

// #endregion
