/**
 * Row Grouping Plugin Tests
 */
import { describe, expect, it } from 'vitest';
import {
  buildGroupedRowModel,
  collapseAllGroups,
  expandAllGroups,
  getGroupKeys,
  getGroupRowCount,
  toggleGroupExpansion,
} from './grouping-rows';
import type { RenderRow, RowGroupingConfig } from './types';

describe('row-grouping (buildGroupedRowModel)', () => {
  it('returns empty when groupOn not provided', () => {
    const config: RowGroupingConfig = { enabled: true };
    const res = buildGroupedRowModel({ rows: [{ a: 1 }, { a: 2 }], config, expanded: new Set() });
    expect(res).toEqual([]);
  });

  it('returns empty when enabled is false', () => {
    const config: RowGroupingConfig = {
      enabled: false,
      groupOn: (r) => r.category,
    };
    const res = buildGroupedRowModel({ rows: [{ category: 'A' }], config, expanded: new Set() });
    expect(res).toEqual([]);
  });

  it('returns empty when all rows are ungrouped', () => {
    const rows = [{ a: 1 }, { a: 2 }];
    const config: RowGroupingConfig = {
      enabled: true,
      groupOn: () => null,
    };
    expect(buildGroupedRowModel({ rows, config, expanded: new Set() })).toEqual([]);
  });

  it('builds basic group structure', () => {
    const rows = [
      { name: 'Alice', dept: 'Engineering' },
      { name: 'Bob', dept: 'Engineering' },
      { name: 'Carol', dept: 'Sales' },
    ];
    const config: RowGroupingConfig = {
      enabled: true,
      groupOn: (r) => r.dept,
    };
    const result = buildGroupedRowModel({ rows, config, expanded: new Set() });

    expect(result.length).toBe(2);
    expect(result[0].kind).toBe('group');
    expect((result[0] as any).key).toBe('Engineering');
    expect((result[0] as any).rows.length).toBe(2);
    expect(result[1].kind).toBe('group');
    expect((result[1] as any).key).toBe('Sales');
  });

  it('expands groups when key in expanded set', () => {
    const rows = [
      { name: 'Alice', dept: 'Engineering' },
      { name: 'Bob', dept: 'Sales' },
    ];
    const config: RowGroupingConfig = {
      enabled: true,
      groupOn: (r) => r.dept,
    };
    const expanded = new Set(['Engineering']);
    const result = buildGroupedRowModel({ rows, config, expanded });

    expect(result.length).toBe(3); // 2 groups + 1 data row (Alice in expanded Engineering)
    expect(result[0].kind).toBe('group');
    expect((result[0] as any).expanded).toBe(true);
    expect(result[1].kind).toBe('data');
    expect((result[1] as any).row.name).toBe('Alice');
    expect(result[2].kind).toBe('group');
    expect((result[2] as any).expanded).toBe(false);
  });

  it('handles multi-level grouping', () => {
    const rows = [
      { name: 'Alice', dept: 'Eng', team: 'Frontend' },
      { name: 'Bob', dept: 'Eng', team: 'Backend' },
    ];
    const config: RowGroupingConfig = {
      enabled: true,
      groupOn: (r) => [r.dept, r.team],
    };
    const result = buildGroupedRowModel({ rows, config, expanded: new Set() });

    // Top-level group only (not expanded)
    expect(result.length).toBe(1);
    expect((result[0] as any).key).toBe('Eng');
    expect((result[0] as any).depth).toBe(0);
  });

  it('shows nested groups when parent expanded', () => {
    const rows = [
      { name: 'Alice', dept: 'Eng', team: 'Frontend' },
      { name: 'Bob', dept: 'Eng', team: 'Backend' },
    ];
    const config: RowGroupingConfig = {
      enabled: true,
      groupOn: (r) => [r.dept, r.team],
    };
    const expanded = new Set(['Eng']);
    const result = buildGroupedRowModel({ rows, config, expanded });

    expect(result.length).toBe(3); // Eng group + 2 nested groups
    expect((result[0] as any).key).toBe('Eng');
    expect((result[1] as any).key).toBe('Eng||Frontend');
    expect((result[1] as any).depth).toBe(1);
    expect((result[2] as any).key).toBe('Eng||Backend');
  });

  it('handles null values in group path', () => {
    const rows = [
      { name: 'Alice', dept: null },
      { name: 'Bob', dept: 'Sales' },
    ];
    const config: RowGroupingConfig = {
      enabled: true,
      groupOn: (r) => r.dept ?? '∅', // Explicit null handling in groupOn
    };
    const result = buildGroupedRowModel({ rows, config, expanded: new Set() });

    expect(result.length).toBe(2);
    expect((result[0] as any).key).toBe('∅');
    expect((result[1] as any).key).toBe('Sales');
  });
});

describe('toggleGroupExpansion', () => {
  it('adds key when not present', () => {
    const keys = new Set(['A']);
    const result = toggleGroupExpansion(keys, 'B');
    expect(result.has('B')).toBe(true);
    expect(result.has('A')).toBe(true);
  });

  it('removes key when present', () => {
    const keys = new Set(['A', 'B']);
    const result = toggleGroupExpansion(keys, 'B');
    expect(result.has('B')).toBe(false);
    expect(result.has('A')).toBe(true);
  });

  it('does not mutate original set', () => {
    const keys = new Set(['A']);
    toggleGroupExpansion(keys, 'B');
    expect(keys.has('B')).toBe(false);
  });
});

describe('expandAllGroups', () => {
  it('returns all group keys', () => {
    const rows: RenderRow[] = [
      { kind: 'group', key: 'A', value: 'A', depth: 0, rows: [], expanded: false },
      { kind: 'data', row: {}, rowIndex: 0 },
      { kind: 'group', key: 'B', value: 'B', depth: 0, rows: [], expanded: false },
    ];
    const result = expandAllGroups(rows);
    expect(result.size).toBe(2);
    expect(result.has('A')).toBe(true);
    expect(result.has('B')).toBe(true);
  });
});

describe('collapseAllGroups', () => {
  it('returns empty set', () => {
    const result = collapseAllGroups();
    expect(result.size).toBe(0);
  });
});

describe('getGroupKeys', () => {
  it('extracts group keys from render rows', () => {
    const rows: RenderRow[] = [
      { kind: 'group', key: 'G1', value: 'G1', depth: 0, rows: [], expanded: false },
      { kind: 'data', row: {}, rowIndex: 0 },
      { kind: 'group', key: 'G2', value: 'G2', depth: 0, rows: [], expanded: false },
    ];
    const keys = getGroupKeys(rows);
    expect(keys).toEqual(['G1', 'G2']);
  });
});

describe('getGroupRowCount', () => {
  it('returns row count for group', () => {
    const group: RenderRow = {
      kind: 'group',
      key: 'A',
      value: 'A',
      depth: 0,
      rows: [{}, {}, {}],
      expanded: false,
    };
    expect(getGroupRowCount(group)).toBe(3);
  });

  it('returns 0 for data row', () => {
    const dataRow: RenderRow = { kind: 'data', row: {}, rowIndex: 0 };
    expect(getGroupRowCount(dataRow)).toBe(0);
  });
});
