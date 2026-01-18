import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ColumnConfig } from '../../core/types';
import { PinnedRowsPlugin } from './PinnedRowsPlugin';
import type { AggregationRowConfig, PinnedRowsPanel } from './types';

/**
 * Unit tests for PinnedRowsPlugin class
 *
 * Tests the plugin lifecycle, public API, and configuration handling.
 * Pure function tests are in pinned-rows.spec.ts
 */
describe('PinnedRowsPlugin', () => {
  // Mock grid element (light DOM)
  function createMockGrid(
    opts: {
      rows?: unknown[];
      columns?: ColumnConfig[];
      visibleColumns?: ColumnConfig[];
      selectionState?: { selected: Set<number> } | null;
      filterState?: { cachedResult: unknown[] | null } | null;
    } = {},
  ): HTMLElement {
    const grid = document.createElement('div');

    // Create grid structure (light DOM - directly in element)
    const container = document.createElement('div');
    container.className = 'tbw-grid-container';

    const scrollArea = document.createElement('div');
    scrollArea.className = 'tbw-scroll-area';

    const header = document.createElement('div');
    header.className = 'header';

    scrollArea.appendChild(header);
    container.appendChild(scrollArea);
    grid.appendChild(container);

    // Attach mock properties
    Object.defineProperty(grid, 'rows', { get: () => opts.rows ?? [], configurable: true });
    Object.defineProperty(grid, 'columns', { get: () => opts.columns ?? [], configurable: true });
    Object.defineProperty(grid, '_visibleColumns', {
      get: () => opts.visibleColumns ?? opts.columns ?? [],
      configurable: true,
    });
    Object.defineProperty(grid, 'getPluginState', {
      value: (name: string) => {
        if (name === 'selection') return opts.selectionState ?? null;
        if (name === 'filtering') return opts.filterState ?? null;
        return null;
      },
      configurable: true,
    });

    return grid;
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('constructor and defaults', () => {
    it('should have correct name and version', () => {
      const plugin = new PinnedRowsPlugin({});

      expect(plugin.name).toBe('pinnedRows');
      expect(plugin.version).toBeTruthy();
    });

    it('should apply default configuration', () => {
      const plugin = new PinnedRowsPlugin({});
      const grid = createMockGrid();

      plugin.attach(grid);

      expect(plugin.config.position).toBe('bottom');
      expect(plugin.config.showRowCount).toBe(true);
      expect(plugin.config.showSelectedCount).toBe(true);
      expect(plugin.config.showFilteredCount).toBe(true);
    });

    it('should merge user config with defaults', () => {
      const plugin = new PinnedRowsPlugin({
        position: 'top',
        showRowCount: false,
      });
      const grid = createMockGrid();

      plugin.attach(grid);

      expect(plugin.config.position).toBe('top');
      expect(plugin.config.showRowCount).toBe(false);
      expect(plugin.config.showSelectedCount).toBe(true);
    });
  });

  describe('lifecycle', () => {
    it('should attach to grid', () => {
      const plugin = new PinnedRowsPlugin({});
      const grid = createMockGrid();

      plugin.attach(grid);

      expect(plugin.grid).toBe(grid);
    });

    it('should detach and clean up DOM elements', () => {
      const plugin = new PinnedRowsPlugin({});
      const grid = createMockGrid({ rows: [{ id: 1 }] });

      plugin.attach(grid);
      plugin.afterRender();

      expect(grid.querySelector('.tbw-footer')).not.toBeNull();

      plugin.detach();

      expect(grid.querySelector('.tbw-footer')).toBeNull();
      expect(grid.querySelector('.tbw-pinned-rows')).toBeNull();
    });
  });

  describe('afterRender', () => {
    it('should render info bar at bottom by default', () => {
      const plugin = new PinnedRowsPlugin({});
      const grid = createMockGrid({ rows: [{ id: 1 }, { id: 2 }] });

      plugin.attach(grid);
      plugin.afterRender();

      const footer = grid.querySelector('.tbw-footer');
      expect(footer).not.toBeNull();
      expect(footer?.querySelector('.tbw-pinned-rows')).not.toBeNull();
    });

    it('should render info bar at top when position is top', () => {
      const plugin = new PinnedRowsPlugin({ position: 'top' });
      const grid = createMockGrid({ rows: [{ id: 1 }] });

      plugin.attach(grid);
      plugin.afterRender();

      const scrollArea = grid.querySelector('.tbw-scroll-area');
      expect(scrollArea?.firstElementChild?.classList.contains('tbw-pinned-rows')).toBe(true);
    });

    it('should show row count in info bar', () => {
      const plugin = new PinnedRowsPlugin({});
      const grid = createMockGrid({ rows: [{ id: 1 }, { id: 2 }, { id: 3 }] });

      plugin.attach(grid);
      plugin.afterRender();

      const rowCount = grid.querySelector('.tbw-status-panel-row-count');
      expect(rowCount?.textContent).toBe('Total: 3 rows');
    });

    it('should show selected count when rows are selected', () => {
      const plugin = new PinnedRowsPlugin({ showSelectedCount: true });
      const grid = createMockGrid({
        rows: [{ id: 1 }, { id: 2 }],
        selectionState: { selected: new Set([0, 1]) },
      });

      plugin.attach(grid);
      plugin.afterRender();

      const selectedCount = grid.querySelector('.tbw-status-panel-selected-count');
      expect(selectedCount?.textContent).toBe('Selected: 2');
    });

    it('should show filtered count when filter is active', () => {
      const plugin = new PinnedRowsPlugin({ showFilteredCount: true });
      const grid = createMockGrid({
        rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
        filterState: { cachedResult: [{ id: 1 }] },
      });

      plugin.attach(grid);
      plugin.afterRender();

      const filteredCount = grid.querySelector('.tbw-status-panel-filtered-count');
      expect(filteredCount?.textContent).toBe('Filtered: 1');
    });

    it('should not show filtered count when equal to total', () => {
      const plugin = new PinnedRowsPlugin({ showFilteredCount: true });
      const grid = createMockGrid({
        rows: [{ id: 1 }, { id: 2 }],
        filterState: { cachedResult: [{ id: 1 }, { id: 2 }] },
      });

      plugin.attach(grid);
      plugin.afterRender();

      const filteredCount = grid.querySelector('.tbw-status-panel-filtered-count');
      expect(filteredCount).toBeNull();
    });

    it('should render top aggregation rows', () => {
      const columns = [{ field: 'value' }];
      const plugin = new PinnedRowsPlugin({
        aggregationRows: [{ id: 'header-row', position: 'top', cells: { value: 'Header' } }],
      });
      const grid = createMockGrid({
        rows: [{ value: 100 }],
        columns,
        visibleColumns: columns,
      });

      plugin.attach(grid);
      plugin.afterRender();

      const topContainer = grid.querySelector('.tbw-aggregation-rows-top');
      expect(topContainer).not.toBeNull();
      expect(topContainer?.querySelector('[data-aggregation-id="header-row"]')).not.toBeNull();
    });

    it('should render bottom aggregation rows', () => {
      const columns = [{ field: 'amount' }];
      const plugin = new PinnedRowsPlugin({
        aggregationRows: [{ id: 'totals', position: 'bottom', aggregators: { amount: 'sum' } }],
      });
      const grid = createMockGrid({
        rows: [{ amount: 100 }, { amount: 200 }],
        columns,
        visibleColumns: columns,
      });

      plugin.attach(grid);
      plugin.afterRender();

      const footer = grid.querySelector('.tbw-footer');
      const aggRow = footer?.querySelector('[data-aggregation-id="totals"]');
      expect(aggRow).not.toBeNull();
      expect(aggRow?.querySelector('[data-field="amount"]')?.textContent).toBe('300');
    });

    it('should update info bar on re-render', () => {
      const plugin = new PinnedRowsPlugin({});
      const grid = createMockGrid({ rows: [{ id: 1 }] });

      plugin.attach(grid);
      plugin.afterRender();

      expect(grid.querySelector('.tbw-status-panel-row-count')?.textContent).toBe('Total: 1 rows');

      // Simulate row change
      Object.defineProperty(grid, 'rows', { get: () => [{ id: 1 }, { id: 2 }, { id: 3 }] });
      plugin.afterRender();

      expect(grid.querySelector('.tbw-status-panel-row-count')?.textContent).toBe('Total: 3 rows');
    });

    it('should clean up top aggregation when removed', () => {
      const columns = [{ field: 'value' }];
      const plugin = new PinnedRowsPlugin({
        aggregationRows: [{ id: 'top-row', position: 'top', cells: { value: 'X' } }],
      });
      const grid = createMockGrid({
        rows: [{ value: 1 }],
        columns,
        visibleColumns: columns,
      });

      plugin.attach(grid);
      plugin.afterRender();

      expect(grid.querySelector('.tbw-aggregation-rows-top')).not.toBeNull();

      // Remove aggregation rows
      plugin.config.aggregationRows = [];
      plugin.afterRender();

      expect(grid.querySelector('.tbw-aggregation-rows-top')).toBeNull();
    });

    it('should not render footer when no content', () => {
      const plugin = new PinnedRowsPlugin({
        showRowCount: false,
        showSelectedCount: false,
        showFilteredCount: false,
      });
      const grid = createMockGrid({ rows: [] });

      plugin.attach(grid);
      plugin.afterRender();

      expect(grid.querySelector('.tbw-footer')).toBeNull();
    });
  });

  describe('public API', () => {
    describe('refresh', () => {
      it('should request render', () => {
        const plugin = new PinnedRowsPlugin({});
        const grid = createMockGrid();
        plugin.attach(grid);

        const requestRenderSpy = vi.spyOn(plugin, 'requestRender');
        plugin.refresh();

        expect(requestRenderSpy).toHaveBeenCalled();
      });
    });

    describe('getContext', () => {
      it('should return current context', () => {
        const plugin = new PinnedRowsPlugin({});
        const columns = [{ field: 'id' }];
        const grid = createMockGrid({
          rows: [{ id: 1 }, { id: 2 }],
          columns,
        });

        plugin.attach(grid);

        const context = plugin.getContext();
        expect(context.totalRows).toBe(2);
        expect(context.filteredRows).toBe(2);
        expect(context.selectedRows).toBe(0);
      });

      it('should include selection state', () => {
        const plugin = new PinnedRowsPlugin({});
        const grid = createMockGrid({
          rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
          selectionState: { selected: new Set([0, 2]) },
        });

        plugin.attach(grid);

        const context = plugin.getContext();
        expect(context.selectedRows).toBe(2);
      });

      it('should include filter state', () => {
        const plugin = new PinnedRowsPlugin({});
        const grid = createMockGrid({
          rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
          filterState: { cachedResult: [{ id: 2 }] },
        });

        plugin.attach(grid);

        const context = plugin.getContext();
        expect(context.totalRows).toBe(3);
        expect(context.filteredRows).toBe(1);
      });
    });

    describe('addPanel', () => {
      it('should add custom panel and request render', () => {
        const plugin = new PinnedRowsPlugin({});
        const grid = createMockGrid();
        plugin.attach(grid);

        const requestRenderSpy = vi.spyOn(plugin, 'requestRender');
        const panel: PinnedRowsPanel = {
          id: 'custom',
          position: 'center',
          render: () => 'Custom Panel',
        };

        plugin.addPanel(panel);

        expect(plugin.config.customPanels).toContain(panel);
        expect(requestRenderSpy).toHaveBeenCalled();
      });

      it('should initialize customPanels array if not present', () => {
        const plugin = new PinnedRowsPlugin({});
        const grid = createMockGrid();
        plugin.attach(grid);

        expect(plugin.config.customPanels).toBeUndefined();

        plugin.addPanel({ id: 'test', position: 'left', render: () => 'Test' });

        expect(plugin.config.customPanels).toBeDefined();
        expect(plugin.config.customPanels?.length).toBe(1);
      });
    });

    describe('removePanel', () => {
      it('should remove panel by id and request render', () => {
        const panel: PinnedRowsPanel = {
          id: 'to-remove',
          position: 'right',
          render: () => 'Remove me',
        };
        const plugin = new PinnedRowsPlugin({ customPanels: [panel] });
        const grid = createMockGrid();
        plugin.attach(grid);

        const requestRenderSpy = vi.spyOn(plugin, 'requestRender');
        plugin.removePanel('to-remove');

        expect(plugin.config.customPanels?.find((p) => p.id === 'to-remove')).toBeUndefined();
        expect(requestRenderSpy).toHaveBeenCalled();
      });

      it('should do nothing if customPanels is undefined', () => {
        const plugin = new PinnedRowsPlugin({});
        const grid = createMockGrid();
        plugin.attach(grid);

        const requestRenderSpy = vi.spyOn(plugin, 'requestRender');
        plugin.removePanel('non-existent');

        expect(requestRenderSpy).not.toHaveBeenCalled();
      });
    });

    describe('addAggregationRow', () => {
      it('should add aggregation row and request render', () => {
        const plugin = new PinnedRowsPlugin({});
        const grid = createMockGrid();
        plugin.attach(grid);

        const requestRenderSpy = vi.spyOn(plugin, 'requestRender');
        const row: AggregationRowConfig = { id: 'totals', aggregators: { amount: 'sum' } };

        plugin.addAggregationRow(row);

        expect(plugin.config.aggregationRows).toContain(row);
        expect(requestRenderSpy).toHaveBeenCalled();
      });

      it('should initialize aggregationRows array if not present', () => {
        const plugin = new PinnedRowsPlugin({});
        const grid = createMockGrid();
        plugin.attach(grid);

        expect(plugin.config.aggregationRows).toBeUndefined();

        plugin.addAggregationRow({ id: 'test' });

        expect(plugin.config.aggregationRows).toBeDefined();
        expect(plugin.config.aggregationRows?.length).toBe(1);
      });
    });

    describe('removeAggregationRow', () => {
      it('should remove aggregation row by id and request render', () => {
        const row: AggregationRowConfig = { id: 'remove-me' };
        const plugin = new PinnedRowsPlugin({ aggregationRows: [row] });
        const grid = createMockGrid();
        plugin.attach(grid);

        const requestRenderSpy = vi.spyOn(plugin, 'requestRender');
        plugin.removeAggregationRow('remove-me');

        expect(plugin.config.aggregationRows?.find((r) => r.id === 'remove-me')).toBeUndefined();
        expect(requestRenderSpy).toHaveBeenCalled();
      });

      it('should do nothing if aggregationRows is undefined', () => {
        const plugin = new PinnedRowsPlugin({});
        const grid = createMockGrid();
        plugin.attach(grid);

        const requestRenderSpy = vi.spyOn(plugin, 'requestRender');
        plugin.removeAggregationRow('non-existent');

        expect(requestRenderSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle missing container gracefully', () => {
      const plugin = new PinnedRowsPlugin({});
      const grid = document.createElement('div'); // No container

      plugin.attach(grid);

      // Should not throw
      expect(() => plugin.afterRender()).not.toThrow();
    });

    it('should handle getPluginState throwing', () => {
      const plugin = new PinnedRowsPlugin({});
      const grid = createMockGrid({ rows: [{ id: 1 }] });
      Object.defineProperty(grid, 'getPluginState', {
        value: () => {
          throw new Error('Plugin error');
        },
        configurable: true,
      });

      plugin.attach(grid);

      // Should not throw
      expect(() => plugin.afterRender()).not.toThrow();
    });

    it('should handle empty container', () => {
      const plugin = new PinnedRowsPlugin({});
      const grid = document.createElement('div');
      // Empty element - no container

      plugin.attach(grid);

      expect(() => plugin.afterRender()).not.toThrow();
    });

    it('should render correctly when position is changed', () => {
      // Test rendering at top with fresh plugin
      const pluginTop = new PinnedRowsPlugin({ position: 'top' });
      const grid1 = createMockGrid({ rows: [{ id: 1 }] });

      pluginTop.attach(grid1);
      pluginTop.afterRender();

      const scrollArea1 = grid1.querySelector('.tbw-scroll-area');
      expect(scrollArea1?.querySelector('.tbw-pinned-rows')).not.toBeNull();

      // Test rendering at bottom with fresh plugin
      const pluginBottom = new PinnedRowsPlugin({ position: 'bottom' });
      const grid2 = createMockGrid({ rows: [{ id: 1 }] });

      pluginBottom.attach(grid2);
      pluginBottom.afterRender();

      expect(grid2.querySelector('.tbw-footer .tbw-pinned-rows')).not.toBeNull();
    });
  });

  describe('styles', () => {
    it('should have styles property', () => {
      const plugin = new PinnedRowsPlugin({});

      expect(plugin.styles).toBeDefined();
      expect(typeof plugin.styles).toBe('string');
    });
  });
});
