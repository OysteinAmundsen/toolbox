import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  collapseDetailRow,
  createDetailElement,
  expandDetailRow,
  isDetailExpanded,
  toggleDetailRow,
} from './master-detail';
import { MasterDetailPlugin } from './MasterDetailPlugin';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Tests use `any` for flexibility with test row data.

describe('masterDetail', () => {
  describe('toggleDetailRow', () => {
    it('should expand a collapsed row', () => {
      const expanded = new Set<number>();
      const result = toggleDetailRow(expanded, 0);

      expect(result.has(0)).toBe(true);
      expect(result.size).toBe(1);
    });

    it('should collapse an expanded row', () => {
      const expanded = new Set<number>([0]);
      const result = toggleDetailRow(expanded, 0);

      expect(result.has(0)).toBe(false);
      expect(result.size).toBe(0);
    });

    it('should toggle same row twice back to original state', () => {
      const expanded = new Set<number>();
      const afterExpand = toggleDetailRow(expanded, 2);
      const afterCollapse = toggleDetailRow(afterExpand, 2);

      expect(afterExpand.has(2)).toBe(true);
      expect(afterCollapse.has(2)).toBe(false);
    });

    it('should not mutate the original Set', () => {
      const expanded = new Set<number>([1, 2]);
      const result = toggleDetailRow(expanded, 3);

      expect(expanded.size).toBe(2);
      expect(result.size).toBe(3);
      expect(result).not.toBe(expanded);
    });

    it('should handle multiple expanded rows', () => {
      const expanded = new Set<number>([0, 2, 4]);
      const result = toggleDetailRow(expanded, 3);

      expect(result.has(0)).toBe(true);
      expect(result.has(2)).toBe(true);
      expect(result.has(3)).toBe(true);
      expect(result.has(4)).toBe(true);
      expect(result.size).toBe(4);
    });
  });

  describe('expandDetailRow', () => {
    it('should expand a row', () => {
      const expanded = new Set<number>();
      const result = expandDetailRow(expanded, 5);

      expect(result.has(5)).toBe(true);
    });

    it('should not duplicate already expanded row', () => {
      const expanded = new Set<number>([5]);
      const result = expandDetailRow(expanded, 5);

      expect(result.has(5)).toBe(true);
      expect(result.size).toBe(1);
    });

    it('should not mutate the original Set', () => {
      const expanded = new Set<number>();
      const result = expandDetailRow(expanded, 0);

      expect(expanded.size).toBe(0);
      expect(result.size).toBe(1);
    });
  });

  describe('collapseDetailRow', () => {
    it('should collapse an expanded row', () => {
      const expanded = new Set<number>([0, 1, 2]);
      const result = collapseDetailRow(expanded, 1);

      expect(result.has(0)).toBe(true);
      expect(result.has(1)).toBe(false);
      expect(result.has(2)).toBe(true);
      expect(result.size).toBe(2);
    });

    it('should handle collapsing non-existent row gracefully', () => {
      const expanded = new Set<number>([0, 1]);
      const result = collapseDetailRow(expanded, 99);

      expect(result.size).toBe(2);
      expect(result.has(0)).toBe(true);
      expect(result.has(1)).toBe(true);
    });

    it('should not mutate the original Set', () => {
      const expanded = new Set<number>([0]);
      const result = collapseDetailRow(expanded, 0);

      expect(expanded.size).toBe(1);
      expect(result.size).toBe(0);
    });
  });

  describe('isDetailExpanded', () => {
    it('should return true for expanded row', () => {
      const expanded = new Set<number>([0, 5, 10]);

      expect(isDetailExpanded(expanded, 0)).toBe(true);
      expect(isDetailExpanded(expanded, 5)).toBe(true);
      expect(isDetailExpanded(expanded, 10)).toBe(true);
    });

    it('should return false for collapsed row', () => {
      const expanded = new Set<number>([0, 5, 10]);

      expect(isDetailExpanded(expanded, 1)).toBe(false);
      expect(isDetailExpanded(expanded, 6)).toBe(false);
      expect(isDetailExpanded(expanded, 99)).toBe(false);
    });

    it('should return false for empty expanded set', () => {
      const expanded = new Set<number>();

      expect(isDetailExpanded(expanded, 0)).toBe(false);
    });
  });

  describe('createDetailElement', () => {
    beforeEach(() => {
      // Clean up any previous test artifacts
      document.body.innerHTML = '';
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should create a detail row element with string content', () => {
      const row = { id: 1, name: 'Test' };
      const renderer = () => '<p>Detail content</p>';

      const element = createDetailElement(row, 0, renderer, 3);

      expect(element.className).toBe('master-detail-row');
      expect(element.getAttribute('data-detail-for')).toBe('0');
      expect(element.getAttribute('role')).toBe('row');

      const cell = element.querySelector('.master-detail-cell');
      expect(cell).not.toBeNull();
      expect(cell?.getAttribute('role')).toBe('cell');
      expect(cell?.innerHTML).toBe('<p>Detail content</p>');
      expect(cell?.getAttribute('style')).toContain('grid-column: 1 / 4');
    });

    it('should create a detail row element with HTMLElement content', () => {
      const row = { id: 2, name: 'Test' };
      const renderer = (r: any) => {
        const div = document.createElement('div');
        div.textContent = `Name: ${r.name}`;
        div.className = 'custom-detail';
        return div;
      };

      const element = createDetailElement(row, 1, renderer, 5);

      const cell = element.querySelector('.master-detail-cell');
      expect(cell).not.toBeNull();

      const customDetail = cell?.querySelector('.custom-detail');
      expect(customDetail).not.toBeNull();
      expect(customDetail?.textContent).toBe('Name: Test');
      expect(cell?.getAttribute('style')).toContain('grid-column: 1 / 6');
    });

    it('should pass row and rowIndex to renderer', () => {
      const row = { id: 3, value: 42 };
      let receivedRow: any;
      let receivedIndex: number | undefined;

      const renderer = (r: any, idx: number) => {
        receivedRow = r;
        receivedIndex = idx;
        return 'content';
      };

      createDetailElement(row, 7, renderer, 2);

      expect(receivedRow).toBe(row);
      expect(receivedIndex).toBe(7);
    });

    it('should set correct grid column span based on column count', () => {
      const row = { id: 1 };
      const renderer = () => 'test';

      const element1 = createDetailElement(row, 0, renderer, 1);
      const element5 = createDetailElement(row, 0, renderer, 5);
      const element10 = createDetailElement(row, 0, renderer, 10);

      expect(element1.querySelector('.master-detail-cell')?.getAttribute('style')).toContain('grid-column: 1 / 2');
      expect(element5.querySelector('.master-detail-cell')?.getAttribute('style')).toContain('grid-column: 1 / 6');
      expect(element10.querySelector('.master-detail-cell')?.getAttribute('style')).toContain('grid-column: 1 / 11');
    });

    it('should handle empty string content', () => {
      const row = { id: 1 };
      const renderer = () => '';

      const element = createDetailElement(row, 0, renderer, 2);
      const cell = element.querySelector('.master-detail-cell');

      expect(cell?.innerHTML).toBe('');
    });

    it('should handle complex HTML string content', () => {
      const row = { id: 1, items: ['a', 'b', 'c'] };
      const renderer = (r: any) => `
        <ul>
          ${r.items.map((item: string) => `<li>${item}</li>`).join('')}
        </ul>
      `;

      const element = createDetailElement(row, 0, renderer, 3);
      const cell = element.querySelector('.master-detail-cell');
      const listItems = cell?.querySelectorAll('li');

      expect(listItems?.length).toBe(3);
    });
  });

  describe('MasterDetailPlugin.getExtraHeight', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    // Create a minimal mock grid for plugin attachment
    const createMockGrid = () =>
      ({
        shadowRoot: null,
        rows: [],
        columns: [],
        gridConfig: {},
        disconnectSignal: new AbortController().signal,
        requestRender: vi.fn(),
        requestAfterRender: vi.fn(),
        forceLayout: vi.fn().mockResolvedValue(undefined),
        getPlugin: vi.fn(),
        getPluginByName: vi.fn(),
        dispatchEvent: vi.fn(),
      } as any);

    it('should return 0 when no rows are expanded', () => {
      const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
      plugin.attach(createMockGrid());
      expect(plugin.getExtraHeight()).toBe(0);
    });

    it('should return estimated height for expanded rows without rendered detail elements', () => {
      const plugin = new MasterDetailPlugin({ detailHeight: 200, detailRenderer: () => 'test' });
      plugin.attach(createMockGrid());

      // Manually add to expandedRows (simulating internal state)
      const row1 = { id: 1 };
      const row2 = { id: 2 };
      plugin['expandedRows'].add(row1);
      plugin['expandedRows'].add(row2);

      // No detail elements rendered yet, should use config detailHeight
      expect(plugin.getExtraHeight()).toBe(400); // 2 rows * 200px
    });

    it('should return default height (150) when detailHeight not configured', () => {
      const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
      plugin.attach(createMockGrid());

      const row = { id: 1 };
      plugin['expandedRows'].add(row);

      // No detailHeight config, should use default 150 (since 'auto' is not a number)
      expect(plugin.getExtraHeight()).toBe(150);
    });

    it('should return actual offsetHeight from rendered detail elements', () => {
      const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
      plugin.attach(createMockGrid());

      const row = { id: 1 };
      plugin['expandedRows'].add(row);

      // Create a mock detail element with offsetHeight
      const detailEl = document.createElement('div');
      Object.defineProperty(detailEl, 'offsetHeight', { value: 250, configurable: true });
      plugin['detailElements'].set(row, detailEl);

      expect(plugin.getExtraHeight()).toBe(250);
    });

    it('should sum heights from multiple expanded detail elements', () => {
      const plugin = new MasterDetailPlugin({ detailHeight: 100, detailRenderer: () => 'test' });
      plugin.attach(createMockGrid());

      const row1 = { id: 1 };
      const row2 = { id: 2 };
      const row3 = { id: 3 };
      plugin['expandedRows'].add(row1);
      plugin['expandedRows'].add(row2);
      plugin['expandedRows'].add(row3);

      // Mock detail elements with different heights
      const detail1 = document.createElement('div');
      Object.defineProperty(detail1, 'offsetHeight', { value: 100, configurable: true });
      plugin['detailElements'].set(row1, detail1);

      const detail2 = document.createElement('div');
      Object.defineProperty(detail2, 'offsetHeight', { value: 200, configurable: true });
      plugin['detailElements'].set(row2, detail2);

      // row3 has no rendered element, should use config detailHeight (100)

      expect(plugin.getExtraHeight()).toBe(400); // 100 + 200 + 100
    });
  });

  describe('MasterDetailPlugin.getExtraHeightBefore', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    // Create a minimal mock grid for plugin attachment
    const createMockGrid = (rows: any[] = []) =>
      ({
        shadowRoot: null,
        rows,
        columns: [],
        gridConfig: {},
        disconnectSignal: new AbortController().signal,
        requestRender: vi.fn(),
        requestAfterRender: vi.fn(),
        forceLayout: vi.fn().mockResolvedValue(undefined),
        getPlugin: vi.fn(),
        getPluginByName: vi.fn(),
        dispatchEvent: vi.fn(),
      } as any);

    it('should return 0 when no rows are expanded', () => {
      const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
      plugin.attach(createMockGrid());
      expect(plugin.getExtraHeightBefore(5)).toBe(0);
    });

    it('should return 0 when all expanded rows are after the given index', () => {
      const rows = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];
      const plugin = new MasterDetailPlugin({ detailHeight: 100, detailRenderer: () => 'test' });
      plugin.attach(createMockGrid(rows));

      // Expand row at index 2 and 3
      plugin['expandedRows'].add(rows[2]);
      plugin['expandedRows'].add(rows[3]);

      // Ask for height before index 2 - should be 0
      expect(plugin.getExtraHeightBefore(2)).toBe(0);
    });

    it('should return height of expanded rows before the given index', () => {
      const rows = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];
      const plugin = new MasterDetailPlugin({ detailHeight: 100, detailRenderer: () => 'test' });
      plugin.attach(createMockGrid(rows));

      // Expand row at index 1
      plugin['expandedRows'].add(rows[1]);

      // Ask for height before index 3 - should include row 1's detail
      expect(plugin.getExtraHeightBefore(3)).toBe(100);
    });

    it('should sum heights from multiple expanded rows before the given index', () => {
      const rows = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
      const plugin = new MasterDetailPlugin({ detailHeight: 100, detailRenderer: () => 'test' });
      plugin.attach(createMockGrid(rows));

      // Expand rows at index 0, 1, and 3
      plugin['expandedRows'].add(rows[0]);
      plugin['expandedRows'].add(rows[1]);
      plugin['expandedRows'].add(rows[3]);

      // Mock detail element for row 0 with different height
      const detail0 = document.createElement('div');
      Object.defineProperty(detail0, 'offsetHeight', { value: 150, configurable: true });
      plugin['detailElements'].set(rows[0], detail0);

      // Ask for height before index 3 - should include rows 0 (150) and 1 (100)
      expect(plugin.getExtraHeightBefore(3)).toBe(250);

      // Ask for height before index 4 - should include rows 0 (150), 1 (100), and 3 (100)
      expect(plugin.getExtraHeightBefore(4)).toBe(350);
    });
  });

  describe('MasterDetailPlugin.adjustVirtualStart', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    const createMockGrid = (rows: any[] = []) =>
      ({
        shadowRoot: null,
        rows,
        columns: [],
        gridConfig: {},
        disconnectSignal: new AbortController().signal,
        requestRender: vi.fn(),
        requestAfterRender: vi.fn(),
        forceLayout: vi.fn().mockResolvedValue(undefined),
        getPlugin: vi.fn(),
        getPluginByName: vi.fn(),
        dispatchEvent: vi.fn(),
      } as any);

    it('should return same start when no rows are expanded', () => {
      const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
      plugin.attach(createMockGrid());
      expect(plugin.adjustVirtualStart(5, 100, 28)).toBe(5);
    });

    it('should return same start when expanded rows are after start', () => {
      const rows = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];
      const plugin = new MasterDetailPlugin({ detailHeight: 100, detailRenderer: () => 'test' });
      plugin.attach(createMockGrid(rows));

      plugin['expandedRows'].add(rows[3]);

      // Start is 2, expanded row is 3 (after start)
      expect(plugin.adjustVirtualStart(2, 56, 28)).toBe(2);
    });

    it('should extend start backwards when expanded row detail is still visible', () => {
      const rows = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];
      const plugin = new MasterDetailPlugin({ detailHeight: 100, detailRenderer: () => 'test' });
      plugin.attach(createMockGrid(rows));

      // Expand row at index 0
      plugin['expandedRows'].add(rows[0]);

      // Row 0 is at scroll position 0, with rowHeight 28, so row ends at 28
      // With detail height 100, detail ends at 28 + 100 = 128
      // If scrollTop is 50, detail is still visible (128 > 50)
      // Start calculated as index 1 (scrollTop 50 / rowHeight 28 = ~1.78 => floor to 1)
      // Should extend start to 0 to keep row 0 visible
      expect(plugin.adjustVirtualStart(1, 50, 28)).toBe(0);
    });

    it('should not extend start when detail has completely scrolled out', () => {
      const rows = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];
      const plugin = new MasterDetailPlugin({ detailHeight: 100, detailRenderer: () => 'test' });
      plugin.attach(createMockGrid(rows));

      // Expand row at index 0
      plugin['expandedRows'].add(rows[0]);

      // Row 0 ends at 28, detail ends at 128
      // If scrollTop is 150, detail has scrolled out (128 < 150)
      // Should NOT extend start
      expect(plugin.adjustVirtualStart(5, 150, 28)).toBe(5);
    });

    it('should return minimum start when multiple details are visible', () => {
      const rows = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
      const plugin = new MasterDetailPlugin({ detailHeight: 100, detailRenderer: () => 'test' });
      plugin.attach(createMockGrid(rows));

      // Expand rows 0 and 2
      plugin['expandedRows'].add(rows[0]);
      plugin['expandedRows'].add(rows[2]);

      // With cumulative heights:
      // Row 0: at scroll 0, ends at 28, detail ends at 128
      // Row 1: starts at 128 (after row 0 + detail), ends at 156
      // Row 2: starts at 156, ends at 184, detail ends at 284
      // scrollTop = 100: row 0 detail visible (128 > 100)
      // Start calculated as index 3 (100 / 28 = ~3.57 => floor to 3)
      // Should extend start to 0 (row 0 detail still visible)
      expect(plugin.adjustVirtualStart(3, 100, 28)).toBe(0);
    });

    it('should account for cumulative detail heights with multiple expanded rows', () => {
      const rows = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
      const plugin = new MasterDetailPlugin({ detailHeight: 100, detailRenderer: () => 'test' });
      plugin.attach(createMockGrid(rows));

      // Expand rows 0 and 1
      plugin['expandedRows'].add(rows[0]);
      plugin['expandedRows'].add(rows[1]);

      // With cumulative heights:
      // Row 0: at scroll 0, ends at 28, detail ends at 128
      // Row 1: starts at 128 (after row 0 + detail), ends at 156, detail ends at 256
      // scrollTop = 200: row 0 detail NOT visible (128 < 200), row 1 detail IS visible (256 > 200)
      // Start calculated as index 7 (200 / 28 = ~7.14 => floor to 7)
      // Should extend start to 1 (row 1's detail is still visible at scroll 200)
      expect(plugin.adjustVirtualStart(7, 200, 28)).toBe(1);
    });
  });
});
