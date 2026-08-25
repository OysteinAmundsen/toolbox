/**
 * Column Groups Plugin Unit Tests
 *
 * Tests for pure functions in the grouping-columns module.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyGroupedHeaderCellClasses,
  buildGroupHeaderRow,
  computeColumnGroups,
  findEmbeddedImplicitGroups,
  getColumnGroupId,
  hasColumnGroups,
  mergeAdjacentSameIdGroups,
  resolveColumnGroupDefs,
  slugifyHeader,
} from './grouping-columns';
import type { ColumnGroup } from './types';

describe('computeColumnGroups', () => {
  it('returns empty for no columns', () => {
    expect(computeColumnGroups([])).toEqual([]);
  });

  it('returns empty for single implicit group covering all columns', () => {
    const cols = [
      { field: 'a', header: 'A' },
      { field: 'b', header: 'B' },
      { field: 'c', header: 'C' },
    ];
    expect(computeColumnGroups(cols)).toEqual([]);
  });

  it('creates explicit groups from column config', () => {
    const cols = [
      { field: 'a', header: 'A', group: 'Group1' },
      { field: 'b', header: 'B', group: 'Group1' },
      { field: 'c', header: 'C', group: 'Group2' },
    ];
    const groups = computeColumnGroups(cols);

    expect(groups.length).toBe(2);
    expect(groups[0].id).toBe('Group1');
    expect(groups[0].columns.length).toBe(2);
    expect(groups[1].id).toBe('Group2');
    expect(groups[1].columns.length).toBe(1);
  });

  it('handles group objects with label', () => {
    const cols = [
      { field: 'a', header: 'A', group: { id: 'g1', label: 'First Group' } },
      { field: 'b', header: 'B', group: { id: 'g1', label: 'First Group' } },
    ];
    const groups = computeColumnGroups(cols);

    expect(groups.length).toBe(1);
    expect(groups[0].id).toBe('g1');
    expect(groups[0].label).toBe('First Group');
  });

  it('merges adjacent implicit groups', () => {
    const cols = [
      { field: 'a', header: 'A' },
      { field: 'b', header: 'B' },
      { field: 'c', header: 'C', group: 'G1' },
      { field: 'd', header: 'D' },
      { field: 'e', header: 'E' },
    ];
    const groups = computeColumnGroups(cols);

    // Should have: implicit (a,b) + G1 (c) + implicit (d,e)
    expect(groups.length).toBe(3);
    expect(groups[0].id).toContain('__implicit__');
    expect(groups[0].columns.length).toBe(2);
    expect(groups[1].id).toBe('G1');
    expect(groups[2].id).toContain('__implicit__');
  });

  it('sets correct firstIndex for each group', () => {
    const cols = [
      { field: 'a', header: 'A', group: 'G1' },
      { field: 'b', header: 'B', group: 'G1' },
      { field: 'c', header: 'C', group: 'G2' },
    ];
    const groups = computeColumnGroups(cols);

    expect(groups[0].firstIndex).toBe(0);
    expect(groups[1].firstIndex).toBe(2);
  });

  it('creates fragments when same group id columns are non-contiguous', () => {
    const cols = [
      { field: 'a', header: 'A', group: 'G1' },
      { field: 'b', header: 'B', group: 'G2' },
      { field: 'c', header: 'C', group: 'G1' },
    ];
    const groups = computeColumnGroups(cols);

    // G1_frag1 (a), G2 (b), G1_frag2 (c)
    expect(groups.length).toBe(3);
    expect(groups[0].id).toBe('G1');
    expect(groups[0].columns.length).toBe(1);
    expect(groups[0].columns[0].field).toBe('a');
    expect(groups[1].id).toBe('G2');
    expect(groups[2].id).toBe('G1');
    expect(groups[2].columns.length).toBe(1);
    expect(groups[2].columns[0].field).toBe('c');
  });

  it('creates multiple alternating fragments', () => {
    const cols = [
      { field: 'a', header: 'A', group: { id: 'emp', label: 'Employee' } },
      { field: 'b', header: 'B', group: { id: 'org', label: 'Organization' } },
      { field: 'c', header: 'C', group: { id: 'emp', label: 'Employee' } },
      { field: 'd', header: 'D', group: { id: 'org', label: 'Organization' } },
    ];
    const groups = computeColumnGroups(cols);

    expect(groups.length).toBe(4);
    expect(groups[0].id).toBe('emp');
    expect(groups[0].label).toBe('Employee');
    expect(groups[1].id).toBe('org');
    expect(groups[1].label).toBe('Organization');
    expect(groups[2].id).toBe('emp');
    expect(groups[2].label).toBe('Employee');
    expect(groups[3].id).toBe('org');
    expect(groups[3].label).toBe('Organization');
  });

  it('preserves label across fragments using first-seen label', () => {
    const cols = [
      { field: 'a', header: 'A', group: { id: 'G1', label: 'My Group' } },
      { field: 'b', header: 'B', group: 'G2' },
      { field: 'c', header: 'C', group: 'G1' }, // string shorthand, no label
    ];
    const groups = computeColumnGroups(cols);

    expect(groups[0].label).toBe('My Group');
    expect(groups[2].label).toBe('My Group'); // Should inherit label from first fragment
  });

  it('keeps contiguous same-group columns in one entry', () => {
    const cols = [
      { field: 'a', header: 'A', group: 'G1' },
      { field: 'b', header: 'B', group: 'G1' },
      { field: 'c', header: 'C', group: 'G2' },
      { field: 'd', header: 'D', group: 'G2' },
    ];
    const groups = computeColumnGroups(cols);

    expect(groups.length).toBe(2);
    expect(groups[0].id).toBe('G1');
    expect(groups[0].columns.length).toBe(2);
    expect(groups[1].id).toBe('G2');
    expect(groups[1].columns.length).toBe(2);
  });

  it('creates fragment with implicit group in between', () => {
    const cols = [
      { field: 'a', header: 'A', group: 'G1' },
      { field: 'b', header: 'B' },
      { field: 'c', header: 'C', group: 'G2' },
      { field: 'd', header: 'D', group: 'G1' },
    ];
    const groups = computeColumnGroups(cols);

    // G1_frag1 (a), implicit (b), G2 (c), G1_frag2 (d)
    expect(groups.length).toBe(4);
    expect(groups[0].id).toBe('G1');
    expect(groups[1].id).toContain('__implicit__');
    expect(groups[2].id).toBe('G2');
    expect(groups[3].id).toBe('G1');
  });
});

describe('buildGroupHeaderRow', () => {
  it('returns null for empty groups', () => {
    expect(buildGroupHeaderRow([], [])).toBe(null);
  });

  it('creates group header row with cells', () => {
    const cols = [
      { field: 'a', header: 'A' },
      { field: 'b', header: 'B' },
    ];
    const groups: ColumnGroup[] = [{ id: 'G1', label: 'Group One', columns: cols, firstIndex: 0 }];
    const row = buildGroupHeaderRow(groups, cols);

    expect(row).not.toBe(null);
    expect(row!.className).toBe('header-group-row');
    expect(row!.getAttribute('role')).toBe('row');
    expect(row!.children.length).toBe(1);
    expect(row!.children[0].textContent).toBe('Group One');
  });

  it('uses id as label when label not provided', () => {
    const cols = [{ field: 'a', header: 'A' }];
    const groups: ColumnGroup[] = [{ id: 'MyGroup', columns: cols, firstIndex: 0 }];
    const row = buildGroupHeaderRow(groups, cols);

    expect(row!.children[0].textContent).toBe('MyGroup');
  });

  it('renders empty label for implicit groups', () => {
    const cols = [{ field: 'a', header: 'A' }];
    const groups: ColumnGroup[] = [{ id: '__implicit__0', columns: cols, firstIndex: 0 }];
    const row = buildGroupHeaderRow(groups, cols);

    expect(row!.children[0].textContent).toBe('');
    expect(row!.children[0].classList.contains('implicit-group')).toBe(true);
  });

  it('sets correct gridColumn style', () => {
    const cols = [
      { field: 'a', header: 'A' },
      { field: 'b', header: 'B' },
      { field: 'c', header: 'C' },
    ];
    const groups: ColumnGroup[] = [
      { id: 'G1', columns: [cols[0], cols[1]], firstIndex: 0 },
      { id: 'G2', columns: [cols[2]], firstIndex: 2 },
    ];
    const row = buildGroupHeaderRow(groups, cols);

    expect((row!.children[0] as HTMLElement).style.gridColumn).toBe('1 / span 2');
    expect((row!.children[1] as HTMLElement).style.gridColumn).toBe('3 / span 1');
  });

  it('spans over interleaved utility columns when group members are non-contiguous', () => {
    // Simulates: pinned ticker (group=G1) at 0, checkbox (no group) at 1,
    // company (group=G1) at 2, sector (group=G1) at 3
    const ticker = { field: 'ticker', header: 'Ticker', group: { id: 'G1', label: 'Security' } };
    const checkbox = { field: '__tbw_checkbox', header: '' };
    const company = { field: 'company', header: 'Company', group: { id: 'G1', label: 'Security' } };
    const sector = { field: 'sector', header: 'Sector', group: { id: 'G1', label: 'Security' } };
    const price = { field: 'price', header: 'Price', group: { id: 'G2', label: 'Trading' } };

    const columns = [ticker, checkbox, company, sector, price];
    const groups = computeColumnGroups(columns);

    // computeColumnGroups creates fragments: G1_frag1 (ticker), __implicit__1 (checkbox), G1_frag2 (company, sector), G2 (price)
    expect(groups.length).toBe(4);
    expect(groups[0].id).toBe('G1');
    expect(groups[1].id).toBe('__implicit__1');
    expect(groups[2].id).toBe('G1');
    expect(groups[3].id).toBe('G2');

    const row = buildGroupHeaderRow(groups, columns);
    expect(row).not.toBe(null);

    // Embedded implicit group is absorbed; G1 fragments are merged → 2 cells
    expect(row!.children.length).toBe(2);

    // Merged G1 should span from ticker (0) to sector (3) = 4 columns
    expect((row!.children[0] as HTMLElement).style.gridColumn).toBe('1 / span 4');
    expect(row!.children[0].textContent).toBe('Security');

    // G2 should be at position 5
    expect((row!.children[1] as HTMLElement).style.gridColumn).toBe('5 / span 1');
    expect(row!.children[1].textContent).toBe('Trading');
  });

  it('does not skip implicit groups that are NOT embedded in an explicit group', () => {
    // Ungrouped columns between two different explicit groups
    const a = { field: 'a', header: 'A', group: 'G1' };
    const b = { field: 'b', header: 'B' };
    const c = { field: 'c', header: 'C', group: 'G2' };

    const columns = [a, b, c];
    const groups = computeColumnGroups(columns);

    // G1 (a), implicit (b), G2 (c)
    expect(groups.length).toBe(3);

    const row = buildGroupHeaderRow(groups, columns);
    // All three groups should render (implicit is not embedded)
    expect(row!.children.length).toBe(3);
  });
});

describe('findEmbeddedImplicitGroups', () => {
  it('returns empty set when no implicit groups are embedded', () => {
    const cols = [
      { field: 'a', header: 'A', group: 'G1' },
      { field: 'b', header: 'B' },
      { field: 'c', header: 'C', group: 'G2' },
    ];
    const groups = computeColumnGroups(cols);
    const embedded = findEmbeddedImplicitGroups(groups);
    expect(embedded.size).toBe(0);
  });

  it('detects implicit groups embedded within explicit group range', () => {
    const ticker = { field: 'ticker', header: 'Ticker', group: 'Security' };
    const checkbox = { field: '__tbw_checkbox', header: '' };
    const company = { field: 'company', header: 'Company', group: 'Security' };

    const columns = [ticker, checkbox, company];
    const groups = computeColumnGroups(columns);

    const embedded = findEmbeddedImplicitGroups(groups);
    expect(embedded.size).toBe(1);
    expect(embedded.has('__implicit__1')).toBe(true);
  });

  it('does not embed implicit groups containing regular data columns', () => {
    // A data column (id) sandwiched between two fragments of the same group
    // should NOT be absorbed — the group must fragment around it.
    const cols = [
      { field: 'dept', header: 'Dept', group: 'org' },
      { field: 'id', header: 'ID' }, // regular data column, NOT utility
      { field: 'team', header: 'Team', group: 'org' },
    ];
    const groups = computeColumnGroups(cols);
    const embedded = findEmbeddedImplicitGroups(groups);
    expect(embedded.size).toBe(0);
  });

  it('returns empty set when no groups exist', () => {
    expect(findEmbeddedImplicitGroups([]).size).toBe(0);
  });

  it('does not embed implicit groups between different explicit groups', () => {
    // emp_frag1, implicit(checkbox), org — checkbox is NOT between two same-ID groups
    const cols = [
      { field: 'a', header: 'A', group: 'emp' },
      { field: 'b', header: 'B' }, // ungrouped
      { field: 'c', header: 'C', group: 'org' },
    ];
    const groups = computeColumnGroups(cols);
    const embedded = findEmbeddedImplicitGroups(groups);
    expect(embedded.size).toBe(0);
  });
});

describe('mergeAdjacentSameIdGroups', () => {
  it('merges same-ID fragments separated by embedded implicit groups', () => {
    const cols = [
      { field: 'a', header: 'A', group: 'G1' },
      { field: '__tbw_checkbox', header: '' }, // utility column
      { field: 'c', header: 'C', group: 'G1' },
      { field: 'd', header: 'D', group: 'G2' },
    ];
    const groups = computeColumnGroups(cols);
    const embedded = findEmbeddedImplicitGroups(groups);
    const merged = mergeAdjacentSameIdGroups(groups, embedded);

    expect(merged.length).toBe(2);
    expect(merged[0].id).toBe('G1');
    expect(merged[0].columns.length).toBe(2); // a and c merged
    expect(merged[0].columns[0].field).toBe('a');
    expect(merged[0].columns[1].field).toBe('c');
    expect(merged[1].id).toBe('G2');
  });

  it('does not merge fragments separated by a data column', () => {
    const cols = [
      { field: 'a', header: 'A', group: 'G1' },
      { field: 'id', header: 'ID' }, // regular data column, not utility
      { field: 'c', header: 'C', group: 'G1' },
    ];
    const groups = computeColumnGroups(cols);
    const embedded = findEmbeddedImplicitGroups(groups);
    const merged = mergeAdjacentSameIdGroups(groups, embedded);

    // id is a data column, so the implicit group is NOT embedded
    // G1 fragments remain separate
    expect(merged.length).toBe(3);
    expect(merged[0].id).toBe('G1');
    expect(merged[0].columns.length).toBe(1);
    expect(merged[1].columns[0].field).toBe('id');
    expect(merged[2].id).toBe('G1');
    expect(merged[2].columns.length).toBe(1);
  });

  it('does not merge fragments separated by a different explicit group', () => {
    const cols = [
      { field: 'a', header: 'A', group: 'G1' },
      { field: 'b', header: 'B', group: 'G2' },
      { field: 'c', header: 'C', group: 'G1' },
    ];
    const groups = computeColumnGroups(cols);
    const embedded = findEmbeddedImplicitGroups(groups);
    const merged = mergeAdjacentSameIdGroups(groups, embedded);

    // No merging — G2 separates the two G1 fragments
    expect(merged.length).toBe(3);
    expect(merged[0].id).toBe('G1');
    expect(merged[1].id).toBe('G2');
    expect(merged[2].id).toBe('G1');
  });

  it('returns original groups when no embedded implicits', () => {
    const cols = [
      { field: 'a', header: 'A', group: 'G1' },
      { field: 'b', header: 'B', group: 'G1' },
      { field: 'c', header: 'C', group: 'G2' },
    ];
    const groups = computeColumnGroups(cols);
    const embedded = findEmbeddedImplicitGroups(groups);
    const merged = mergeAdjacentSameIdGroups(groups, embedded);

    expect(merged.length).toBe(2);
    expect(merged[0].id).toBe('G1');
    expect(merged[0].columns.length).toBe(2);
    expect(merged[1].id).toBe('G2');
  });
});

describe('applyGroupedHeaderCellClasses', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.innerHTML = `
      <div class="header-row">
        <div class="cell" data-field="a"></div>
        <div class="cell" data-field="b"></div>
        <div class="cell" data-field="c"></div>
      </div>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('does nothing with empty groups', () => {
    const headerRow = container.querySelector('.header-row') as HTMLElement;
    applyGroupedHeaderCellClasses(headerRow, [], []);
    expect(headerRow.querySelector('.grouped')).toBe(null);
  });

  it('adds grouped class to cells in groups', () => {
    const cols = [
      { field: 'a', header: 'A' },
      { field: 'b', header: 'B' },
      { field: 'c', header: 'C' },
    ];
    const groups: ColumnGroup[] = [{ id: 'G1', columns: [cols[0], cols[1]], firstIndex: 0 }];
    const headerRow = container.querySelector('.header-row') as HTMLElement;
    applyGroupedHeaderCellClasses(headerRow, groups, cols);

    const cellA = headerRow.querySelector('[data-field="a"]');
    const cellB = headerRow.querySelector('[data-field="b"]');
    const cellC = headerRow.querySelector('[data-field="c"]');

    expect(cellA!.classList.contains('grouped')).toBe(true);
    expect(cellB!.classList.contains('grouped')).toBe(true);
    expect(cellC!.classList.contains('grouped')).toBe(false);
  });

  it('marks last cell in group with group-end class', () => {
    const cols = [
      { field: 'a', header: 'A' },
      { field: 'b', header: 'B' },
    ];
    const groups: ColumnGroup[] = [{ id: 'G1', columns: cols, firstIndex: 0 }];
    const headerRow = container.querySelector('.header-row') as HTMLElement;
    applyGroupedHeaderCellClasses(headerRow, groups, cols);

    const cellA = headerRow.querySelector('[data-field="a"]');
    const cellB = headerRow.querySelector('[data-field="b"]');

    expect(cellA!.classList.contains('group-end')).toBe(false);
    expect(cellB!.classList.contains('group-end')).toBe(true);
  });

  it('sets data-group attribute on cells', () => {
    const cols = [{ field: 'a', header: 'A' }];
    const groups: ColumnGroup[] = [{ id: 'TestGroup', columns: cols, firstIndex: 0 }];
    const headerRow = container.querySelector('.header-row') as HTMLElement;
    applyGroupedHeaderCellClasses(headerRow, groups, cols);

    const cellA = headerRow.querySelector('[data-field="a"]');
    expect(cellA!.getAttribute('data-group')).toBe('TestGroup');
  });

  it('does not apply group-end to embedded implicit group cells', () => {
    // Simulate: ticker (G1), checkbox (no group, utility), company (G1)
    container.innerHTML = `
      <div class="header-row">
        <div class="cell" data-field="ticker"></div>
        <div class="cell" data-field="__tbw_checkbox"></div>
        <div class="cell" data-field="company"></div>
      </div>
    `;

    const ticker = { field: 'ticker', header: 'Ticker', group: { id: 'G1', label: 'Security' } };
    const checkbox = { field: '__tbw_checkbox', header: '' };
    const company = { field: 'company', header: 'Company', group: { id: 'G1', label: 'Security' } };
    const columns = [ticker, checkbox, company];
    const groups = computeColumnGroups(columns);

    const headerRow = container.querySelector('.header-row') as HTMLElement;
    applyGroupedHeaderCellClasses(headerRow, groups, columns);

    const checkboxCell = headerRow.querySelector('[data-field="__tbw_checkbox"]');
    // Checkbox should NOT have group-end since its implicit group is embedded
    expect(checkboxCell!.classList.contains('group-end')).toBe(false);

    // Company (last in G1) should have group-end
    const companyCell = headerRow.querySelector('[data-field="company"]');
    expect(companyCell!.classList.contains('group-end')).toBe(true);
  });
});

describe('hasColumnGroups', () => {
  it('returns false for empty columns', () => {
    expect(hasColumnGroups([])).toBe(false);
  });

  it('returns false when no columns have groups', () => {
    const cols = [
      { field: 'a', header: 'A' },
      { field: 'b', header: 'B' },
    ];
    expect(hasColumnGroups(cols)).toBe(false);
  });

  it('returns true when at least one column has group', () => {
    const cols = [
      { field: 'a', header: 'A' },
      { field: 'b', header: 'B', group: 'G1' },
    ];
    expect(hasColumnGroups(cols)).toBe(true);
  });

  it('handles group objects', () => {
    const cols = [{ field: 'a', header: 'A', group: { id: 'g1', label: 'Group' } }];
    expect(hasColumnGroups(cols)).toBe(true);
  });
});

describe('getColumnGroupId', () => {
  it('returns undefined for column without group', () => {
    expect(getColumnGroupId({ field: 'a', header: 'A' })).toBe(undefined);
  });

  it('returns string group id', () => {
    expect(getColumnGroupId({ field: 'a', header: 'A', group: 'MyGroup' } as any)).toBe('MyGroup');
  });

  it('returns id from group object', () => {
    expect(getColumnGroupId({ field: 'a', header: 'A', group: { id: 'g1', label: 'Label' } } as any)).toBe('g1');
  });
});

describe('GroupingColumnsPlugin.handleQuery (getColumnGrouping)', async () => {
  const { GroupingColumnsPlugin } = await import('./grouping-columns-plugin');

  function createPluginWithGroups(columns: any[]): InstanceType<typeof GroupingColumnsPlugin> {
    const plugin = new GroupingColumnsPlugin();
    // Simulate processColumns to populate internal groups
    plugin.processColumns(columns);
    return plugin;
  }

  it('returns empty array when grouping is inactive', () => {
    const plugin = new GroupingColumnsPlugin();
    const result = plugin.handleQuery({ type: 'getColumnGrouping', context: undefined });
    expect(result).toEqual([]);
  });

  it('returns explicit groups as ColumnGroupInfo', () => {
    const plugin = createPluginWithGroups([
      { field: 'name', header: 'Name', group: { id: 'personal', label: 'Personal' } },
      { field: 'email', header: 'Email', group: { id: 'personal', label: 'Personal' } },
      { field: 'dept', header: 'Department', group: { id: 'work', label: 'Work' } },
    ]);

    const result = plugin.handleQuery({ type: 'getColumnGrouping', context: undefined }) as any[];
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 'personal', label: 'Personal', fields: ['name', 'email'] });
    expect(result[1]).toEqual({ id: 'work', label: 'Work', fields: ['dept'] });
  });

  it('filters out implicit groups', () => {
    const plugin = createPluginWithGroups([
      { field: 'id', header: 'ID' }, // ungrouped → implicit group
      { field: 'name', header: 'Name', group: { id: 'personal', label: 'Personal' } },
      { field: 'email', header: 'Email', group: { id: 'personal', label: 'Personal' } },
    ]);

    const result = plugin.handleQuery({ type: 'getColumnGrouping', context: undefined }) as any[];
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('personal');
  });

  it('uses group id as label fallback when label is undefined', () => {
    const plugin = createPluginWithGroups([
      { field: 'a', header: 'A', group: 'MyGroup' },
      { field: 'b', header: 'B', group: 'MyGroup' },
    ]);

    const result = plugin.handleQuery({ type: 'getColumnGrouping', context: undefined }) as any[];
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('MyGroup');
  });

  it('returns undefined for unknown query types', () => {
    const plugin = new GroupingColumnsPlugin();
    const result = plugin.handleQuery({ type: 'unknownQuery', context: undefined });
    expect(result).toBeUndefined();
  });
});

describe('slugifyHeader', () => {
  it('converts header to lowercase slug', () => {
    expect(slugifyHeader('Personal Info')).toBe('personal-info');
  });

  it('removes leading/trailing dashes', () => {
    expect(slugifyHeader('  Hello World!  ')).toBe('hello-world');
  });

  it('collapses multiple non-alphanumeric chars', () => {
    expect(slugifyHeader('Work & Finance --- Data')).toBe('work-finance-data');
  });

  it('handles single word', () => {
    expect(slugifyHeader('Personal')).toBe('personal');
  });

  it('handles empty string', () => {
    expect(slugifyHeader('')).toBe('');
  });
});

describe('resolveColumnGroupDefs', () => {
  it('passes through defs with explicit id', () => {
    const defs = [{ id: 'personal', header: 'Personal Info', children: ['name', 'email'] }];
    const result = resolveColumnGroupDefs(defs);
    expect(result).toEqual(defs);
  });

  it('auto-generates id from header when id is omitted', () => {
    const defs = [{ header: 'Personal Info', children: ['name', 'email'] }];
    const result = resolveColumnGroupDefs(defs);
    expect(result[0].id).toBe('personal-info');
    expect(result[0].header).toBe('Personal Info');
  });

  it('throws when neither id nor header is provided', () => {
    const defs = [{ children: ['name'] } as any];
    expect(() => resolveColumnGroupDefs(defs)).toThrow('requires either an "id" or a "header"');
  });

  it('preserves renderer on definitions', () => {
    const renderer = () => 'custom';
    const defs = [{ header: 'Group', children: ['a'], renderer }];
    const result = resolveColumnGroupDefs(defs);
    expect(result[0].renderer).toBe(renderer);
  });
});

describe('buildGroupHeaderRow with per-group renderer', () => {
  it('uses per-group renderer over fallback renderer', () => {
    const cols = [
      { field: 'a', header: 'A' },
      { field: 'b', header: 'B' },
    ];
    const perGroupRenderer = () => '<em>Custom</em>';
    const fallbackRenderer = () => '<em>Fallback</em>';
    const groups: ColumnGroup[] = [
      { id: 'G1', label: 'Group One', columns: cols, firstIndex: 0, renderer: perGroupRenderer },
    ];
    const row = buildGroupHeaderRow(groups, cols, fallbackRenderer);

    expect(row!.children[0].innerHTML).toBe('<em>Custom</em>');
  });

  it('falls back to groupHeaderRenderer when no per-group renderer', () => {
    const cols = [
      { field: 'a', header: 'A' },
      { field: 'b', header: 'B' },
    ];
    const fallbackRenderer = () => '<em>Fallback</em>';
    const groups: ColumnGroup[] = [{ id: 'G1', label: 'Group One', columns: cols, firstIndex: 0 }];
    const row = buildGroupHeaderRow(groups, cols, fallbackRenderer);

    expect(row!.children[0].innerHTML).toBe('<em>Fallback</em>');
  });

  it('uses textContent (not innerHTML) for non-rendered labels', () => {
    const cols = [{ field: 'a', header: 'A' }];
    // Label contains HTML-like content — should NOT be parsed as HTML
    const groups: ColumnGroup[] = [{ id: 'G1', label: '<b>XSS</b>', columns: cols, firstIndex: 0 }];
    const row = buildGroupHeaderRow(groups, cols);

    // textContent preserves the raw string, innerHTML would parse it
    expect(row!.children[0].textContent).toBe('<b>XSS</b>');
    expect(row!.children[0].querySelector('b')).toBe(null);
  });
});
