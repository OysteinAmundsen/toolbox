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

      // Regression coverage for issue #335: changing the grouping function then
      // immediately calling expandAll() expanded the *previous* group keys
      // because flattenedRows was still stale.
      describe('issue #335 — regroup + expand-all', () => {
        const initialRows = [
          { id: 1, type: 'PURCHASE', counterparty: 'IC 120000' },
          { id: 2, type: 'PURCHASE', counterparty: 'INT E&P' },
          { id: 3, type: 'SALE', counterparty: 'IC 802900' },
          { id: 4, type: 'SALE', counterparty: 'UNIPECGB' },
        ];

        it('expands the new groups when expandAll() is called right after setGroupOn(fn)', () => {
          const plugin = new GroupingRowsPlugin({
            groupOn: (row: any) => row.type,
            defaultExpanded: true,
          });
          const grid = createMockGrid({ rows: initialRows });
          plugin.attach(grid);
          plugin.processRows(initialRows);

          // Sanity: initial grouping is by `type`, both expanded.
          expect(plugin.getExpandedGroups().sort()).toEqual(['PURCHASE', 'SALE']);

          // Switch grouping and immediately ask to expand all — the bug repro.
          plugin.setGroupOn((row: any) => row.counterparty);
          plugin.expandAll();

          // expandAll must NOT have populated stale keys.
          expect(plugin.getExpandedGroups()).not.toContain('PURCHASE');
          expect(plugin.getExpandedGroups()).not.toContain('SALE');

          // Next render rebuilds against the new groupOn and resolves the
          // pending expansion against the fresh keys.
          plugin.processRows(initialRows);

          expect(plugin.getExpandedGroups().sort()).toEqual(['IC 120000', 'IC 802900', 'INT E&P', 'UNIPECGB']);
        });

        it('accepts an explicit expansion as the second argument to setGroupOn', () => {
          const plugin = new GroupingRowsPlugin({
            groupOn: (row: any) => row.type,
            defaultExpanded: true,
          });
          const grid = createMockGrid({ rows: initialRows });
          plugin.attach(grid);
          plugin.processRows(initialRows);

          plugin.setGroupOn((row: any) => row.counterparty, true);
          plugin.processRows(initialRows);

          expect(plugin.getExpandedGroups().sort()).toEqual(['IC 120000', 'IC 802900', 'INT E&P', 'UNIPECGB']);
        });

        it('accepts an explicit list of keys as the second argument', () => {
          const plugin = new GroupingRowsPlugin({
            groupOn: (row: any) => row.type,
            defaultExpanded: true,
          });
          const grid = createMockGrid({ rows: initialRows });
          plugin.attach(grid);
          plugin.processRows(initialRows);

          plugin.setGroupOn((row: any) => row.counterparty, ['UNIPECGB']);
          plugin.processRows(initialRows);

          expect(plugin.getExpandedGroups()).toEqual(['UNIPECGB']);
        });

        it('collapseAll() called right after setGroupOn(fn) collapses the new groups', () => {
          const plugin = new GroupingRowsPlugin({
            groupOn: (row: any) => row.type,
            defaultExpanded: true,
          });
          const grid = createMockGrid({ rows: initialRows });
          plugin.attach(grid);
          plugin.processRows(initialRows);

          plugin.setGroupOn((row: any) => row.counterparty);
          plugin.collapseAll();
          plugin.processRows(initialRows);

          expect(plugin.getExpandedGroups()).toEqual([]);
        });

        it('emits group-toggle once the deferred expansion has been applied', () => {
          const plugin = new GroupingRowsPlugin({
            groupOn: (row: any) => row.type,
          });
          const grid = createMockGrid({ rows: initialRows });
          plugin.attach(grid);
          plugin.processRows(initialRows);

          const emitSpy = vi.spyOn(plugin as any, 'emitPluginEvent');

          plugin.setGroupOn((row: any) => row.counterparty);
          plugin.expandAll();
          // No event yet — flattenedRows was stale, so the call was deferred.
          expect(emitSpy).not.toHaveBeenCalled();

          plugin.processRows(initialRows);

          expect(emitSpy).toHaveBeenCalledWith(
            'group-toggle',
            expect.objectContaining({
              expandedKeys: expect.arrayContaining(['IC 120000', 'IC 802900', 'INT E&P', 'UNIPECGB']),
            }),
          );
        });
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
        addEventListener: () => {
          /* noop */
        },
        querySelector: () => null,
        children: [],
        requestRender: () => {
          /* noop */
        },
        requestAfterRender: () => {
          /* noop */
        },
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

  describe('pre-defined groups', () => {
    describe('setGroups / getGroups', () => {
      it('should set and get pre-defined groups', () => {
        const plugin = new GroupingRowsPlugin({});
        const grid = createMockGrid();
        plugin.attach(grid);

        const groups = [
          { key: 'Engineering', value: 'Engineering', rowCount: 150 },
          { key: 'Sales', value: 'Sales', rowCount: 89 },
        ];
        plugin.setGroups(groups);

        const result = plugin.getGroups();
        expect(result).toEqual(groups);
      });

      it('should return groups from config when setGroups not called', () => {
        const groups = [
          { key: 'A', value: 'A' },
          { key: 'B', value: 'B' },
        ];
        const plugin = new GroupingRowsPlugin({ groups });
        const grid = createMockGrid();
        plugin.attach(grid);

        expect(plugin.getGroups()).toEqual(groups);
      });

      it('should return empty array when no groups configured', () => {
        const plugin = new GroupingRowsPlugin({});
        const grid = createMockGrid();
        plugin.attach(grid);

        expect(plugin.getGroups()).toEqual([]);
      });

      it('should clear rows and loading state when setting new groups', () => {
        const plugin = new GroupingRowsPlugin({});
        const grid = createMockGrid();
        plugin.attach(grid);

        const groups = [{ key: 'A', value: 'A' }];
        plugin.setGroups(groups);
        plugin.setGroupRows('A', [{ id: 1 }]);
        plugin.setGroupLoading('A', true);

        // Setting new groups should clear everything
        plugin.setGroups([{ key: 'B', value: 'B' }]);
        expect(plugin.getGroups()).toEqual([{ key: 'B', value: 'B' }]);
      });

      it('should request render when setGroups is called', () => {
        const plugin = new GroupingRowsPlugin({});
        const grid = createMockGrid();
        plugin.attach(grid);

        const spy = vi.spyOn(plugin, 'requestRender');
        plugin.setGroups([{ key: 'A', value: 'A' }]);
        expect(spy).toHaveBeenCalled();
      });
    });

    describe('processRows with pre-defined groups', () => {
      it('should produce group rows from pre-defined groups', () => {
        const plugin = new GroupingRowsPlugin({
          groups: [
            { key: 'Engineering', value: 'Engineering', rowCount: 150 },
            { key: 'Sales', value: 'Sales', rowCount: 89 },
          ],
        });
        const grid = createMockGrid();
        plugin.attach(grid);

        const result = plugin.processRows([]);

        expect(result.length).toBe(2);
        expect(result[0].__isGroupRow).toBe(true);
        expect(result[0].__groupKey).toBe('Engineering');
        expect(result[0].__groupRowCount).toBe(150);
        expect(result[1].__isGroupRow).toBe(true);
        expect(result[1].__groupKey).toBe('Sales');
        expect(result[1].__groupRowCount).toBe(89);
        expect(plugin.isGroupingActive()).toBe(true);
      });

      it('should prefer setGroups over config.groups', () => {
        const plugin = new GroupingRowsPlugin({
          groups: [{ key: 'Config', value: 'Config' }],
        });
        const grid = createMockGrid();
        plugin.attach(grid);

        plugin.setGroups([{ key: 'Dynamic', value: 'Dynamic' }]);
        const result = plugin.processRows([]);

        expect(result.length).toBe(1);
        expect(result[0].__groupKey).toBe('Dynamic');
      });

      it('should prefer pre-defined groups over groupOn', () => {
        const plugin = new GroupingRowsPlugin({
          groupOn: (row: any) => row.category,
          groups: [{ key: 'Forced', value: 'Forced' }],
        });
        const rows = [{ id: 1, category: 'A' }];
        const grid = createMockGrid({ rows });
        plugin.attach(grid);

        const result = plugin.processRows(rows);

        expect(result.length).toBe(1);
        expect(result[0].__groupKey).toBe('Forced');
      });
    });

    describe('setGroupRows', () => {
      it('should populate rows for an expanded group', () => {
        const plugin = new GroupingRowsPlugin({
          groups: [{ key: 'Engineering', value: 'Engineering', rowCount: 2 }],
        });
        const grid = createMockGrid();
        plugin.attach(grid);

        plugin.processRows([]);
        plugin.expand('Engineering');
        plugin.setGroupRows('Engineering', [{ name: 'Alice' }, { name: 'Bob' }]);

        const result = plugin.processRows([]);

        // 1 group + 2 data rows
        expect(result.length).toBe(3);
        expect(result[0].__isGroupRow).toBe(true);
        expect(result[1].name).toBe('Alice');
        expect(result[2].name).toBe('Bob');
      });

      it('should request render', () => {
        const plugin = new GroupingRowsPlugin({
          groups: [{ key: 'A', value: 'A' }],
        });
        const grid = createMockGrid();
        plugin.attach(grid);

        const spy = vi.spyOn(plugin, 'requestRender');
        plugin.setGroupRows('A', []);
        expect(spy).toHaveBeenCalled();
      });

      it('should clear loading state for the group', () => {
        const plugin = new GroupingRowsPlugin({
          groups: [{ key: 'A', value: 'A' }],
        });
        const grid = createMockGrid();
        plugin.attach(grid);

        plugin.setGroupLoading('A', true);
        plugin.setGroupRows('A', [{ id: 1 }]);

        // After setting rows, the loading state should be cleared
        // Verify by expanding and checking no loading placeholder appears
        plugin.expand('A');
        const result = plugin.processRows([]);
        const loadingRows = result.filter((r: any) => r.__loading === true);
        expect(loadingRows.length).toBe(0);
      });
    });

    describe('setGroupLoading', () => {
      it('should show loading placeholder when group is expanded and loading', () => {
        const plugin = new GroupingRowsPlugin({
          groups: [{ key: 'A', value: 'A' }],
        });
        const grid = createMockGrid();
        plugin.attach(grid);

        plugin.expand('A');
        plugin.setGroupLoading('A', true);

        const result = plugin.processRows([]);

        // 1 group + 1 loading placeholder
        expect(result.length).toBe(2);
        expect(result[0].__isGroupRow).toBe(true);
        expect(result[1].__loading).toBe(true);
        expect(result[1].__groupKey).toBe('A');
      });

      it('should remove loading placeholder when set to false', () => {
        const plugin = new GroupingRowsPlugin({
          groups: [{ key: 'A', value: 'A' }],
        });
        const grid = createMockGrid();
        plugin.attach(grid);

        plugin.expand('A');
        plugin.setGroupLoading('A', true);
        plugin.setGroupLoading('A', false);

        const result = plugin.processRows([]);

        // Just the group row, no loading placeholder
        expect(result.length).toBe(1);
      });
    });

    describe('clearGroupRows', () => {
      it('should clear rows for a specific group', () => {
        const plugin = new GroupingRowsPlugin({
          groups: [
            { key: 'A', value: 'A' },
            { key: 'B', value: 'B' },
          ],
        });
        const grid = createMockGrid();
        plugin.attach(grid);

        plugin.setGroupRows('A', [{ id: 1 }]);
        plugin.setGroupRows('B', [{ id: 2 }]);

        plugin.clearGroupRows('A');

        plugin.expand('A');
        plugin.expand('B');
        const result = plugin.processRows([]);

        // A group + B group + B's data row = 3 (A cleared, so no data rows for A)
        expect(result.length).toBe(3);
        expect(result[0].__isGroupRow).toBe(true);
        expect(result[0].__groupKey).toBe('A');
        // A is expanded but has no rows
        expect(result[1].__isGroupRow).toBe(true);
        expect(result[1].__groupKey).toBe('B');
        expect(result[2].id).toBe(2);
      });

      it('should clear all group rows when no key provided', () => {
        const plugin = new GroupingRowsPlugin({
          groups: [
            { key: 'A', value: 'A' },
            { key: 'B', value: 'B' },
          ],
        });
        const grid = createMockGrid();
        plugin.attach(grid);

        plugin.setGroupRows('A', [{ id: 1 }]);
        plugin.setGroupRows('B', [{ id: 2 }]);

        plugin.clearGroupRows();

        plugin.expand('A');
        plugin.expand('B');
        const result = plugin.processRows([]);

        // Just the 2 groups, no data rows
        expect(result.length).toBe(2);
      });
    });

    describe('events', () => {
      it('should emit group-expand when toggling open in pre-defined mode', () => {
        const plugin = new GroupingRowsPlugin({
          groups: [{ key: 'Engineering', value: 'Engineering' }],
        });
        const grid = createMockGrid();
        plugin.attach(grid);
        plugin.processRows([]);

        const emitSpy = vi.spyOn(plugin, 'emit');
        plugin.toggle('Engineering');

        expect(emitSpy).toHaveBeenCalledWith(
          'group-expand',
          expect.objectContaining({
            groupKey: 'Engineering',
            groupPath: ['Engineering'],
          }),
        );
      });

      it('should emit group-collapse when toggling closed in pre-defined mode', () => {
        const plugin = new GroupingRowsPlugin({
          groups: [{ key: 'Engineering', value: 'Engineering' }],
        });
        const grid = createMockGrid();
        plugin.attach(grid);
        plugin.processRows([]);

        plugin.expand('Engineering');
        const emitSpy = vi.spyOn(plugin, 'emit');
        plugin.toggle('Engineering');

        expect(emitSpy).toHaveBeenCalledWith(
          'group-collapse',
          expect.objectContaining({
            groupKey: 'Engineering',
            groupPath: ['Engineering'],
          }),
        );
      });

      it('should include full group path for nested groups', () => {
        const plugin = new GroupingRowsPlugin({
          groups: [
            {
              key: 'US',
              value: 'US',
              children: [{ key: 'US-Eng', value: 'Engineering' }],
            },
          ],
        });
        const grid = createMockGrid();
        plugin.attach(grid);
        plugin.processRows([]);
        plugin.expand('US');
        plugin.processRows([]);

        const emitSpy = vi.spyOn(plugin, 'emit');
        plugin.toggle('US-Eng');

        expect(emitSpy).toHaveBeenCalledWith(
          'group-expand',
          expect.objectContaining({
            groupKey: 'US-Eng',
            groupPath: ['US', 'US-Eng'],
          }),
        );
      });

      it('should not emit group-expand/collapse in groupOn mode', () => {
        const plugin = new GroupingRowsPlugin({
          groupOn: (row: any) => row.category,
        });
        const rows = [{ id: 1, category: 'A' }];
        const grid = createMockGrid({ rows });
        plugin.attach(grid);
        plugin.processRows(rows);

        const emitSpy = vi.spyOn(plugin, 'emit');
        plugin.toggle('A');

        // Should emit group-toggle but NOT group-expand
        const expandCalls = emitSpy.mock.calls.filter((c) => c[0] === 'group-expand');
        expect(expandCalls.length).toBe(0);
      });
    });

    describe('detect', () => {
      it('should detect groups array in config', () => {
        const result = GroupingRowsPlugin.detect([], { groups: [{ key: 'A', value: 'A' }] });
        expect(result).toBe(true);
      });
    });

    describe('manifest compatibility', () => {
      it('should not declare serverSide as incompatible', () => {
        const manifest = GroupingRowsPlugin.manifest;
        const incompatible = manifest?.incompatibleWith?.map((i) => i.name) ?? [];
        expect(incompatible).not.toContain('serverSide');
      });
    });

    describe('datasource integration', () => {
      function createMockGridWithEvents() {
        const eventListeners = new Map<string, (detail: unknown) => void>();
        const renderCalls: unknown[] = [];
        const queryCalls: Array<{ type: string; context: unknown }> = [];
        const grid = document.createElement('div');

        Object.defineProperty(grid, 'rows', { get: () => [], configurable: true });
        Object.defineProperty(grid, 'columns', { get: () => [], configurable: true });
        Object.defineProperty(grid, 'query', {
          value: (type: string, context: unknown) => {
            queryCalls.push({ type, context });
            return undefined;
          },
          configurable: true,
        });
        Object.defineProperty(grid, '_pluginManager', {
          value: {
            subscribe(_p: unknown, eventType: string, callback: (detail: unknown) => void) {
              eventListeners.set(eventType, callback);
            },
            unsubscribe: () => {
              /* noop */
            },
            emitPluginEvent: () => {
              /* noop */
            },
          },
          configurable: true,
        });

        return { grid, eventListeners, renderCalls, queryCalls };
      }

      it('should claim datasource:data events and store as group definitions', () => {
        const plugin = new GroupingRowsPlugin({});
        const { grid, eventListeners } = createMockGridWithEvents();
        plugin.attach(grid as any);

        const groups = [
          { key: 'Eng', value: 'Engineering', rowCount: 10 },
          { key: 'Sales', value: 'Sales', rowCount: 5 },
        ];
        const detail = { rows: groups, totalNodeCount: 2, startNode: 0, endNode: 2, claimed: false };
        eventListeners.get('datasource:data')?.(detail);

        expect(detail.claimed).toBe(true);
        expect(plugin.getGroups()).toEqual(groups);
      });

      it('should claim and process datasource:children events for source=grouping-rows', () => {
        const plugin = new GroupingRowsPlugin({});
        const { grid, eventListeners } = createMockGridWithEvents();
        plugin.attach(grid as any);

        // First provide groups via datasource:data
        const groups = [{ key: 'Eng', value: 'Engineering' }];
        eventListeners.get('datasource:data')?.({
          rows: groups,
          totalNodeCount: 1,
          startNode: 0,
          endNode: 1,
          claimed: false,
        });

        // Expand group
        plugin.processRows([]);
        plugin.toggle('Eng');

        // Deliver children via datasource:children
        const childDetail = {
          rows: [{ name: 'Alice' }, { name: 'Bob' }],
          context: { source: 'grouping-rows', groupKey: 'Eng' },
          claimed: false,
        };
        eventListeners.get('datasource:children')?.(childDetail);

        expect(childDetail.claimed).toBe(true);

        // After children received, processRows should include them
        const result = plugin.processRows([]);
        expect(result.length).toBe(3); // 1 group + 2 data rows
        expect(result[1].name).toBe('Alice');
        expect(result[2].name).toBe('Bob');
      });

      it('should ignore datasource:children events for other sources', () => {
        const plugin = new GroupingRowsPlugin({});
        const { grid, eventListeners } = createMockGridWithEvents();
        plugin.attach(grid as any);

        const detail = {
          rows: [{ id: 10 }],
          context: { source: 'tree', parentNode: {} },
          claimed: false,
        };
        eventListeners.get('datasource:children')?.(detail);

        expect(detail.claimed).toBe(false);
      });

      it('should fire datasource:fetch-children query on group expand', () => {
        const plugin = new GroupingRowsPlugin({
          groups: [{ key: 'Eng', value: 'Engineering', rowCount: 5 }],
        });
        const { grid, queryCalls } = createMockGridWithEvents();
        plugin.attach(grid as any);
        plugin.processRows([]);

        // Expand the group — should fire fetch-children query
        plugin.toggle('Eng');

        const fetchQuery = queryCalls.find((q) => q.type === 'datasource:fetch-children');
        expect(fetchQuery).toBeDefined();
        expect((fetchQuery!.context as any).context.source).toBe('grouping-rows');
        expect((fetchQuery!.context as any).context.groupKey).toBe('Eng');
      });

      it('should respond to datasource:viewport-mapping queries in pre-defined mode', () => {
        const plugin = new GroupingRowsPlugin({
          groups: [
            { key: 'A', value: 'Group A' },
            { key: 'B', value: 'Group B' },
            { key: 'C', value: 'Group C' },
          ],
        });
        const grid = createMockGrid();
        plugin.attach(grid as any);
        plugin.processRows([]);

        const result = plugin.handleQuery({
          type: 'datasource:viewport-mapping',
          context: { viewportStart: 0, viewportEnd: 2 },
        });

        expect(result).toBeDefined();
        expect((result as any).startNode).toBe(0);
        expect((result as any).totalLoadedNodes).toBe(3);
      });

      it('should not respond to viewport-mapping in groupOn mode', () => {
        const plugin = new GroupingRowsPlugin({
          groupOn: (row: any) => row.dept,
        });
        const grid = createMockGrid();
        plugin.attach(grid as any);

        const result = plugin.handleQuery({
          type: 'datasource:viewport-mapping',
          context: { viewportStart: 0, viewportEnd: 5 },
        });

        expect(result).toBeUndefined();
      });

      it('should show loading indicator while waiting for datasource:children', () => {
        const plugin = new GroupingRowsPlugin({
          groups: [{ key: 'A', value: 'Group A' }],
        });
        const { grid } = createMockGridWithEvents();
        plugin.attach(grid as any);
        plugin.processRows([]);

        // Expand — adds to loadingGroups, fires query
        plugin.toggle('A');

        const result = plugin.processRows([]);
        // 1 group + 1 loading placeholder (children not yet received)
        expect(result.length).toBe(2);
        expect(result[1].__loading).toBe(true);
      });
    });
  });

  describe('grouping:get-grouped-fields query', () => {
    it('should return grouped field names after processRows', () => {
      const plugin = new GroupingRowsPlugin({
        groupOn: (row: any) => row.dept,
      });
      const rows = [
        { name: 'Alice', dept: 'Engineering' },
        { name: 'Bob', dept: 'Sales' },
      ];
      const columns: ColumnConfig[] = [
        { field: 'name', header: 'Name' },
        { field: 'dept', header: 'Department' },
      ];
      const grid = createMockGrid({ rows, columns });
      plugin.attach(grid);
      plugin.processRows(rows);

      const result = plugin.handleQuery({ type: 'grouping:get-grouped-fields', context: null });
      expect(result).toEqual(['dept']);
    });

    it('should return empty array when groupOn not configured', () => {
      const plugin = new GroupingRowsPlugin({});
      const grid = createMockGrid();
      plugin.attach(grid);
      plugin.processRows([]);

      const result = plugin.handleQuery({ type: 'grouping:get-grouped-fields', context: null });
      expect(result).toEqual([]);
    });

    it('should return multiple fields for multi-level grouping', () => {
      const plugin = new GroupingRowsPlugin({
        groupOn: (row: any) => [row.country, row.dept],
      });
      const rows = [
        { name: 'Alice', country: 'Germany', dept: 'Engineering' },
        { name: 'Bob', country: 'France', dept: 'Sales' },
      ];
      const columns: ColumnConfig[] = [
        { field: 'name', header: 'Name' },
        { field: 'country', header: 'Country' },
        { field: 'dept', header: 'Department' },
      ];
      const grid = createMockGrid({ rows, columns });
      plugin.attach(grid);
      plugin.processRows(rows);

      const result = plugin.handleQuery({ type: 'grouping:get-grouped-fields', context: null });
      expect(result).toEqual(['country', 'dept']);
    });
  });

  describe('onHeaderClick for grouped columns', () => {
    it('should intercept header click on grouped column and return true', () => {
      const plugin = new GroupingRowsPlugin({
        groupOn: (row: any) => row.dept,
      });
      const rows = [
        { name: 'Alice', dept: 'Engineering' },
        { name: 'Bob', dept: 'Sales' },
      ];
      const columns: ColumnConfig[] = [
        { field: 'name', header: 'Name', sortable: true },
        { field: 'dept', header: 'Department', sortable: true },
      ];
      const grid = createMockGrid({ rows, columns });
      plugin.attach(grid);
      plugin.processRows(rows);

      const event = {
        colIndex: 1,
        field: 'dept',
        column: columns[1],
        headerEl: document.createElement('div'),
        originalEvent: new MouseEvent('click'),
      };
      const handled = plugin.onHeaderClick!(event);
      expect(handled).toBe(true);
    });

    it('should not intercept header click on non-grouped column', () => {
      const plugin = new GroupingRowsPlugin({
        groupOn: (row: any) => row.dept,
      });
      const rows = [
        { name: 'Alice', dept: 'Engineering' },
        { name: 'Bob', dept: 'Sales' },
      ];
      const columns: ColumnConfig[] = [
        { field: 'name', header: 'Name', sortable: true },
        { field: 'dept', header: 'Department', sortable: true },
      ];
      const grid = createMockGrid({ rows, columns });
      plugin.attach(grid);
      plugin.processRows(rows);

      const event = {
        colIndex: 0,
        field: 'name',
        column: columns[0],
        headerEl: document.createElement('div'),
        originalEvent: new MouseEvent('click'),
      };
      const handled = plugin.onHeaderClick!(event);
      expect(handled).toBeUndefined();
    });

    it('should toggle group sort direction on repeated clicks', () => {
      const plugin = new GroupingRowsPlugin({
        groupOn: (row: any) => row.dept,
      });
      const rows = [
        { name: 'Alice', dept: 'Engineering' },
        { name: 'Bob', dept: 'Sales' },
      ];
      const columns: ColumnConfig[] = [{ field: 'dept', header: 'Department', sortable: true }];
      const grid = createMockGrid({ rows, columns });
      plugin.attach(grid);

      // First processRows: default ascending → groups: Engineering, Sales
      let result = plugin.processRows(rows);
      expect(result[0].__groupKey).toBe('Engineering');
      expect(result[1].__groupKey).toBe('Sales');

      // Click dept header to flip to descending
      const event = {
        colIndex: 0,
        field: 'dept',
        column: columns[0],
        headerEl: document.createElement('div'),
        originalEvent: new MouseEvent('click'),
      };
      plugin.onHeaderClick!(event);

      // Re-process rows — should now be descending
      result = plugin.processRows(rows);
      expect(result[0].__groupKey).toBe('Sales');
      expect(result[1].__groupKey).toBe('Engineering');

      // Click again to flip back to ascending
      plugin.onHeaderClick!(event);
      result = plugin.processRows(rows);
      expect(result[0].__groupKey).toBe('Engineering');
      expect(result[1].__groupKey).toBe('Sales');
    });
  });

  describe('manifest hookPriority', () => {
    it('should declare onHeaderClick priority lower than default', () => {
      const manifest = GroupingRowsPlugin.manifest;
      expect(manifest?.hookPriority?.onHeaderClick).toBe(-1);
    });
  });
});
