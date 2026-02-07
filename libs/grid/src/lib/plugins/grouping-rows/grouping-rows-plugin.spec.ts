/**
 * @vitest-environment happy-dom
 *
 * GroupingRowsPlugin Class Tests
 *
 * Tests for the row grouping plugin lifecycle and public API.
 * Pure function tests are in grouping-rows.spec.ts
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ColumnConfig } from '../../core/types';
import { GroupingRowsPlugin } from './GroupingRowsPlugin';

describe('GroupingRowsPlugin', () => {
  // Mock grid element (light DOM)
  function createMockGrid(opts: { rows?: unknown[]; columns?: ColumnConfig[] } = {}): HTMLElement {
    const grid = document.createElement('div');

    // Create grid structure (light DOM - directly in element)
    const container = document.createElement('div');
    container.className = 'tbw-grid-container';

    const body = document.createElement('div');
    body.className = 'body';
    body.style.gridTemplateColumns = '1fr 1fr 1fr';

    container.appendChild(body);
    grid.appendChild(container);

    // Attach mock properties
    Object.defineProperty(grid, 'rows', { get: () => opts.rows ?? [], configurable: true });
    Object.defineProperty(grid, 'columns', { get: () => opts.columns ?? [], configurable: true });

    return grid;
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('constructor and defaults', () => {
    it('should have correct name and version', () => {
      const plugin = new GroupingRowsPlugin({});

      expect(plugin.name).toBe('groupingRows');
      expect(plugin.version).toBeTruthy();
    });

    it('should apply default configuration', () => {
      const plugin = new GroupingRowsPlugin({});
      const grid = createMockGrid();

      plugin.attach(grid);

      expect(plugin.config.defaultExpanded).toBe(false);
      expect(plugin.config.showRowCount).toBe(true);
      expect(plugin.config.indentWidth).toBe(20);
    });

    it('should merge user config with defaults', () => {
      const plugin = new GroupingRowsPlugin({
        defaultExpanded: true,
        showRowCount: false,
        indentWidth: 30,
      });
      const grid = createMockGrid();

      plugin.attach(grid);

      expect(plugin.config.defaultExpanded).toBe(true);
      expect(plugin.config.showRowCount).toBe(false);
      expect(plugin.config.indentWidth).toBe(30);
    });

    it('should have manifest with config rule for accordion + defaultExpanded', () => {
      const manifest = GroupingRowsPlugin.manifest;

      expect(manifest).toBeDefined();
      expect(manifest?.configRules).toBeDefined();
      expect(manifest?.configRules?.length).toBeGreaterThan(0);

      const rule = manifest?.configRules?.find((r) => r.id === 'groupingRows/accordion-defaultExpanded');
      expect(rule).toBeDefined();
      expect(rule?.severity).toBe('warn');

      // Should warn for accordion + expand all
      expect(rule?.check({ accordion: true, defaultExpanded: true })).toBe(true);
      // Should warn for accordion + multiple groups expanded
      expect(rule?.check({ accordion: true, defaultExpanded: ['Group1', 'Group2'] })).toBe(true);

      // Should NOT warn for accordion + false
      expect(rule?.check({ accordion: true, defaultExpanded: false })).toBe(false);
      // Should NOT warn for accordion + single index
      expect(rule?.check({ accordion: true, defaultExpanded: 0 })).toBe(false);
      // Should NOT warn for accordion + single key
      expect(rule?.check({ accordion: true, defaultExpanded: 'Engineering' })).toBe(false);
      // Should NOT warn for accordion + single-item array
      expect(rule?.check({ accordion: true, defaultExpanded: ['Group1'] })).toBe(false);
      // Should NOT warn when accordion is off
      expect(rule?.check({ accordion: false, defaultExpanded: true })).toBe(false);
    });
  });

  describe('lifecycle', () => {
    it('should attach to grid', () => {
      const plugin = new GroupingRowsPlugin({});
      const grid = createMockGrid();

      plugin.attach(grid);

      expect(plugin.grid).toBe(grid);
    });

    it('should detach and clean up state', () => {
      const plugin = new GroupingRowsPlugin({
        groupOn: (row: any) => row.category,
      });
      const rows = [
        { id: 1, category: 'A' },
        { id: 2, category: 'A' },
      ];
      const grid = createMockGrid({ rows });

      plugin.attach(grid);
      plugin.processRows(rows);
      plugin.expandAll();

      expect(plugin.isGroupingActive()).toBe(true);
      expect(plugin.getExpandedGroups().length).toBeGreaterThan(0);

      plugin.detach();

      expect(plugin.isGroupingActive()).toBe(false);
      expect(plugin.getExpandedGroups()).toEqual([]);
    });
  });

  describe('processRows', () => {
    it('should return original rows when groupOn not provided', () => {
      const plugin = new GroupingRowsPlugin({});
      const rows = [{ id: 1 }, { id: 2 }];
      const grid = createMockGrid({ rows });

      plugin.attach(grid);
      const result = plugin.processRows(rows);

      expect(result).toEqual(rows);
      expect(plugin.isGroupingActive()).toBe(false);
    });

    it('should return grouped rows when groupOn is provided', () => {
      const plugin = new GroupingRowsPlugin({
        groupOn: (row: any) => row.category,
      });
      const rows = [
        { id: 1, category: 'A' },
        { id: 2, category: 'A' },
        { id: 3, category: 'B' },
      ];
      const grid = createMockGrid({ rows });

      plugin.attach(grid);
      const result = plugin.processRows(rows);

      expect(plugin.isGroupingActive()).toBe(true);
      // Should have 2 groups when collapsed
      expect(result.length).toBe(2);
      expect(result[0].__isGroupRow).toBe(true);
      expect(result[0].__groupKey).toBe('A');
      expect(result[1].__isGroupRow).toBe(true);
      expect(result[1].__groupKey).toBe('B');
    });

    it('should include data rows when groups are expanded', () => {
      const plugin = new GroupingRowsPlugin({
        groupOn: (row: any) => row.category,
      });
      const rows = [
        { id: 1, category: 'A' },
        { id: 2, category: 'B' },
      ];
      const grid = createMockGrid({ rows });

      plugin.attach(grid);
      plugin.processRows(rows);
      plugin.expand('A');

      const result = plugin.processRows(rows);

      // Group A + data row + Group B = 3
      expect(result.length).toBe(3);
      expect(result[0].__isGroupRow).toBe(true);
      expect(result[1].id).toBe(1); // Data row from group A
      expect(result[2].__isGroupRow).toBe(true);
    });
  });

  describe('public API', () => {
    describe('expandAll / collapseAll', () => {
      it('should expand all groups', () => {
        const plugin = new GroupingRowsPlugin({
          groupOn: (row: any) => row.category,
        });
        const rows = [
          { id: 1, category: 'A' },
          { id: 2, category: 'B' },
          { id: 3, category: 'C' },
        ];
        const grid = createMockGrid({ rows });

        plugin.attach(grid);
        const requestRenderSpy = vi.spyOn(plugin, 'requestRender');
        plugin.processRows(rows);
        plugin.expandAll();

        expect(requestRenderSpy).toHaveBeenCalled();
        expect(plugin.isExpanded('A')).toBe(true);
        expect(plugin.isExpanded('B')).toBe(true);
        expect(plugin.isExpanded('C')).toBe(true);
      });

      it('should collapse all groups', () => {
        const plugin = new GroupingRowsPlugin({
          groupOn: (row: any) => row.category,
        });
        const rows = [
          { id: 1, category: 'A' },
          { id: 2, category: 'B' },
        ];
        const grid = createMockGrid({ rows });

        plugin.attach(grid);
        plugin.processRows(rows);
        plugin.expandAll();
        expect(plugin.getExpandedGroups().length).toBe(2);

        plugin.collapseAll();

        expect(plugin.isExpanded('A')).toBe(false);
        expect(plugin.isExpanded('B')).toBe(false);
        expect(plugin.getExpandedGroups().length).toBe(0);
      });
    });

    describe('toggle', () => {
      it('should toggle group expansion', () => {
        const plugin = new GroupingRowsPlugin({
          groupOn: (row: any) => row.category,
        });
        const rows = [{ id: 1, category: 'A' }];
        const grid = createMockGrid({ rows });

        plugin.attach(grid);
        plugin.processRows(rows);

        expect(plugin.isExpanded('A')).toBe(false);

        plugin.toggle('A');
        expect(plugin.isExpanded('A')).toBe(true);

        plugin.toggle('A');
        expect(plugin.isExpanded('A')).toBe(false);
      });

      it('should emit group-toggle event', () => {
        const plugin = new GroupingRowsPlugin({
          groupOn: (row: any) => row.category,
        });
        const rows = [{ id: 1, category: 'TestGroup' }];
        const grid = createMockGrid({ rows });

        plugin.attach(grid);
        plugin.processRows(rows);

        const emitSpy = vi.spyOn(plugin, 'emit');
        plugin.toggle('TestGroup');

        expect(emitSpy).toHaveBeenCalledWith(
          'group-toggle',
          expect.objectContaining({
            key: 'TestGroup',
            expanded: true,
          }),
        );
      });
    });

    describe('expand / collapse individual', () => {
      it('should expand specific group', () => {
        const plugin = new GroupingRowsPlugin({
          groupOn: (row: any) => row.category,
        });
        const rows = [
          { id: 1, category: 'A' },
          { id: 2, category: 'B' },
        ];
        const grid = createMockGrid({ rows });

        plugin.attach(grid);
        plugin.processRows(rows);

        plugin.expand('A');

        expect(plugin.isExpanded('A')).toBe(true);
        expect(plugin.isExpanded('B')).toBe(false);
      });

      it('should not request render if group already expanded', () => {
        const plugin = new GroupingRowsPlugin({
          groupOn: (row: any) => row.category,
        });
        const rows = [{ id: 1, category: 'A' }];
        const grid = createMockGrid({ rows });

        plugin.attach(grid);
        plugin.processRows(rows);
        plugin.expand('A');

        const requestRenderSpy = vi.spyOn(plugin, 'requestRender');
        plugin.expand('A'); // Already expanded

        expect(requestRenderSpy).not.toHaveBeenCalled();
      });

      it('should collapse specific group', () => {
        const plugin = new GroupingRowsPlugin({
          groupOn: (row: any) => row.category,
        });
        const rows = [{ id: 1, category: 'A' }];
        const grid = createMockGrid({ rows });

        plugin.attach(grid);
        plugin.processRows(rows);
        plugin.expand('A');

        expect(plugin.isExpanded('A')).toBe(true);

        plugin.collapse('A');

        expect(plugin.isExpanded('A')).toBe(false);
      });

      it('should not request render if group already collapsed', () => {
        const plugin = new GroupingRowsPlugin({
          groupOn: (row: any) => row.category,
        });
        const rows = [{ id: 1, category: 'A' }];
        const grid = createMockGrid({ rows });

        plugin.attach(grid);
        plugin.processRows(rows);

        const requestRenderSpy = vi.spyOn(plugin, 'requestRender');
        plugin.collapse('A'); // Already collapsed

        expect(requestRenderSpy).not.toHaveBeenCalled();
      });
    });

    describe('accordion mode', () => {
      it('should collapse other groups at same depth when expanding in accordion mode', () => {
        const plugin = new GroupingRowsPlugin({
          groupOn: (row: any) => row.category,
          accordion: true,
        });
        const rows = [
          { id: 1, category: 'A' },
          { id: 2, category: 'B' },
          { id: 3, category: 'C' },
        ];
        const grid = createMockGrid({ rows });

        plugin.attach(grid);
        plugin.processRows(rows);

        // Expand first group
        plugin.toggle('A');
        expect(plugin.isExpanded('A')).toBe(true);

        // Expand second group - should collapse first
        plugin.toggle('B');
        expect(plugin.isExpanded('A')).toBe(false);
        expect(plugin.isExpanded('B')).toBe(true);

        // Expand third group - should collapse second
        plugin.toggle('C');
        expect(plugin.isExpanded('A')).toBe(false);
        expect(plugin.isExpanded('B')).toBe(false);
        expect(plugin.isExpanded('C')).toBe(true);
      });

      it('should allow collapsing a group in accordion mode', () => {
        const plugin = new GroupingRowsPlugin({
          groupOn: (row: any) => row.category,
          accordion: true,
        });
        const rows = [{ id: 1, category: 'A' }];
        const grid = createMockGrid({ rows });

        plugin.attach(grid);
        plugin.processRows(rows);

        // Expand and then collapse
        plugin.toggle('A');
        expect(plugin.isExpanded('A')).toBe(true);

        plugin.toggle('A');
        expect(plugin.isExpanded('A')).toBe(false);
      });

      it('should allow multiple groups expanded when accordion mode is disabled', () => {
        const plugin = new GroupingRowsPlugin({
          groupOn: (row: any) => row.category,
          accordion: false,
        });
        const rows = [
          { id: 1, category: 'A' },
          { id: 2, category: 'B' },
        ];
        const grid = createMockGrid({ rows });

        plugin.attach(grid);
        plugin.processRows(rows);

        plugin.toggle('A');
        plugin.toggle('B');

        expect(plugin.isExpanded('A')).toBe(true);
        expect(plugin.isExpanded('B')).toBe(true);
      });
    });

    describe('getGroupState', () => {
      it('should return inactive state when not grouping', () => {
        const plugin = new GroupingRowsPlugin({});
        const grid = createMockGrid();

        plugin.attach(grid);

        const state = plugin.getGroupState();

        expect(state.isActive).toBe(false);
        expect(state.expandedCount).toBe(0);
        expect(state.totalGroups).toBe(0);
        expect(state.expandedKeys).toEqual([]);
      });

      it('should return correct state when grouping', () => {
        const plugin = new GroupingRowsPlugin({
          groupOn: (row: any) => row.category,
        });
        const rows = [
          { id: 1, category: 'A' },
          { id: 2, category: 'B' },
          { id: 3, category: 'C' },
        ];
        const grid = createMockGrid({ rows });

        plugin.attach(grid);
        plugin.processRows(rows);
        plugin.expand('A');
        plugin.expand('B');

        const state = plugin.getGroupState();

        expect(state.isActive).toBe(true);
        expect(state.expandedCount).toBe(2);
        expect(state.totalGroups).toBe(3);
        expect(state.expandedKeys).toContain('A');
        expect(state.expandedKeys).toContain('B');
        expect(state.expandedKeys).not.toContain('C');
      });
    });

    describe('getRowCount', () => {
      it('should return 0 when not grouping', () => {
        const plugin = new GroupingRowsPlugin({});
        const grid = createMockGrid();

        plugin.attach(grid);

        expect(plugin.getRowCount()).toBe(0);
      });

      it('should return correct count when grouping', () => {
        const plugin = new GroupingRowsPlugin({
          groupOn: (row: any) => row.category,
        });
        const rows = [
          { id: 1, category: 'A' },
          { id: 2, category: 'A' },
          { id: 3, category: 'B' },
        ];
        const grid = createMockGrid({ rows });

        plugin.attach(grid);
        plugin.processRows(rows);

        // 2 groups (collapsed)
        expect(plugin.getRowCount()).toBe(2);

        plugin.expandAll();
        plugin.processRows(rows);

        // 2 groups + 3 data rows = 5
        expect(plugin.getRowCount()).toBe(5);
      });
    });

    describe('getFlattenedRows', () => {
      it('should return empty array when not grouping', () => {
        const plugin = new GroupingRowsPlugin({});
        const grid = createMockGrid();

        plugin.attach(grid);

        expect(plugin.getFlattenedRows()).toEqual([]);
      });

      it('should return flattened render rows', () => {
        const plugin = new GroupingRowsPlugin({
          groupOn: (row: any) => row.category,
        });
        const rows = [
          { id: 1, category: 'A' },
          { id: 2, category: 'B' },
        ];
        const grid = createMockGrid({ rows });

        plugin.attach(grid);
        plugin.processRows(rows);

        const flattened = plugin.getFlattenedRows();

        expect(flattened.length).toBe(2);
        expect(flattened[0].kind).toBe('group');
        expect(flattened[1].kind).toBe('group');
      });
    });

    describe('refreshGroups', () => {
      it('should request render', () => {
        const plugin = new GroupingRowsPlugin({});
        const grid = createMockGrid();

        plugin.attach(grid);

        const requestRenderSpy = vi.spyOn(plugin, 'requestRender');
        plugin.refreshGroups();

        expect(requestRenderSpy).toHaveBeenCalled();
      });
    });

    describe('setGroupOn', () => {
      it('should set groupOn function', () => {
        const plugin = new GroupingRowsPlugin({});
        const rows = [
          { id: 1, category: 'A' },
          { id: 2, category: 'A' },
        ];
        const grid = createMockGrid({ rows });

        plugin.attach(grid);

        // Initially no grouping
        plugin.processRows(rows);
        expect(plugin.isGroupingActive()).toBe(false);

        // Set groupOn
        plugin.setGroupOn((row: any) => row.category);
        plugin.processRows(rows);

        expect(plugin.isGroupingActive()).toBe(true);
      });

      it('should disable grouping when set to undefined', () => {
        const plugin = new GroupingRowsPlugin({
          groupOn: (row: any) => row.category,
        });
        const rows = [{ id: 1, category: 'A' }];
        const grid = createMockGrid({ rows });

        plugin.attach(grid);
        plugin.processRows(rows);
        expect(plugin.isGroupingActive()).toBe(true);

        plugin.setGroupOn(undefined);
        plugin.processRows(rows);

        expect(plugin.isGroupingActive()).toBe(false);
      });
    });
  });

  describe('detect', () => {
    it('should detect groupOn function in config', () => {
      const result = GroupingRowsPlugin.detect([], { groupOn: () => null });

      expect(result).toBe(true);
    });

    it('should detect enableRowGrouping boolean in config', () => {
      const result = GroupingRowsPlugin.detect([], { enableRowGrouping: true });

      expect(result).toBe(true);
    });

    it('should return false when no grouping config', () => {
      const result = GroupingRowsPlugin.detect([], {});

      expect(result).toBe(false);
    });

    it('should return false when config is undefined', () => {
      const result = GroupingRowsPlugin.detect([], undefined);

      expect(result).toBe(false);
    });
  });

  describe('styles', () => {
    it('should have styles property', () => {
      const plugin = new GroupingRowsPlugin({});

      expect(plugin.styles).toBeDefined();
      expect(typeof plugin.styles).toBe('string');
    });
  });

  describe('edge cases', () => {
    it('should handle empty rows array', () => {
      const plugin = new GroupingRowsPlugin({
        groupOn: (row: any) => row.category,
      });
      const grid = createMockGrid({ rows: [] });

      plugin.attach(grid);
      const result = plugin.processRows([]);

      expect(result).toEqual([]);
      expect(plugin.isGroupingActive()).toBe(false);
    });

    it('should handle groupOn returning null for all rows', () => {
      const plugin = new GroupingRowsPlugin({
        groupOn: () => null,
      });
      const rows = [{ id: 1 }, { id: 2 }];
      const grid = createMockGrid({ rows });

      plugin.attach(grid);
      const result = plugin.processRows(rows);

      expect(result).toEqual(rows);
      expect(plugin.isGroupingActive()).toBe(false);
    });

    it('should handle multi-level grouping', () => {
      const plugin = new GroupingRowsPlugin({
        groupOn: (row: any) => [row.category, row.subcategory],
      });
      const rows = [
        { id: 1, category: 'A', subcategory: 'A1' },
        { id: 2, category: 'A', subcategory: 'A2' },
      ];
      const grid = createMockGrid({ rows });

      plugin.attach(grid);
      plugin.processRows(rows);

      // Top level group only
      expect(plugin.getRowCount()).toBe(1);

      plugin.expand('A');
      plugin.processRows(rows);

      // Top level + 2 subgroups
      expect(plugin.getRowCount()).toBe(3);
    });
  });

  describe('variable row height support', () => {
    // Minimal grid mock that doesn't require DOM for these unit tests
    function createMinimalGridMock(rows: unknown[] = []) {
      return {
        _columns: [{ field: 'id' }],
        _rows: rows,
        addEventListener: () => {},
        querySelector: () => null,
        children: [],
        requestRender: () => {},
        requestAfterRender: () => {},
        dispatchEvent: () => true,
        emit: () => true,
        effectiveConfig: { icons: {} },
      };
    }

    it('should add __rowCacheKey to group rows for height caching', () => {
      const plugin = new GroupingRowsPlugin({
        groupOn: (row: any) => [row.department],
      });
      const rows = [
        { id: 1, department: 'Engineering', name: 'Alice' },
        { id: 2, department: 'Sales', name: 'Bob' },
      ];
      const grid = createMinimalGridMock(rows) as any;

      plugin.attach(grid);
      const result = plugin.processRows(rows);

      // Find the group rows
      const groupRows = result.filter((r: any) => r.__isGroupRow);
      expect(groupRows.length).toBe(2);

      // Each group row should have __rowCacheKey
      expect(groupRows[0].__rowCacheKey).toBe('group:Engineering');
      expect(groupRows[1].__rowCacheKey).toBe('group:Sales');
    });

    it('should preserve __rowCacheKey across expand/collapse', () => {
      const plugin = new GroupingRowsPlugin({
        groupOn: (row: any) => [row.department],
        defaultExpanded: false,
      });
      const rows = [
        { id: 1, department: 'Engineering', name: 'Alice' },
        { id: 2, department: 'Engineering', name: 'Bob' },
      ];
      const grid = createMinimalGridMock(rows) as any;

      plugin.attach(grid);

      // Initial state: collapsed
      let result = plugin.processRows(rows);
      const collapsedGroupRow = result.find((r: any) => r.__isGroupRow);
      expect(collapsedGroupRow.__rowCacheKey).toBe('group:Engineering');

      // Expand
      plugin.expand('Engineering');
      result = plugin.processRows(rows);
      const expandedGroupRow = result.find((r: any) => r.__isGroupRow);
      expect(expandedGroupRow.__rowCacheKey).toBe('group:Engineering');
    });

    it('should return undefined from getRowHeight when groupRowHeight not configured', () => {
      const plugin = new GroupingRowsPlugin({
        groupOn: (row: any) => [row.department],
      });
      const grid = createMinimalGridMock() as any;
      plugin.attach(grid);

      const groupRow = { __isGroupRow: true, __groupKey: 'Engineering' };
      const dataRow = { id: 1, name: 'Alice' };

      expect(plugin.getRowHeight(groupRow, 0)).toBeUndefined();
      expect(plugin.getRowHeight(dataRow, 1)).toBeUndefined();
    });

    it('should return configured groupRowHeight for group rows', () => {
      const plugin = new GroupingRowsPlugin({
        groupOn: (row: any) => [row.department],
        groupRowHeight: 36,
      });
      const grid = createMinimalGridMock() as any;
      plugin.attach(grid);

      const groupRow = { __isGroupRow: true, __groupKey: 'Engineering' };
      const dataRow = { id: 1, name: 'Alice' };

      expect(plugin.getRowHeight(groupRow, 0)).toBe(36);
      expect(plugin.getRowHeight(dataRow, 1)).toBeUndefined();
    });

    it('should return groupRowHeight for nested group rows', () => {
      const plugin = new GroupingRowsPlugin({
        groupOn: (row: any) => [row.region, row.department],
        groupRowHeight: 40,
      });
      const grid = createMinimalGridMock() as any;
      plugin.attach(grid);

      const topLevelGroup = { __isGroupRow: true, __groupKey: 'EMEA', __groupDepth: 0 };
      const nestedGroup = { __isGroupRow: true, __groupKey: 'EMEA||Engineering', __groupDepth: 1 };

      expect(plugin.getRowHeight(topLevelGroup, 0)).toBe(40);
      expect(plugin.getRowHeight(nestedGroup, 1)).toBe(40);
    });
  });
});
