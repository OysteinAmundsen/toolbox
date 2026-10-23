/**
 * Integration tests: clicking a structural toggle (tree expander, master-detail
 * expander, group-row toggle) must toggle the row and never start a row edit,
 * regardless of the order the plugins/features are registered in (#565).
 *
 * `PluginManager.onCellClick` stops at the first plugin that returns `true`, so
 * with `editing` registered first, `EditingPlugin.onCellClick` used to call
 * `beginBulkEdit` and swallow the click before the expander plugin saw it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { nextFrame, waitUpgrade } from '../../../test/helpers';
import '../../index';
import type { BaseGridPlugin } from '../../lib/core/plugin';
import type { GridIcons } from '../../lib/core/types';
import { EditingPlugin } from '../../lib/plugins/editing/editing-plugin';
import { GroupingRowsPlugin } from '../../lib/plugins/grouping-rows/grouping-rows-plugin';
import { MasterDetailPlugin } from '../../lib/plugins/master-detail/master-detail-plugin';
import { TreePlugin } from '../../lib/plugins/tree/tree-plugin';

interface Row {
  id: string;
  name: string;
  dept: string;
  children?: Row[];
}

type Order = 'editing first' | 'editing last';
const orders: Order[] = ['editing first', 'editing last'];

const SVG_ICON = '<svg viewBox="0 0 8 8"><path d="M0 0L8 4L0 8z"></path></svg>';

const treeRows = (): Row[] => [
  { id: 'p1', name: 'Parent', dept: 'A', children: [{ id: 'c1', name: 'Child', dept: 'A' }] },
  { id: 'p2', name: 'Other', dept: 'B' },
];

const flatRows = (): Row[] => [
  { id: '1', name: 'Alpha', dept: 'A' },
  { id: '2', name: 'Beta', dept: 'B' },
];

async function setup(
  order: Order,
  other: BaseGridPlugin | BaseGridPlugin[],
  rows: Row[],
  icons?: GridIcons,
  editOn: 'click' | 'dblclick' = 'click',
) {
  const editing = new EditingPlugin({ editOn });
  const others = [other].flat();
  const grid = document.createElement('tbw-grid') as any;
  grid.gridConfig = {
    columns: [
      { field: 'name', header: 'Name', editable: true },
      { field: 'dept', header: 'Dept', editable: true },
    ],
    plugins: order === 'editing first' ? [editing, ...others] : [...others, editing],
    icons,
  };
  grid.rows = rows;
  document.body.appendChild(grid);
  await waitUpgrade(grid);
  return { grid, editing };
}

async function clickToggle(grid: HTMLElement, selector: string, iconChild = false): Promise<HTMLElement> {
  const toggle = grid.querySelector(selector) as HTMLElement;
  expect(toggle).toBeTruthy();
  const target = iconChild ? (toggle.querySelector('svg') as Element) : toggle;
  expect(target).toBeTruthy();
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await nextFrame();
  return toggle;
}

/**
 * Replays the browser's event sequence for one double-click (`click, click, dblclick`).
 * Re-queries the target before each event: a toggle re-renders between the clicks.
 */
async function doubleClick(grid: HTMLElement, selector: string): Promise<void> {
  for (const [type, detail] of [
    ['click', 1],
    ['click', 2],
    ['dblclick', 2],
  ] as const) {
    const target = grid.querySelector(selector) as HTMLElement;
    expect(target, `${type} target ${selector}`).toBeTruthy();
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, detail }));
    await nextFrame();
  }
}

function expectNoRowEdit(grid: any) {
  expect(grid._activeEditRows).toBe(-1);
  expect(grid.querySelector('.cell.editing')).toBeNull();
}

