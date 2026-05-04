/**
 * @vitest-environment happy-dom
 *
 * Integration tests for GroupingRowsPlugin against a real `<tbw-grid>` element.
 * Covers WAI-ARIA Treegrid role + aria-level/setsize/posinset emission (#264).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GroupingRowsPlugin } from './GroupingRowsPlugin';

import '../../../index';
import type { GridElement } from '../../../public';

async function waitUpgrade(el: GridElement): Promise<void> {
  await customElements.whenDefined('tbw-grid');
  await (el as unknown as { ready?: () => Promise<void> }).ready?.();
  await new Promise((r) => requestAnimationFrame(r));
}

describe('grouping-rows plugin integration', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('WAI-ARIA Treegrid roles (#264)', () => {
    it('switches rows-body role to treegrid and emits aria-level/setsize/posinset on group + data rows', async () => {
      const grid = document.createElement('tbw-grid') as GridElement;
      document.body.appendChild(grid);

      const plugin = new GroupingRowsPlugin({
        groupOn: (row: any) => row.category,
        defaultExpanded: true,
      });

      grid.gridConfig = {
        columns: [
          { field: 'category', header: 'Category' },
          { field: 'name', header: 'Name' },
        ],
        plugins: [plugin],
      };

      grid.rows = [
        { id: 1, category: 'A', name: 'a1' },
        { id: 2, category: 'A', name: 'a2' },
        { id: 3, category: 'B', name: 'b1' },
      ];

      await waitUpgrade(grid);

      expect(grid.querySelector('.rows-body')?.getAttribute('role')).toBe('treegrid');

      const rows = Array.from(grid.querySelectorAll('.data-grid-row'));
      // Order: group A (1/2 lvl 1), data a1 (1/2 lvl 2), data a2 (2/2 lvl 2), group B (2/2 lvl 1), data b1 (1/1 lvl 2)
      expect(rows[0].getAttribute('aria-level')).toBe('1');
      expect(rows[0].getAttribute('aria-posinset')).toBe('1');
      expect(rows[0].getAttribute('aria-setsize')).toBe('2');

      expect(rows[1].getAttribute('aria-level')).toBe('2');
      expect(rows[1].getAttribute('aria-posinset')).toBe('1');
      expect(rows[1].getAttribute('aria-setsize')).toBe('2');

      expect(rows[2].getAttribute('aria-level')).toBe('2');
      expect(rows[2].getAttribute('aria-posinset')).toBe('2');

      expect(rows[3].getAttribute('aria-level')).toBe('1');
      expect(rows[3].getAttribute('aria-posinset')).toBe('2');
      expect(rows[3].getAttribute('aria-setsize')).toBe('2');

      expect(rows[4].getAttribute('aria-level')).toBe('2');
      expect(rows[4].getAttribute('aria-posinset')).toBe('1');
      expect(rows[4].getAttribute('aria-setsize')).toBe('1');
    });

    it('restores rows-body role to grid on detach()', async () => {
      const grid = document.createElement('tbw-grid') as GridElement;
      document.body.appendChild(grid);

      const plugin = new GroupingRowsPlugin({
        groupOn: (row: any) => row.category,
      });

      grid.gridConfig = {
        columns: [{ field: 'category', header: 'Category' }],
        plugins: [plugin],
      };
      grid.rows = [{ id: 1, category: 'A' }];

      await waitUpgrade(grid);

      expect(grid.querySelector('.rows-body')?.getAttribute('role')).toBe('treegrid');

      plugin.detach();

      expect(grid.querySelector('.rows-body')?.getAttribute('role')).toBe('grid');
    });
  });
});
