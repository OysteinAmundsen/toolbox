/**
 * Row Grouping Plugin Tests
 */
import { describe, expect, it } from 'vitest';
import {
  buildGroupedRowModel,
  buildPreDefinedGroupModel,
  collapseAllGroups,
  expandAllGroups,
  getGroupKeys,
  getGroupPath,
  getGroupRowCount,
  resolveDefaultExpanded,
  resolveGroupFields,
  toggleGroupExpansion,
} from './grouping-rows';
import type { GroupDefinition, GroupingRowsConfig, RenderRow } from './types';

describe('row-grouping (buildGroupedRowModel)', () => {
  it('returns empty when groupOn not provided', () => {
    const config: GroupingRowsConfig = {};
    const res = buildGroupedRowModel({ rows: [{ a: 1 }, { a: 2 }], config, expanded: new Set() });
    expect(res).toEqual([]);
  });

  it('returns empty when all rows are ungrouped', () => {
    const rows = [{ a: 1 }, { a: 2 }];
    const config: GroupingRowsConfig = {
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
    const config: GroupingRowsConfig = {
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
    const config: GroupingRowsConfig = {
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
    const config: GroupingRowsConfig = {
      groupOn: (r) => [r.dept, r.team],
    };
    const result = buildGroupedRowModel({ rows, config, expanded: new Set() });

    // Top-level group only (not expanded)
    expect(result.length).toBe(1);
    expect((result[0] as any).key).toBe('Eng');
    expect((result[0] as any).depth).toBe(0);
  });

  it('top-level group rows include all descendant data rows', () => {
    const rows = [
      { name: 'Alice', country: 'US', org: 'Eng' },
      { name: 'Bob', country: 'US', org: 'Eng' },
      { name: 'Carol', country: 'US', org: 'Sales' },
      { name: 'Dave', country: 'UK', org: 'Eng' },
    ];
    const config: GroupingRowsConfig = {
      groupOn: (r) => [r.country, r.org],
    };
    const result = buildGroupedRowModel({ rows, config, expanded: new Set() });

    // Two top-level groups: UK and US (sorted alphabetically by group value)
    expect(result.length).toBe(2);
    const ukGroup = result[0] as any;
    const usGroup = result[1] as any;
    expect(ukGroup.key).toBe('UK');
    expect(ukGroup.rows.length).toBe(1); // Dave
    expect(usGroup.key).toBe('US');
    expect(usGroup.rows.length).toBe(3); // Alice, Bob, Carol
  });

  it('nested group rows include only their own subtree rows', () => {
    const rows = [
      { name: 'Alice', country: 'US', org: 'Eng' },
      { name: 'Bob', country: 'US', org: 'Eng' },
      { name: 'Carol', country: 'US', org: 'Sales' },
    ];
    const config: GroupingRowsConfig = {
      groupOn: (r) => [r.country, r.org],
    };
    const expanded = new Set(['US']);
    const result = buildGroupedRowModel({ rows, config, expanded });

    // US group + 2 nested groups (Eng, Sales)
    expect(result.length).toBe(3);
    const usGroup = result[0] as any;
    const engGroup = result[1] as any;
    const salesGroup = result[2] as any;
    expect(usGroup.rows.length).toBe(3); // all US rows
    expect(engGroup.rows.length).toBe(2); // Alice, Bob
    expect(salesGroup.rows.length).toBe(1); // Carol
  });

  it('shows nested groups when parent expanded', () => {
    const rows = [
      { name: 'Alice', dept: 'Eng', team: 'Frontend' },
      { name: 'Bob', dept: 'Eng', team: 'Backend' },
    ];
    const config: GroupingRowsConfig = {
      groupOn: (r) => [r.dept, r.team],
    };
    const expanded = new Set(['Eng']);
    const result = buildGroupedRowModel({ rows, config, expanded });

    expect(result.length).toBe(3); // Eng group + 2 nested groups (sorted alphabetically)
    expect((result[0] as any).key).toBe('Eng');
    expect((result[1] as any).key).toBe('Eng||Backend');
    expect((result[1] as any).depth).toBe(1);
    expect((result[2] as any).key).toBe('Eng||Frontend');
  });

  it('handles null values in group path', () => {
    const rows = [
      { name: 'Alice', dept: null },
      { name: 'Bob', dept: 'Sales' },
    ];
    const config: GroupingRowsConfig = {
      groupOn: (r) => r.dept ?? '∅', // Explicit null handling in groupOn
    };
    const result = buildGroupedRowModel({ rows, config, expanded: new Set() });

    // Groups sorted alphabetically: 'Sales' < '∅' (char code 8709)
    expect(result.length).toBe(2);
    expect((result[0] as any).key).toBe('Sales');
    expect((result[1] as any).key).toBe('∅');
  });

  it('expands all groups when initialExpanded contains all keys', () => {
    const rows = [
      { name: 'Alice', dept: 'Engineering' },
      { name: 'Bob', dept: 'Engineering' },
      { name: 'Carol', dept: 'Sales' },
    ];
    const config: GroupingRowsConfig = {
      groupOn: (r) => r.dept,
    };
    // Build first to get all keys, then pass them as initialExpanded
    const initialBuild = buildGroupedRowModel({ rows, config, expanded: new Set() });
    const allKeys = getGroupKeys(initialBuild);
    const result = buildGroupedRowModel({
      rows,
      config,
      expanded: new Set(),
      initialExpanded: new Set(allKeys),
    });

    // Should have 2 groups + 3 data rows = 5 items
    expect(result.length).toBe(5);
    expect(result[0].kind).toBe('group');
    expect((result[0] as any).expanded).toBe(true);
    expect(result[1].kind).toBe('data');
    expect(result[2].kind).toBe('data');
    expect(result[3].kind).toBe('group');
    expect((result[3] as any).expanded).toBe(true);
    expect(result[4].kind).toBe('data');
  });

  it('initialExpanded expands nested groups', () => {
    const rows = [
      { name: 'Alice', dept: 'Eng', team: 'Frontend' },
      { name: 'Bob', dept: 'Eng', team: 'Backend' },
    ];
    const config: GroupingRowsConfig = {
      groupOn: (r) => [r.dept, r.team],
    };

    // For nested groups, we need to iteratively expand to discover all keys
    // First build sees only top-level groups
    let expanded = new Set<string>();
    let result = buildGroupedRowModel({ rows, config, expanded });
    expanded = expandAllGroups(result);

    // Second build with top-level expanded reveals nested groups
    result = buildGroupedRowModel({ rows, config, expanded });
    expanded = expandAllGroups(result);

    // Now we have all keys - build final result
    result = buildGroupedRowModel({ rows, config, expanded });

    // Should have: Eng group, Backend group, Bob, Frontend group, Alice = 5 items
    // (nested groups sorted alphabetically: Backend < Frontend)
    expect(result.length).toBe(5);
    expect((result[0] as any).key).toBe('Eng');
    expect((result[0] as any).expanded).toBe(true);
    expect((result[1] as any).key).toBe('Eng||Backend');
    expect((result[1] as any).expanded).toBe(true);
    expect(result[2].kind).toBe('data');
    expect((result[3] as any).key).toBe('Eng||Frontend');
    expect((result[3] as any).expanded).toBe(true);
    expect(result[4].kind).toBe('data');
  });

  it('sorts groups alphabetically regardless of data row input order', () => {
    // Simulate a data-level sort by name (descending) which puts "Zara" first.
    // Without group sorting, the "Sales" group (containing Zara) would appear
    // before "Engineering" because Zara is encountered first in the input.
    const rows = [
      { name: 'Zara', dept: 'Sales' },
      { name: 'Bob', dept: 'Engineering' },
      { name: 'Alice', dept: 'Engineering' },
      { name: 'Carol', dept: 'Sales' },
    ];
    const config: GroupingRowsConfig = {
      groupOn: (r) => r.dept,
    };
    const result = buildGroupedRowModel({ rows, config, expanded: new Set(['Engineering', 'Sales']) });

    // Groups should be alphabetical: Engineering before Sales
    expect(result[0].kind).toBe('group');
    expect((result[0] as any).key).toBe('Engineering');
    expect(result[1].kind).toBe('data');
    expect((result[1] as any).row.name).toBe('Bob');
    expect(result[2].kind).toBe('data');
    expect((result[2] as any).row.name).toBe('Alice');
    expect(result[3].kind).toBe('group');
    expect((result[3] as any).key).toBe('Sales');
    expect(result[4].kind).toBe('data');
    expect((result[4] as any).row.name).toBe('Zara');
    expect(result[5].kind).toBe('data');
    expect((result[5] as any).row.name).toBe('Carol');
  });

  it('preserves data row order within groups from input', () => {
    // Data rows within each group should maintain their input order
    // (which is the pre-sorted order from the pipeline)
    const rows = [
      { name: 'Charlie', dept: 'B-Team' },
      { name: 'Alice', dept: 'A-Team' },
      { name: 'Bob', dept: 'A-Team' },
    ];
    const config: GroupingRowsConfig = {
      groupOn: (r) => r.dept,
    };
    const result = buildGroupedRowModel({ rows, config, expanded: new Set(['A-Team', 'B-Team']) });

    // A-Team before B-Team (alphabetical groups)
    expect((result[0] as any).key).toBe('A-Team');
    // Data rows within A-Team preserve input order: Alice then Bob
    expect((result[1] as any).row.name).toBe('Alice');
    expect((result[2] as any).row.name).toBe('Bob');
    expect((result[3] as any).key).toBe('B-Team');
    expect((result[4] as any).row.name).toBe('Charlie');
  });

  it('respects descending sort direction for group depth', () => {
    const rows = [
      { name: 'Alice', dept: 'Engineering' },
      { name: 'Bob', dept: 'Sales' },
      { name: 'Carol', dept: 'Engineering' },
    ];
    const config: GroupingRowsConfig = {
      groupOn: (r) => r.dept,
    };
    // Sort depth 0 descending (Z→A)
    const directions = new Map([[0, -1 as 1 | -1]]);
    const result = buildGroupedRowModel({
      rows,
      config,
      expanded: new Set(['Engineering', 'Sales']),
      groupSortDirections: directions,
    });

    // Sales before Engineering because descending
    expect((result[0] as any).key).toBe('Sales');
    expect((result[1] as any).row.name).toBe('Bob');
    expect((result[2] as any).key).toBe('Engineering');
    expect((result[3] as any).row.name).toBe('Alice');
    expect((result[4] as any).row.name).toBe('Carol');
  });

  it('applies different sort directions per depth level', () => {
    const rows = [
      { name: 'Alice', country: 'Germany', dept: 'Engineering' },
      { name: 'Bob', country: 'Germany', dept: 'Sales' },
      { name: 'Carol', country: 'France', dept: 'Sales' },
      { name: 'Dave', country: 'France', dept: 'Engineering' },
    ];
    const config: GroupingRowsConfig = {
      groupOn: (r) => [r.country, r.dept],
    };
    // Depth 0 (country) descending, depth 1 (dept) ascending
    const directions = new Map<number, 1 | -1>([
      [0, -1],
      [1, 1],
    ]);
    const result = buildGroupedRowModel({
      rows,
      config,
      expanded: new Set(['Germany', 'France', 'Germany||Engineering', 'Germany||Sales', 'France||Engineering', 'France||Sales']),
      groupSortDirections: directions,
    });

    // Country descending: Germany first, then France
    const topGroups = result.filter((r) => r.kind === 'group' && (r as any).depth === 0);
    expect(topGroups.length).toBe(2);
    expect((topGroups[0] as any).key).toBe('Germany');
    expect((topGroups[1] as any).key).toBe('France');

    // Within each country, dept ascending: Engineering before Sales
    const germanySubgroups = result.filter((r) => r.kind === 'group' && (r as any).depth === 1 && (r as any).key.startsWith('Germany'));
    expect((germanySubgroups[0] as any).key).toBe('Germany||Engineering');
    expect((germanySubgroups[1] as any).key).toBe('Germany||Sales');
  });
});

describe('resolveGroupFields', () => {
  it('maps single-value groupOn to the matching column field', () => {
    const rows = [{ name: 'Alice', dept: 'Engineering' }];
    const result = resolveGroupFields(rows, (r) => r.dept, ['name', 'dept']);
    expect(result.get(0)).toBe('dept');
    expect(result.size).toBe(1);
  });

  it('maps multi-level groupOn to matching column fields', () => {
    const rows = [{ name: 'Alice', country: 'Germany', dept: 'Engineering' }];
    const result = resolveGroupFields(rows, (r) => [r.country, r.dept], ['name', 'country', 'dept']);
    expect(result.get(0)).toBe('country');
    expect(result.get(1)).toBe('dept');
    expect(result.size).toBe(2);
  });

  it('returns empty map when rows are empty', () => {
    const result = resolveGroupFields([], (r) => r.dept, ['dept']);
    expect(result.size).toBe(0);
  });

  it('returns empty map when groupOn returns null', () => {
    const rows = [{ name: 'Alice' }];
    const result = resolveGroupFields(rows, () => null, ['name']);
    expect(result.size).toBe(0);
  });

  it('skips depths that do not match any column field', () => {
    const rows = [{ name: 'Alice', dept: 'Engineering' }];
    // Computed value that doesn't match any column
    const result = resolveGroupFields(rows, (r) => [r.dept.toUpperCase(), r.dept], ['name', 'dept']);
    expect(result.has(0)).toBe(false); // 'ENGINEERING' doesn't match any field value
    expect(result.get(1)).toBe('dept');
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

describe('resolveDefaultExpanded', () => {
  const allKeys = ['Engineering', 'Sales', 'Marketing'];

  it('returns all keys when value is true', () => {
    const result = resolveDefaultExpanded(true, allKeys);
    expect(result).toEqual(new Set(allKeys));
  });

  it('returns empty set when value is false', () => {
    const result = resolveDefaultExpanded(false, allKeys);
    expect(result).toEqual(new Set());
  });

  it('returns empty set when value is undefined', () => {
    const result = resolveDefaultExpanded(undefined as any, allKeys);
    expect(result).toEqual(new Set());
  });

  it('returns single key by index', () => {
    const result = resolveDefaultExpanded(1, allKeys);
    expect(result).toEqual(new Set(['Sales']));
  });

  it('returns empty set for out-of-bounds index', () => {
    const result = resolveDefaultExpanded(10, allKeys);
    expect(result).toEqual(new Set());
  });

  it('returns single key by string', () => {
    const result = resolveDefaultExpanded('Engineering', allKeys);
    expect(result).toEqual(new Set(['Engineering']));
  });

  it('returns multiple keys by array', () => {
    const result = resolveDefaultExpanded(['Engineering', 'Marketing'], allKeys);
    expect(result).toEqual(new Set(['Engineering', 'Marketing']));
  });

  it('returns empty set for empty array', () => {
    const result = resolveDefaultExpanded([], allKeys);
    expect(result).toEqual(new Set());
  });
});

describe('buildPreDefinedGroupModel', () => {
  const groups: GroupDefinition[] = [
    { key: 'Engineering', value: 'Engineering', rowCount: 150 },
    { key: 'Sales', value: 'Sales', rowCount: 89 },
    { key: 'Marketing', value: 'Marketing', rowCount: 42 },
  ];

  it('builds flattened model with collapsed groups', () => {
    const result = buildPreDefinedGroupModel({
      groups,
      expanded: new Set(),
      groupRows: new Map(),
      loadingGroups: new Set(),
    });

    expect(result.length).toBe(3);
    expect(result[0]).toEqual({
      kind: 'group',
      key: 'Engineering',
      value: 'Engineering',
      depth: 0,
      rows: [],
      expanded: false,
    });
    expect(result[1]).toEqual({ kind: 'group', key: 'Sales', value: 'Sales', depth: 0, rows: [], expanded: false });
    expect(result[2]).toEqual({
      kind: 'group',
      key: 'Marketing',
      value: 'Marketing',
      depth: 0,
      rows: [],
      expanded: false,
    });
  });

  it('shows row data when group is expanded and rows are loaded', () => {
    const engRows = [{ name: 'Alice' }, { name: 'Bob' }];
    const groupRowsMap = new Map([['Engineering', engRows]]);

    const result = buildPreDefinedGroupModel({
      groups,
      expanded: new Set(['Engineering']),
      groupRows: groupRowsMap,
      loadingGroups: new Set(),
    });

    expect(result.length).toBe(5); // 3 groups + 2 data rows
    expect(result[0].kind).toBe('group');
    expect((result[0] as any).expanded).toBe(true);
    expect(result[1].kind).toBe('data');
    expect((result[1] as any).row.name).toBe('Alice');
    expect(result[2].kind).toBe('data');
    expect((result[2] as any).row.name).toBe('Bob');
  });

  it('shows loading placeholder when group is expanded and loading', () => {
    const result = buildPreDefinedGroupModel({
      groups,
      expanded: new Set(['Engineering']),
      groupRows: new Map(),
      loadingGroups: new Set(['Engineering']),
    });

    expect(result.length).toBe(4); // 3 groups + 1 loading placeholder
    expect(result[1].kind).toBe('data');
    expect((result[1] as any).row.__loading).toBe(true);
    expect((result[1] as any).row.__groupKey).toBe('Engineering');
  });

  it('shows no child rows when expanded but no rows and not loading', () => {
    const result = buildPreDefinedGroupModel({
      groups,
      expanded: new Set(['Engineering']),
      groupRows: new Map(),
      loadingGroups: new Set(),
    });

    // Expanded with no rows and not loading = empty expansion (no children)
    expect(result.length).toBe(3); // Just the 3 groups, Engineering expanded but empty
  });

  it('handles nested group definitions', () => {
    const nestedGroups: GroupDefinition[] = [
      {
        key: 'US',
        value: 'United States',
        children: [
          { key: 'US-Eng', value: 'Engineering', rowCount: 100 },
          { key: 'US-Sales', value: 'Sales', rowCount: 50 },
        ],
      },
      { key: 'UK', value: 'United Kingdom', rowCount: 30 },
    ];

    const result = buildPreDefinedGroupModel({
      groups: nestedGroups,
      expanded: new Set(['US']),
      groupRows: new Map(),
      loadingGroups: new Set(),
    });

    expect(result.length).toBe(4); // US group + 2 child groups + UK group
    expect(result[0].kind).toBe('group');
    expect((result[0] as any).key).toBe('US');
    expect((result[0] as any).depth).toBe(0);
    expect(result[1].kind).toBe('group');
    expect((result[1] as any).key).toBe('US-Eng');
    expect((result[1] as any).depth).toBe(1);
    expect(result[2].kind).toBe('group');
    expect((result[2] as any).key).toBe('US-Sales');
    expect((result[2] as any).depth).toBe(1);
    expect(result[3].kind).toBe('group');
    expect((result[3] as any).key).toBe('UK');
  });

  it('handles deeply nested expansion', () => {
    const nestedGroups: GroupDefinition[] = [
      {
        key: 'US',
        value: 'US',
        children: [{ key: 'US-Eng', value: 'Engineering', rowCount: 5 }],
      },
    ];

    const engRows = [{ name: 'Alice' }];
    const result = buildPreDefinedGroupModel({
      groups: nestedGroups,
      expanded: new Set(['US', 'US-Eng']),
      groupRows: new Map([['US-Eng', engRows]]),
      loadingGroups: new Set(),
    });

    expect(result.length).toBe(3); // US group + US-Eng group + Alice data row
    expect(result[0].kind).toBe('group');
    expect(result[1].kind).toBe('group');
    expect(result[2].kind).toBe('data');
    expect((result[2] as any).row.name).toBe('Alice');
  });

  it('returns empty array for empty groups', () => {
    const result = buildPreDefinedGroupModel({
      groups: [],
      expanded: new Set(),
      groupRows: new Map(),
      loadingGroups: new Set(),
    });
    expect(result).toEqual([]);
  });
});

describe('getGroupPath', () => {
  const groups: GroupDefinition[] = [
    {
      key: 'US',
      value: 'US',
      children: [
        { key: 'US-Eng', value: 'Engineering' },
        { key: 'US-Sales', value: 'Sales' },
      ],
    },
    { key: 'UK', value: 'UK' },
  ];

  it('returns path for top-level group', () => {
    expect(getGroupPath(groups, 'US')).toEqual(['US']);
    expect(getGroupPath(groups, 'UK')).toEqual(['UK']);
  });

  it('returns full path for nested group', () => {
    expect(getGroupPath(groups, 'US-Eng')).toEqual(['US', 'US-Eng']);
    expect(getGroupPath(groups, 'US-Sales')).toEqual(['US', 'US-Sales']);
  });

  it('returns empty array for non-existent key', () => {
    expect(getGroupPath(groups, 'nonexistent')).toEqual([]);
  });

  it('returns empty array for empty groups', () => {
    expect(getGroupPath([], 'anything')).toEqual([]);
  });
});