describe('structural toggle click vs. editing (#565)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe.each([false, true])('icon child clicked: %s', (iconChild) => {
    const icons = iconChild ? { expand: SVG_ICON, collapse: SVG_ICON } : undefined;

    it.each(orders)('tree toggle expands the row instead of starting an edit (%s)', async (order) => {
      const tree = new TreePlugin({ childrenField: 'children' });
      const { grid } = await setup(order, tree, treeRows(), icons);

      const toggle = await clickToggle(grid, '.tree-toggle', iconChild);

      expect(tree.isExpanded(toggle.getAttribute('data-tree-key') ?? '')).toBe(true);
      expectNoRowEdit(grid);
    });

    it.each(orders)('master-detail toggle expands the row instead of starting an edit (%s)', async (order) => {
      const detail = new MasterDetailPlugin({ detailRenderer: () => 'detail' });
      const { grid } = await setup(order, detail, flatRows(), icons);

      await clickToggle(grid, '.master-detail-toggle', iconChild);

      expect(detail.isExpanded(0)).toBe(true);
      expectNoRowEdit(grid);
    });

    // PR #567 review: onRowClick (expandOnRowClick) must not toggle a click that onCellClick owns.
    it('master-detail toggle with expandOnRowClick toggles exactly once per click', async () => {
      const detail = new MasterDetailPlugin({ detailRenderer: () => 'detail', expandOnRowClick: true });
      const { grid } = await setup('editing last', detail, flatRows(), icons);
      const events: boolean[] = [];
      grid.addEventListener('detail-expand', (e: CustomEvent<{ expanded: boolean }>) => events.push(e.detail.expanded));

      await clickToggle(grid, '.master-detail-toggle', iconChild);
      expect(detail.isExpanded(0)).toBe(true);
      expect(events).toEqual([true]);

      await clickToggle(grid, '.master-detail-toggle', iconChild);
      expect(detail.isExpanded(0)).toBe(false);
      expect(events).toEqual([true, false]);
    });

    it('a tree toggle click does not trigger master-detail expandOnRowClick', async () => {
      const tree = new TreePlugin({ childrenField: 'children' });
      const detail = new MasterDetailPlugin({ detailRenderer: () => 'detail', expandOnRowClick: true });
      const { grid } = await setup('editing last', [tree, detail], treeRows(), icons);

      const toggle = await clickToggle(grid, '.tree-toggle', iconChild);

      expect(tree.isExpanded(toggle.getAttribute('data-tree-key') ?? '')).toBe(true);
      expect(detail.getExpandedRows()).toEqual([]);
    });
  });

  it.each(orders)('group-row toggle collapses the group instead of starting an edit (%s)', async (order) => {
    const grouping = new GroupingRowsPlugin({ groupOn: (row) => (row as Row).dept, defaultExpanded: true });
    const { grid } = await setup(order, grouping, flatRows());
    const before = grouping.getExpandedGroups().length;

    await clickToggle(grid, '.group-toggle');

    expect(grouping.getExpandedGroups().length).toBe(before - 1);
    expectNoRowEdit(grid);
  });

  it.each(orders)('a click on a regular cell still starts the row edit (%s)', async (order) => {
    const { grid } = await setup(order, new TreePlugin({ childrenField: 'children' }), treeRows());

    (grid.querySelector('.data-grid-row .cell[data-col="1"]') as HTMLElement).click();
    await nextFrame();

    expect(grid._activeEditRows).toBe(0);
  });

  it('EditingPlugin.onCellClick ignores structural toggles on its own (no hook priority needed)', async () => {
    const rows = treeRows();
    const { grid, editing } = await setup('editing first', new TreePlugin({ childrenField: 'children' }), rows);
    const beginSpy = vi.spyOn(editing, 'beginBulkEdit');
    const cellEl = grid.querySelector('.data-grid-row .cell[data-col="1"]') as HTMLElement;

    for (const cls of ['tree-toggle', 'master-detail-toggle', 'group-toggle']) {
      const toggle = document.createElement('span');
      toggle.className = cls;
      const icon = document.createElement('i');
      toggle.appendChild(icon);
      cellEl.appendChild(toggle);
      const originalEvent = new MouseEvent('click');
      Object.defineProperty(originalEvent, 'target', { value: icon });

      const handled = editing.onCellClick({
        rowIndex: 0,
        colIndex: 1,
        column: grid._visibleColumns[1],
        field: 'dept',
        value: 'A',
        row: rows[0],
        cellEl,
        originalEvent,
      });

      expect(handled, cls).toBe(false);
      toggle.remove();
    }
    expect(beginSpy).not.toHaveBeenCalled();
  });

  it('expander plugins claim onCellClick before default-priority plugins', () => {
    expect(TreePlugin.manifest?.hookPriority?.onCellClick).toBeLessThan(0);
    expect(MasterDetailPlugin.manifest?.hookPriority?.onCellClick).toBeLessThan(0);
    expect(GroupingRowsPlugin.manifest?.hookPriority?.onCellClick).toBeLessThan(0);
  });
});

