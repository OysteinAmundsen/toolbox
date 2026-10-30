/**
 * A mousedown on a plugin-rendered row whose cells carry no `data-row` (group
 * headers render `data-col` only) must still focus the row's DATA index, so a
 * following Space toggles that group (PR #582 review). `getRowIndexFromCell`
 * resolves it from the row's `aria-rowindex`, which `renderVisibleRows` stamps
 * before the `renderRow` hook — virtualization-safe, unlike the old
 * DOM-position fallback.
 */
import { afterEach, describe, expect, it } from 'vitest';
import '../../lib/core/grid';
import { nextFrame, waitUpgrade } from '../../../test/helpers';
import type { DataGridElement } from '../../lib/core/grid';
import { GroupingRowsPlugin } from '../../lib/plugins/grouping-rows';

interface Row {
  id: number;
  dept: string;
}

describe('group-row focus via mousedown', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('focuses the group row data index when its cell has no data-row', async () => {
    const grid = document.createElement('tbw-grid') as DataGridElement<Row>;
    document.body.appendChild(grid);
    grid.gridConfig = {
      columns: [{ field: 'id' }, { field: 'dept' }],
      plugins: [new GroupingRowsPlugin({ groupOn: (r) => (r as Row).dept, defaultExpanded: true })],
    };
    grid.rows = [
      { id: 1, dept: 'A' },
      { id: 2, dept: 'A' },
      { id: 3, dept: 'B' },
    ];
    await waitUpgrade(grid);

    // Rows: [group A, 1, 2, group B, 3] → group B is data index 3.
    const groupBCell = grid.querySelector<HTMLElement>('.rows > .data-grid-row[aria-rowindex="5"] > .cell');
    expect(groupBCell).not.toBeNull();
    expect(groupBCell!.hasAttribute('data-row')).toBe(false);

    groupBCell!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await nextFrame();

    expect(grid._focusRow).toBe(3);
    expect(grid._focusCol).toBe(0);
  });
});
