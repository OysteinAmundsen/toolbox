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
  getColumnGroupId,
  hasColumnGroups,
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
