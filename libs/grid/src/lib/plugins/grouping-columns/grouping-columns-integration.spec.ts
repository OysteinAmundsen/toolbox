/**
 * Column Groups Plugin Integration Tests
 *
 * Tests the GroupingColumnsPlugin with real grid elements.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

    const plugin = grid.getPluginByName('groupingColumns');
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

describe('GroupingColumnsPlugin groupHeaderRenderer', () => {
  let grid: GridElement;

  beforeEach(() => {
    grid = document.createElement('tbw-grid') as GridElement;
    document.body.appendChild(grid);
  });

  afterEach(() => {
    grid.remove();
  });

  it('applies string renderer to group header cells', async () => {
    grid.gridConfig = {
      columns: [
        { field: 'a', header: 'A', group: 'G1' },
        { field: 'b', header: 'B', group: 'G1' },
        { field: 'c', header: 'C', group: 'G2' },
      ],
      plugins: [
        new GroupingColumnsPlugin({
          groupHeaderRenderer: (params) => `<strong>${params.label}</strong> (${params.columns.length})`,
        }),
      ],
    };
    grid.rows = [{ a: 1, b: 2, c: 3 }];

    await customElements.whenDefined('tbw-grid');
    await grid.ready?.();
    await nextFrame();

    const cells = grid.querySelectorAll('.header-group-cell:not(.implicit-group)');
    expect(cells.length).toBe(2);
    expect(cells[0].innerHTML).toBe('<strong>G1</strong> (2)');
    expect(cells[1].innerHTML).toBe('<strong>G2</strong> (1)');
  });

  it('applies HTMLElement renderer to group header cells', async () => {
    grid.gridConfig = {
      columns: [
        { field: 'a', header: 'A', group: { id: 'grp', label: 'My Group' } },
        { field: 'b', header: 'B', group: { id: 'grp', label: 'My Group' } },
      ],
      plugins: [
        new GroupingColumnsPlugin({
          groupHeaderRenderer: (params) => {
            const el = document.createElement('span');
            el.className = 'custom-header';
            el.textContent = `${params.label} [${params.id}]`;
            return el;
          },
        }),
      ],
    };
    grid.rows = [{ a: 1, b: 2 }];

    await customElements.whenDefined('tbw-grid');
    await grid.ready?.();
    await nextFrame();

    const cell = grid.querySelector('.header-group-cell:not(.implicit-group)');
    expect(cell).toBeDefined();
    const span = cell!.querySelector('.custom-header');
    expect(span).toBeDefined();
    expect(span!.textContent).toBe('My Group [grp]');
  });

  it('keeps default label when renderer returns void', async () => {
    grid.gridConfig = {
      columns: [
        { field: 'a', header: 'A', group: 'Keep' },
        { field: 'b', header: 'B', group: 'Keep' },
      ],
      plugins: [
        new GroupingColumnsPlugin({
          groupHeaderRenderer: () => {
            // void — keep default
          },
        }),
      ],
    };
    grid.rows = [{ a: 1, b: 2 }];

    await customElements.whenDefined('tbw-grid');
    await grid.ready?.();
    await nextFrame();

    const cell = grid.querySelector('.header-group-cell:not(.implicit-group)');
    expect(cell).toBeDefined();
    expect(cell!.textContent).toBe('Keep');
  });

  it('provides correct params to the renderer', async () => {
    const receivedParams: Array<Record<string, unknown>> = [];

    grid.gridConfig = {
      columns: [
        { field: 'x', header: 'X', group: { id: 'info', label: 'Info' } },
        { field: 'y', header: 'Y', group: { id: 'info', label: 'Info' } },
        { field: 'z', header: 'Z' },
      ],
      plugins: [
        new GroupingColumnsPlugin({
          groupHeaderRenderer: (params) => {
            receivedParams.push({ ...params, columns: params.columns.length });
          },
        }),
      ],
    };
    grid.rows = [{ x: 1, y: 2, z: 3 }];

    await customElements.whenDefined('tbw-grid');
    await grid.ready?.();
    await nextFrame();

    // Should only be called for explicit groups, not implicit ones
    expect(receivedParams.length).toBe(1);
    expect(receivedParams[0].id).toBe('info');
    expect(receivedParams[0].label).toBe('Info');
    expect(receivedParams[0].columns).toBe(2);
    expect(receivedParams[0].isImplicit).toBe(false);
    expect(typeof receivedParams[0].firstIndex).toBe('number');
  });
});

describe('GroupingColumnsPlugin with plugin config columnGroups', () => {
  let grid: GridElement;

  beforeEach(() => {
    grid = document.createElement('tbw-grid') as GridElement;
    document.body.appendChild(grid);
  });

  afterEach(() => {
    grid.remove();
  });

  it('applies columnGroups from plugin config', async () => {
    grid.gridConfig = {
      columns: [
        { field: 'firstName', header: 'First Name' },
        { field: 'lastName', header: 'Last Name' },
        { field: 'department', header: 'Dept' },
        { field: 'salary', header: 'Salary' },
      ],
      plugins: [
        new GroupingColumnsPlugin({
          columnGroups: [
            { header: 'Personal Info', children: ['firstName', 'lastName'] },
            { header: 'Work Info', children: ['department', 'salary'] },
          ],
        }),
      ],
    };
    grid.rows = [{ firstName: 'Alice', lastName: 'Smith', department: 'Eng', salary: 100000 }];

    await customElements.whenDefined('tbw-grid');
    await grid.ready?.();
    await nextFrame();

    const plugin = grid.getPluginByName('groupingColumns');
    expect(plugin).toBeDefined();
    expect(plugin!.isGroupingActive()).toBe(true);

    const groups = plugin!.getGroups();
    expect(groups.length).toBe(2);
    // id should be auto-generated from header
    expect(groups[0].id).toBe('personal-info');
    expect(groups[0].label).toBe('Personal Info');
    expect(groups[1].id).toBe('work-info');
  });

  it('plugin config columnGroups takes precedence over gridConfig.columnGroups', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      /* noop */
    });

    grid.gridConfig = {
      columnGroups: [{ id: 'grid-level', header: 'Grid Level', children: ['firstName', 'lastName'] }],
      columns: [
        { field: 'firstName', header: 'First Name' },
        { field: 'lastName', header: 'Last Name' },
        { field: 'department', header: 'Dept' },
      ],
      plugins: [
        new GroupingColumnsPlugin({
          columnGroups: [
            { id: 'plugin-level', header: 'Plugin Level', children: ['firstName', 'lastName', 'department'] },
          ],
        }),
      ],
    };
    grid.rows = [{ firstName: 'Alice', lastName: 'Smith', department: 'Eng' }];

    await customElements.whenDefined('tbw-grid');
    await grid.ready?.();
    await nextFrame();

    const plugin = grid.getPluginByName('groupingColumns');
    const groups = plugin!.getGroups();
    // Plugin config should win
    expect(groups[0].id).toBe('plugin-level');

    // Should have warned about both being defined
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('columnGroups defined in both gridConfig and groupingColumns'),
    );

    warnSpy.mockRestore();
  });

  it('applies per-group renderer from columnGroups definition', async () => {
    grid.gridConfig = {
      columns: [
        { field: 'a', header: 'A' },
        { field: 'b', header: 'B' },
        { field: 'c', header: 'C' },
      ],
      plugins: [
        new GroupingColumnsPlugin({
          columnGroups: [
            {
              id: 'g1',
              header: 'Group 1',
              children: ['a', 'b'],
              renderer: (params) => `<em>${params.label}</em>`,
            },
            { id: 'g2', header: 'Group 2', children: ['c'] },
          ],
          // Fallback renderer for groups without specific renderer
          groupHeaderRenderer: (params) => `<strong>${params.label}</strong>`,
        }),
      ],
    };
    grid.rows = [{ a: 1, b: 2, c: 3 }];

    await customElements.whenDefined('tbw-grid');
    await grid.ready?.();
    await nextFrame();

    const cells = grid.querySelectorAll('.header-group-cell:not(.implicit-group)');
    expect(cells.length).toBe(2);
    // g1 uses per-group renderer
    expect(cells[0].innerHTML).toBe('<em>Group 1</em>');
    // g2 falls back to groupHeaderRenderer
    expect(cells[1].innerHTML).toBe('<strong>Group 2</strong>');
  });

  it('auto-generates id from header when id is omitted', async () => {
    grid.gridConfig = {
      columns: [
        { field: 'a', header: 'A' },
        { field: 'b', header: 'B' },
      ],
      plugins: [
        new GroupingColumnsPlugin({
          columnGroups: [{ header: 'My Group', children: ['a', 'b'] }],
        }),
      ],
    };
    grid.rows = [{ a: 1, b: 2 }];

    await customElements.whenDefined('tbw-grid');
    await grid.ready?.();
    await nextFrame();

    const plugin = grid.getPluginByName('groupingColumns');
    const groups = plugin!.getGroups();
    expect(groups[0].id).toBe('my-group');
  });
});
