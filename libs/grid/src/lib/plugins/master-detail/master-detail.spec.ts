import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  collapseDetailRow,
  createDetailElement,
  expandDetailRow,
  isDetailExpanded,
  toggleDetailRow,
} from './master-detail';
import { MasterDetailPlugin } from './MasterDetailPlugin';

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
      }) as any;

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
      }) as any;

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
      }) as any;

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

  describe('MasterDetailPlugin.processColumns', () => {
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
        icons: { expand: '▶', collapse: '▼' },
      }) as any;

    it('should return columns unchanged when no detailRenderer configured', () => {
      const plugin = new MasterDetailPlugin({});
      plugin.attach(createMockGrid());

      const columns = [{ field: 'name' }, { field: 'age' }];
      const result = plugin.processColumns(columns);

      expect(result).toEqual(columns);
    });

    it('should prepend expander column when detailRenderer is configured', () => {
      const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
      plugin.attach(createMockGrid());

      const columns = [{ field: 'name' }, { field: 'age' }];
      const result = plugin.processColumns(columns);

      expect(result.length).toBe(3); // expander + 2 original
      expect(result[0].field).toBe('__tbw_expander');
      expect(result[0].viewRenderer).toBeDefined();
      expect(result[1].field).toBe('name');
      expect(result[2].field).toBe('age');
    });

    it('should not add duplicate expander column', () => {
      const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
      plugin.attach(createMockGrid());

      const columns = [{ field: 'name' }, { field: 'age' }];
      const result1 = plugin.processColumns(columns);
      const result2 = plugin.processColumns(result1);

      // Should not add another expander column
      expect(result2.length).toBe(3);
      expect(result2[0].field).toBe('__tbw_expander');
    });

    it('should render toggle icon in expander column', () => {
      const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
      plugin.attach(createMockGrid([{ name: 'John' }]));

      const columns = [{ field: 'name' }, { field: 'age' }];
      const result = plugin.processColumns(columns);

      const element = result[0].viewRenderer!({
        value: undefined,
        row: { name: 'John' },
        rowIndex: 0,
        column: result[0],
        colIndex: 0,
      });

      expect(element).toBeInstanceOf(HTMLElement);
      const container = element as HTMLElement;
      expect(container.className).toContain('expander-cell');
      expect(container.querySelector('.master-detail-toggle')).not.toBeNull();
    });

    it('should not affect original column renderers', () => {
      const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
      plugin.attach(createMockGrid([{ name: 'Jane' }]));

      const originalRenderer = (ctx: any) => {
        const span = document.createElement('span');
        span.textContent = `Name: ${ctx.value}`;
        span.className = 'custom-content';
        return span;
      };

      const columns = [{ field: 'name', viewRenderer: originalRenderer }, { field: 'age' }];
      const result = plugin.processColumns(columns);

      // Original column is now at index 1
      const element = result[1].viewRenderer!({
        value: 'Jane',
        row: { name: 'Jane' },
        rowIndex: 0,
        column: result[1],
        colIndex: 1,
      }) as HTMLElement;

      expect(element.className).toBe('custom-content');
      expect(element.textContent).toBe('Name: Jane');
    });

    it('should set aria attributes on toggle', () => {
      const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
      plugin.attach(createMockGrid([{ name: 'Test' }]));

      const columns = [{ field: 'name' }];
      const result = plugin.processColumns(columns);

      // Expander column is at index 0
      const element = result[0].viewRenderer!({
        value: undefined,
        row: { name: 'Test' },
        rowIndex: 0,
        column: result[0],
        colIndex: 0,
      }) as HTMLElement;

      const toggle = element.querySelector('.master-detail-toggle')!;
      expect(toggle.getAttribute('role')).toBe('button');
      expect(toggle.getAttribute('tabindex')).toBe('0');
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(toggle.getAttribute('aria-label')).toBe('Expand details');
    });

    it('should show expanded state in toggle', () => {
      const row = { name: 'Expanded' };
      const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
      plugin.attach(createMockGrid([row]));

      // Manually expand the row
      plugin['expandedRows'].add(row);

      const columns = [{ field: 'name' }];
      const result = plugin.processColumns(columns);

      // Expander column is at index 0
      const element = result[0].viewRenderer!({
        value: undefined,
        row,
        rowIndex: 0,
        column: result[0],
        colIndex: 0,
      }) as HTMLElement;

      const toggle = element.querySelector('.master-detail-toggle')!;
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(toggle.getAttribute('aria-label')).toBe('Collapse details');
    });

    it('should emit detail-expand event when toggle is clicked', () => {
      const row = { name: 'Test' };
      const mockGrid = createMockGrid([row]);
      const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
      plugin.attach(mockGrid);

      const columns = [{ field: 'name' }];
      const result = plugin.processColumns(columns);

      // Expander column is at index 0
      const cellEl = result[0].viewRenderer!({
        value: undefined,
        row,
        rowIndex: 0,
        column: result[0],
        colIndex: 0,
      }) as HTMLElement;

      const toggle = cellEl.querySelector('.master-detail-toggle')!;
      // Simulate click via onCellClick hook (matches how the grid routes events)
      plugin.onCellClick({
        rowIndex: 0,
        colIndex: 0,
        field: '__tbw_expander',
        value: undefined,
        row,
        cellEl,
        originalEvent: { target: toggle } as unknown as MouseEvent,
      });

      expect(mockGrid.dispatchEvent).toHaveBeenCalled();
      const dispatchedEvent = mockGrid.dispatchEvent.mock.calls[0][0];
      expect(dispatchedEvent.type).toBe('detail-expand');
      expect(dispatchedEvent.detail.row).toBe(row);
      expect(dispatchedEvent.detail.expanded).toBe(true);
    });
  });

  describe('MasterDetailPlugin.onRowClick', () => {
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
      }) as any;

    it('should not toggle when expandOnRowClick is false', () => {
      const row = { name: 'Test' };
      const mockGrid = createMockGrid([row]);
      const plugin = new MasterDetailPlugin({
        detailRenderer: () => 'test',
        expandOnRowClick: false,
      });
      plugin.attach(mockGrid);

      plugin.onRowClick({
        rowIndex: 0,
        row,
        rowEl: document.createElement('div'),
        originalEvent: new MouseEvent('click'),
      });

      expect(plugin['expandedRows'].has(row)).toBe(false);
      expect(mockGrid.requestRender).not.toHaveBeenCalled();
    });

    it('should not toggle when no detailRenderer configured', () => {
      const row = { name: 'Test' };
      const mockGrid = createMockGrid([row]);
      const plugin = new MasterDetailPlugin({ expandOnRowClick: true });
      plugin.attach(mockGrid);

      plugin.onRowClick({
        rowIndex: 0,
        row,
        rowEl: document.createElement('div'),
        originalEvent: new MouseEvent('click'),
      });

      expect(plugin['expandedRows'].has(row)).toBe(false);
      expect(mockGrid.requestRender).not.toHaveBeenCalled();
    });

    it('should toggle row and emit event when expandOnRowClick is true', () => {
      const row = { name: 'Test' };
      const mockGrid = createMockGrid([row]);
      const plugin = new MasterDetailPlugin({
        detailRenderer: () => 'test',
        expandOnRowClick: true,
      });
      plugin.attach(mockGrid);

      plugin.onRowClick({
        rowIndex: 0,
        row,
        rowEl: document.createElement('div'),
        originalEvent: new MouseEvent('click'),
      });

      expect(plugin['expandedRows'].has(row)).toBe(true);
      expect(mockGrid.requestRender).toHaveBeenCalled();
      expect(mockGrid.dispatchEvent).toHaveBeenCalled();

      const dispatchedEvent = mockGrid.dispatchEvent.mock.calls[0][0];
      expect(dispatchedEvent.type).toBe('detail-expand');
      expect(dispatchedEvent.detail.expanded).toBe(true);
    });

    it('should collapse when clicking expanded row', () => {
      const row = { name: 'Test' };
      const mockGrid = createMockGrid([row]);
      const plugin = new MasterDetailPlugin({
        detailRenderer: () => 'test',
        expandOnRowClick: true,
      });
      plugin.attach(mockGrid);

      // First click expands
      plugin.onRowClick({
        rowIndex: 0,
        row,
        rowEl: document.createElement('div'),
        originalEvent: new MouseEvent('click'),
      });

      // Second click collapses
      plugin.onRowClick({
        rowIndex: 0,
        row,
        rowEl: document.createElement('div'),
        originalEvent: new MouseEvent('click'),
      });

      expect(plugin['expandedRows'].has(row)).toBe(false);
      const lastEvent = mockGrid.dispatchEvent.mock.calls[1][0];
      expect(lastEvent.detail.expanded).toBe(false);
    });
  });

  describe('MasterDetailPlugin public API', () => {
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
      }) as any;

    describe('expand', () => {
      it('should expand a row by index', () => {
        const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
        const mockGrid = createMockGrid(rows);
        const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
        plugin.attach(mockGrid);

        plugin.expand(1);

        expect(plugin['expandedRows'].has(rows[1])).toBe(true);
        expect(mockGrid.requestRender).toHaveBeenCalled();
      });

      it('should do nothing for invalid row index', () => {
        const rows = [{ id: 1 }];
        const mockGrid = createMockGrid(rows);
        const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
        plugin.attach(mockGrid);

        plugin.expand(99);

        expect(plugin['expandedRows'].size).toBe(0);
      });
    });

    describe('collapse', () => {
      it('should collapse an expanded row by index', () => {
        const rows = [{ id: 1 }, { id: 2 }];
        const mockGrid = createMockGrid(rows);
        const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
        plugin.attach(mockGrid);

        plugin['expandedRows'].add(rows[0]);
        plugin.collapse(0);

        expect(plugin['expandedRows'].has(rows[0])).toBe(false);
        expect(mockGrid.requestRender).toHaveBeenCalled();
      });

      it('should do nothing for invalid row index', () => {
        const rows = [{ id: 1 }];
        const mockGrid = createMockGrid(rows);
        const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
        plugin.attach(mockGrid);

        plugin.collapse(99);

        expect(mockGrid.requestRender).not.toHaveBeenCalled();
      });
    });

    describe('toggle', () => {
      it('should toggle row expansion', () => {
        const rows = [{ id: 1 }];
        const mockGrid = createMockGrid(rows);
        const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
        plugin.attach(mockGrid);

        plugin.toggle(0);
        expect(plugin['expandedRows'].has(rows[0])).toBe(true);

        plugin.toggle(0);
        expect(plugin['expandedRows'].has(rows[0])).toBe(false);
      });

      it('should do nothing for invalid row index', () => {
        const rows = [{ id: 1 }];
        const mockGrid = createMockGrid(rows);
        const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
        plugin.attach(mockGrid);

        plugin.toggle(99);

        expect(plugin['expandedRows'].size).toBe(0);
      });
    });

    describe('isExpanded', () => {
      it('should return true for expanded row', () => {
        const rows = [{ id: 1 }, { id: 2 }];
        const mockGrid = createMockGrid(rows);
        const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
        plugin.attach(mockGrid);

        plugin['expandedRows'].add(rows[0]);

        expect(plugin.isExpanded(0)).toBe(true);
        expect(plugin.isExpanded(1)).toBe(false);
      });

      it('should return false for invalid row index', () => {
        const rows = [{ id: 1 }];
        const mockGrid = createMockGrid(rows);
        const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
        plugin.attach(mockGrid);

        expect(plugin.isExpanded(99)).toBe(false);
      });
    });

    describe('expandAll', () => {
      it('should expand all rows', () => {
        const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
        const mockGrid = createMockGrid(rows);
        const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
        plugin.attach(mockGrid);

        plugin.expandAll();

        expect(plugin['expandedRows'].size).toBe(3);
        expect(plugin.isExpanded(0)).toBe(true);
        expect(plugin.isExpanded(1)).toBe(true);
        expect(plugin.isExpanded(2)).toBe(true);
        expect(mockGrid.requestRender).toHaveBeenCalled();
      });
    });

    describe('collapseAll', () => {
      it('should collapse all rows', () => {
        const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
        const mockGrid = createMockGrid(rows);
        const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
        plugin.attach(mockGrid);

        plugin['expandedRows'].add(rows[0]);
        plugin['expandedRows'].add(rows[1]);
        plugin['expandedRows'].add(rows[2]);

        plugin.collapseAll();

        expect(plugin['expandedRows'].size).toBe(0);
        expect(mockGrid.requestRender).toHaveBeenCalled();
      });
    });

    describe('getExpandedRows', () => {
      it('should return indices of expanded rows', () => {
        const rows = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
        const mockGrid = createMockGrid(rows);
        const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
        plugin.attach(mockGrid);

        plugin['expandedRows'].add(rows[0]);
        plugin['expandedRows'].add(rows[2]);

        const result = plugin.getExpandedRows();

        expect(result).toContain(0);
        expect(result).toContain(2);
        expect(result.length).toBe(2);
      });

      it('should return empty array when no rows expanded', () => {
        const rows = [{ id: 1 }];
        const mockGrid = createMockGrid(rows);
        const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
        plugin.attach(mockGrid);

        expect(plugin.getExpandedRows()).toEqual([]);
      });
    });

    describe('getDetailElement', () => {
      it('should return detail element for expanded row', () => {
        const rows = [{ id: 1 }, { id: 2 }];
        const mockGrid = createMockGrid(rows);
        const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
        plugin.attach(mockGrid);

        const detailEl = document.createElement('div');
        plugin['expandedRows'].add(rows[0]);
        plugin['detailElements'].set(rows[0], detailEl);

        expect(plugin.getDetailElement(0)).toBe(detailEl);
      });

      it('should return undefined for non-expanded row', () => {
        const rows = [{ id: 1 }];
        const mockGrid = createMockGrid(rows);
        const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
        plugin.attach(mockGrid);

        expect(plugin.getDetailElement(0)).toBeUndefined();
      });

      it('should return undefined for invalid row index', () => {
        const rows = [{ id: 1 }];
        const mockGrid = createMockGrid(rows);
        const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
        plugin.attach(mockGrid);

        expect(plugin.getDetailElement(99)).toBeUndefined();
      });
    });

    describe('detach', () => {
      it('should clear all internal state', () => {
        const rows = [{ id: 1 }, { id: 2 }];
        const mockGrid = createMockGrid(rows);
        const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
        plugin.attach(mockGrid);

        plugin['expandedRows'].add(rows[0]);
        plugin['detailElements'].set(rows[0], document.createElement('div'));

        plugin.detach();

        expect(plugin['expandedRows'].size).toBe(0);
        expect(plugin['detailElements'].size).toBe(0);
      });
    });
  });

  describe('MasterDetailPlugin.onScrollRender', () => {
    const createMockGridWithShadowRoot = (rows: any[] = []) => {
      const shadowRoot = document.createElement('div') as unknown as ShadowRoot;
      return {
        shadowRoot,
        rows,
        columns: [{ field: 'name' }],
        gridConfig: {},
        disconnectSignal: new AbortController().signal,
        requestRender: vi.fn(),
        requestAfterRender: vi.fn(),
        forceLayout: vi.fn().mockResolvedValue(undefined),
        getPlugin: vi.fn(),
        getPluginByName: vi.fn(),
        dispatchEvent: vi.fn(),
      } as any;
    };

    it('should do nothing when no detailRenderer configured', () => {
      const plugin = new MasterDetailPlugin({});
      plugin.attach(createMockGridWithShadowRoot());

      // Should not throw
      plugin.onScrollRender();
    });

    it('should do nothing when no rows are expanded', () => {
      const plugin = new MasterDetailPlugin({ detailRenderer: () => 'test' });
      plugin.attach(createMockGridWithShadowRoot());

      // Should not throw
      plugin.onScrollRender();
    });
  });

  describe('MasterDetailPlugin Light DOM Parsing', () => {
    const createMockGridElement = () => {
      // Create a real container element that can hold light DOM children
      // We need a real DOM element for querySelector to work
      const gridEl = document.createElement('div');

      // Add mock grid properties as a plain object that we'll mix in
      Object.defineProperty(gridEl, 'rows', { value: [], writable: true });
      Object.defineProperty(gridEl, 'columns', { value: [{ field: 'name' }], writable: true });
      Object.defineProperty(gridEl, 'gridConfig', { value: {}, writable: true });
      Object.defineProperty(gridEl, 'disconnectSignal', { value: new AbortController().signal, writable: true });
      Object.defineProperty(gridEl, 'requestRender', { value: vi.fn(), writable: true });
      Object.defineProperty(gridEl, 'requestAfterRender', { value: vi.fn(), writable: true });
      Object.defineProperty(gridEl, 'forceLayout', { value: vi.fn().mockResolvedValue(undefined), writable: true });
      Object.defineProperty(gridEl, 'getPlugin', { value: vi.fn(), writable: true });
      Object.defineProperty(gridEl, 'getPluginByName', { value: vi.fn(), writable: true });

      return gridEl;
    };

    it('should parse tbw-grid-detail element innerHTML as template', () => {
      const gridEl = createMockGridElement();
      const detailEl = document.createElement('tbw-grid-detail');
      detailEl.innerHTML = '<div>Name: {{ row.name }}</div>';
      gridEl.appendChild(detailEl);

      const plugin = new MasterDetailPlugin({});
      plugin.attach(gridEl as any);

      expect(plugin['config'].detailRenderer).toBeDefined();
    });

    it('should evaluate template expressions with row data', () => {
      const gridEl = createMockGridElement();
      const detailEl = document.createElement('tbw-grid-detail');
      detailEl.innerHTML = '<div>Name: {{ row.name }}, Age: {{ row.age }}</div>';
      gridEl.appendChild(detailEl);

      const plugin = new MasterDetailPlugin({});
      plugin.attach(gridEl as any);

      const renderer = plugin['config'].detailRenderer!;
      const result = renderer({ name: 'John', age: 30 }, 0);

      expect(result).toBe('<div>Name: John, Age: 30</div>');
    });

    it('should parse animation attribute', () => {
      const gridEl = createMockGridElement();
      const detailEl = document.createElement('tbw-grid-detail');
      detailEl.setAttribute('animation', 'fade');
      detailEl.innerHTML = '<div>Detail</div>';
      gridEl.appendChild(detailEl);

      const plugin = new MasterDetailPlugin({});
      plugin.attach(gridEl as any);

      expect(plugin['config'].animation).toBe('fade');
    });

    it('should parse animation="false" as disabled', () => {
      const gridEl = createMockGridElement();
      const detailEl = document.createElement('tbw-grid-detail');
      detailEl.setAttribute('animation', 'false');
      detailEl.innerHTML = '<div>Detail</div>';
      gridEl.appendChild(detailEl);

      const plugin = new MasterDetailPlugin({});
      plugin.attach(gridEl as any);

      expect(plugin['config'].animation).toBe(false);
    });

    it('should parse show-expand-column attribute', () => {
      const gridEl = createMockGridElement();
      const detailEl = document.createElement('tbw-grid-detail');
      detailEl.setAttribute('show-expand-column', 'false');
      detailEl.innerHTML = '<div>Detail</div>';
      gridEl.appendChild(detailEl);

      const plugin = new MasterDetailPlugin({});
      plugin.attach(gridEl as any);

      expect(plugin['config'].showExpandColumn).toBe(false);
    });

    it('should parse expand-on-row-click attribute', () => {
      const gridEl = createMockGridElement();
      const detailEl = document.createElement('tbw-grid-detail');
      detailEl.setAttribute('expand-on-row-click', 'true');
      detailEl.innerHTML = '<div>Detail</div>';
      gridEl.appendChild(detailEl);

      const plugin = new MasterDetailPlugin({});
      plugin.attach(gridEl as any);

      expect(plugin['config'].expandOnRowClick).toBe(true);
    });

    it('should parse collapse-on-click-outside attribute', () => {
      const gridEl = createMockGridElement();
      const detailEl = document.createElement('tbw-grid-detail');
      detailEl.setAttribute('collapse-on-click-outside', 'true');
      detailEl.innerHTML = '<div>Detail</div>';
      gridEl.appendChild(detailEl);

      const plugin = new MasterDetailPlugin({});
      plugin.attach(gridEl as any);

      expect(plugin['config'].collapseOnClickOutside).toBe(true);
    });

    it('should parse numeric height attribute', () => {
      const gridEl = createMockGridElement();
      const detailEl = document.createElement('tbw-grid-detail');
      detailEl.setAttribute('height', '200');
      detailEl.innerHTML = '<div>Detail</div>';
      gridEl.appendChild(detailEl);

      const plugin = new MasterDetailPlugin({});
      plugin.attach(gridEl as any);

      expect(plugin['config'].detailHeight).toBe(200);
    });

    it('should parse height="auto" attribute', () => {
      const gridEl = createMockGridElement();
      const detailEl = document.createElement('tbw-grid-detail');
      detailEl.setAttribute('height', 'auto');
      detailEl.innerHTML = '<div>Detail</div>';
      gridEl.appendChild(detailEl);

      const plugin = new MasterDetailPlugin({});
      plugin.attach(gridEl as any);

      expect(plugin['config'].detailHeight).toBe('auto');
    });

    it('should not override programmatic detailRenderer', () => {
      const gridEl = createMockGridElement();
      const detailEl = document.createElement('tbw-grid-detail');
      detailEl.innerHTML = '<div>Light DOM Template</div>';
      gridEl.appendChild(detailEl);

      const programmaticRenderer = () => 'Programmatic';
      const plugin = new MasterDetailPlugin({ detailRenderer: programmaticRenderer });
      plugin.attach(gridEl as any);

      expect(plugin['config'].detailRenderer).toBe(programmaticRenderer);
    });

    it('should sanitize potentially unsafe content', () => {
      const gridEl = createMockGridElement();
      const detailEl = document.createElement('tbw-grid-detail');
      detailEl.innerHTML = '<div>{{ row.name }}</div><script>alert("xss")</script>';
      gridEl.appendChild(detailEl);

      const plugin = new MasterDetailPlugin({});
      plugin.attach(gridEl as any);

      const renderer = plugin['config'].detailRenderer!;
      const result = renderer({ name: 'John' }, 0);

      // Script tags should be removed by sanitization
      expect(result).not.toContain('<script>');
      expect(result).toContain('John');
    });

    it('should handle empty tbw-grid-detail element', () => {
      const gridEl = createMockGridElement();
      const detailEl = document.createElement('tbw-grid-detail');
      detailEl.innerHTML = '';
      gridEl.appendChild(detailEl);

      const plugin = new MasterDetailPlugin({});
      plugin.attach(gridEl as any);

      // Should not create a renderer for empty content
      expect(plugin['config'].detailRenderer).toBeUndefined();
    });

    it('should work without tbw-grid-detail element', () => {
      const gridEl = createMockGridElement();
      // No detail element added

      const plugin = new MasterDetailPlugin({});
      plugin.attach(gridEl as any);

      // Should use default config without renderer
      expect(plugin['config'].detailRenderer).toBeUndefined();
      expect(plugin['config'].animation).toBe('slide');
    });

    it('should defer to framework adapter when present', () => {
      const gridEl = createMockGridElement();
      const detailEl = document.createElement('tbw-grid-detail');
      detailEl.innerHTML = '<ng-template>Angular template</ng-template>';
      gridEl.appendChild(detailEl);

      const adapterRenderer = vi.fn(() => 'Adapter result');
      (gridEl as any).__frameworkAdapter = {
        parseDetailElement: vi.fn(() => adapterRenderer),
      };

      const plugin = new MasterDetailPlugin({});
      plugin.attach(gridEl as any);

      expect((gridEl as any).__frameworkAdapter.parseDetailElement).toHaveBeenCalledWith(detailEl);
      expect(plugin['config'].detailRenderer).toBe(adapterRenderer);
    });
  });
});
