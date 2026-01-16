/**
 * Column Groups Plugin Integration Tests
 *
 * Tests the GroupingColumnsPlugin with real grid elements.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextFrame } from '../../../../test/helpers';
import '../../../index';
import type { GridElement } from '../../../public';
import { GroupingColumnsPlugin } from './GroupingColumnsPlugin';

describe('GroupingColumnsPlugin with gridConfig.columnGroups', () => {
  let grid: GridElement;

  beforeEach(() => {
    grid = document.createElement('tbw-grid') as GridElement;
    document.body.appendChild(grid);
  });

  afterEach(() => {
    grid.remove();
  });

  it('applies columnGroups from gridConfig to columns', async () => {
    grid.gridConfig = {
      columnGroups: [
        { id: 'personal', header: 'Personal Info', children: ['firstName', 'lastName'] },
        { id: 'work', header: 'Work Info', children: ['department', 'salary'] },
      ],
      columns: [
        { field: 'firstName', header: 'First Name' },
        { field: 'lastName', header: 'Last Name' },
        { field: 'department', header: 'Dept' },
        { field: 'salary', header: 'Salary' },
      ],
      plugins: [new GroupingColumnsPlugin()],
    };
    grid.rows = [{ firstName: 'Alice', lastName: 'Smith', department: 'Eng', salary: 100000 }];

    await customElements.whenDefined('tbw-grid');
    await grid.ready?.();
    await nextFrame();

    const plugin = grid.getPlugin(GroupingColumnsPlugin);
    expect(plugin).toBeDefined();
    expect(plugin!.isGroupingActive()).toBe(true);

    const groups = plugin!.getGroups();
    expect(groups.length).toBe(2);
    expect(groups[0].id).toBe('personal');
    expect(groups[0].label).toBe('Personal Info');
    expect(groups[0].columns.length).toBe(2);
    expect(groups[1].id).toBe('work');
    expect(groups[1].label).toBe('Work Info');
    expect(groups[1].columns.length).toBe(2);
  });

  it('detect() returns true when columnGroups is configured', () => {
    const config = {
      columnGroups: [{ id: 'g1', header: 'Group 1', children: ['a', 'b'] }],
      columns: [
        { field: 'a', header: 'A' },
        { field: 'b', header: 'B' },
      ],
    };
    expect(GroupingColumnsPlugin.detect([], config)).toBe(true);
  });

  it('detect() returns false when no grouping is configured', () => {
    const config = {
      columns: [
        { field: 'a', header: 'A' },
        { field: 'b', header: 'B' },
      ],
    };
    expect(GroupingColumnsPlugin.detect([], config)).toBe(false);
  });
});
