/**
 * Integration tests: Space-to-toggle plugin handlers must defer to form fields (#546).
 *
 * Tree, GroupingRows and MasterDetail toggle the focused row on Space. The grid
 * dispatches keydown to plugins before its own form-field guard, so a Space typed
 * into an editor (or any input inside the grid) used to toggle the row and have
 * its character swallowed by `preventDefault()`.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { nextFrame, waitUpgrade } from '../../../test/helpers';
import '../../index';
import { isExpanderColumn } from '../../lib/core/plugin/expander-column';
import { EditingPlugin } from '../../lib/plugins/editing';
import { GroupingRowsPlugin } from '../../lib/plugins/grouping-rows';
import { MasterDetailPlugin } from '../../lib/plugins/master-detail';
import { TreePlugin } from '../../lib/plugins/tree';
import type { GridElement } from '../../public';

function pressSpace(target: EventTarget): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true, composed: true });
  target.dispatchEvent(event);
  return event;
}

describe('Space toggle defers to form fields (#546)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('TreePlugin', () => {
    async function createTreeGrid() {
      const grid = document.createElement('tbw-grid') as GridElement & Record<string, any>;
      document.body.appendChild(grid);
      grid.gridConfig = {
        columns: [{ field: 'name', header: 'Name', editable: true }],
        plugins: [
          new TreePlugin({ childrenField: 'children', defaultExpanded: true }),
          new EditingPlugin({ mode: 'row', editOn: 'dblclick' }),
        ],
      };
      grid.rows = [{ id: 'p1', name: 'Parent', children: [{ id: 'c1', name: 'Child' }] }];
      await waitUpgrade(grid);
      grid._focusRow = 0;
      grid._focusCol = 0;
      return grid;
    }

    it('does not toggle the row or swallow the key when Space comes from an open editor', async () => {
      const grid = await createTreeGrid();
      expect(grid._rows.length).toBe(2);

      grid.getPluginByName('editing').beginBulkEdit(0);
      await nextFrame();
      const input = grid.querySelector('.data-grid-row .cell.editing input') as HTMLInputElement;
      expect(input).not.toBeNull();
      input.focus();

      const event = pressSpace(input);
      await nextFrame();

      expect(event.defaultPrevented).toBe(false);
      expect(grid._rows.length).toBe(2);
    });

    it('still toggles the row when Space comes from the grid host', async () => {
      const grid = await createTreeGrid();

      const event = pressSpace(grid);
      await nextFrame();

      expect(event.defaultPrevented).toBe(true);
      expect(grid._rows.length).toBe(1);
    });
  });

  describe('GroupingRowsPlugin', () => {
    it('does not toggle a group row when Space comes from an input inside it', async () => {
      const grid = document.createElement('tbw-grid') as GridElement & Record<string, any>;
      document.body.appendChild(grid);
      grid.gridConfig = {
        columns: [{ field: 'name', header: 'Name' }],
        plugins: [new GroupingRowsPlugin({ groupOn: (row: any) => row.category, defaultExpanded: true })],
      };
      grid.rows = [
        { id: 1, category: 'A', name: 'a1' },
        { id: 2, category: 'A', name: 'a2' },
      ];
      await waitUpgrade(grid);
      grid._focusRow = 0;
      grid._focusCol = 0;
      expect(grid._rows.length).toBe(3);

      const input = document.createElement('input');
      grid.querySelector('.data-grid-row')!.appendChild(input);

      const event = pressSpace(input);
      await nextFrame();

      expect(event.defaultPrevented).toBe(false);
      expect(grid._rows.length).toBe(3);

      // Control: the same key from the host still collapses the group.
      expect(pressSpace(grid).defaultPrevented).toBe(true);
    });
  });

  describe('MasterDetailPlugin', () => {
    it('does not collapse the detail when Space comes from an input in the detail panel', async () => {
      const grid = document.createElement('tbw-grid') as GridElement & Record<string, any>;
      document.body.appendChild(grid);
      const plugin = new MasterDetailPlugin({
        detailRenderer: () => {
          const input = document.createElement('input');
          input.className = 'detail-input';
          return input;
        },
      });
      grid.gridConfig = {
        columns: [{ field: 'name', header: 'Name' }],
        plugins: [plugin],
      };
      grid.rows = [{ id: 1, name: 'Alice' }];
      await waitUpgrade(grid);

      plugin.expand(0);
      await nextFrame();
      await nextFrame();
      grid._focusRow = 0;
      grid._focusCol = grid._visibleColumns.findIndex((c: any) => isExpanderColumn(c));
      expect(grid._focusCol).toBeGreaterThanOrEqual(0);

      const input = grid.querySelector('.detail-input') as HTMLInputElement;
      expect(input).not.toBeNull();

      const event = pressSpace(input);

      expect(event.defaultPrevented).toBe(false);
      expect(plugin.isExpanded(0)).toBe(true);

      // Control: the same key from the host still toggles the expander.
      expect(pressSpace(grid).defaultPrevented).toBe(true);
      expect(plugin.isExpanded(0)).toBe(false);
    });
  });
});