// Core routes `dblclick` through the same handler as `click`, so one double-click reaches
// `onCellClick` / `onRowClick` three times. It must act like two clicks: toggle twice, end
// where it started, and (in `editOn: 'dblclick'` mode) never start a row edit.
describe('double-clicking a structural toggle (#568)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it.each(orders)('tree toggle toggles twice and starts no edit (%s)', async (order) => {
    const tree = new TreePlugin({ childrenField: 'children' });
    const { grid } = await setup(order, tree, treeRows(), undefined, 'dblclick');
    const events: boolean[] = [];
    grid.addEventListener('tree-expand', (e: CustomEvent<{ expanded: boolean }>) => events.push(e.detail.expanded));

    await doubleClick(grid, '.tree-toggle');

    expect(events).toEqual([true, false]);
    expect(tree.isExpanded('p1')).toBe(false);
    expectNoRowEdit(grid);
  });

  it.each(orders)('master-detail toggle toggles twice and starts no edit (%s)', async (order) => {
    const detail = new MasterDetailPlugin({ detailRenderer: () => 'detail' });
    const { grid } = await setup(order, detail, flatRows(), undefined, 'dblclick');
    const events: boolean[] = [];
    grid.addEventListener('detail-expand', (e: CustomEvent<{ expanded: boolean }>) => events.push(e.detail.expanded));

    await doubleClick(grid, '.master-detail-toggle');

    expect(events).toEqual([true, false]);
    expect(detail.isExpanded(0)).toBe(false);
    expectNoRowEdit(grid);
  });

  it('master-detail expandOnRowClick toggles twice on a double-clicked cell', async () => {
    const detail = new MasterDetailPlugin({ detailRenderer: () => 'detail', expandOnRowClick: true });
    const grid = document.createElement('tbw-grid') as any;
    grid.gridConfig = { columns: [{ field: 'name' }, { field: 'dept' }], plugins: [detail] };
    grid.rows = flatRows();
    document.body.appendChild(grid);
    await waitUpgrade(grid);
    const events: boolean[] = [];
    grid.addEventListener('detail-expand', (e: CustomEvent<{ expanded: boolean }>) => events.push(e.detail.expanded));

    await doubleClick(grid, '.data-grid-row .cell[data-field="name"]');

    expect(events).toEqual([true, false]);
    expect(detail.isExpanded(0)).toBe(false);
  });

  it.each(orders)('group-row toggle toggles twice and starts no edit (%s)', async (order) => {
    const grouping = new GroupingRowsPlugin({ groupOn: (row) => (row as Row).dept, defaultExpanded: true });
    const { grid } = await setup(order, grouping, flatRows(), undefined, 'dblclick');
    const before = [...grouping.getExpandedGroups()].sort();
    let toggles = 0;
    grid.addEventListener('group-toggle', () => toggles++);

    await doubleClick(grid, '.group-toggle');

    expect(toggles).toBe(2);
    expect([...grouping.getExpandedGroups()].sort()).toEqual(before);
    expectNoRowEdit(grid);
  });

  it('a double-click on a regular cell still starts the row edit (editOn: dblclick)', async () => {
    const { grid } = await setup(
      'editing last',
      new TreePlugin({ childrenField: 'children' }),
      treeRows(),
      undefined,
      'dblclick',
    );

    await doubleClick(grid, '.data-grid-row .cell[data-col="1"]');

    expect(grid._activeEditRows).toBe(0);
  });

  // Built-in group rows never reach core's click hooks: the button stops its own `click`, and
  // its `dblclick` finds no `.cell[data-row]`, so `handleRowClick` bails. Only a custom
  // `groupRowRenderer` emitting `.cell[data-row]` + `.group-toggle` reaches GroupingRows.onCellClick.
  it('GroupingRows.onCellClick toggles a custom group toggle on click, claims a dblclick without toggling', () => {
    const grouping = new GroupingRowsPlugin({ groupOn: (row) => (row as Row).dept });
    const toggleSpy = vi.spyOn(grouping, 'toggle').mockImplementation(() => undefined);
    const cellEl = document.createElement('div');
    const toggle = document.createElement('span');
    toggle.className = 'group-toggle';
    cellEl.appendChild(toggle);
    const cellClick = (type: 'click' | 'dblclick') => {
      const originalEvent = new MouseEvent(type);
      Object.defineProperty(originalEvent, 'target', { value: toggle });
      return grouping.onCellClick({
        rowIndex: 0,
        colIndex: 0,
        column: { field: 'name' },
        field: 'name',
        value: undefined,
        row: { __isGroupRow: true, __groupKey: 'A' },
        cellEl,
        originalEvent,
      });
    };

    expect(cellClick('click')).toBe(true);
    expect(cellClick('dblclick')).toBe(true);
    expect(toggleSpy).toHaveBeenCalledTimes(1);
  });
});
