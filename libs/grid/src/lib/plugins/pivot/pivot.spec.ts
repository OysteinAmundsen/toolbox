import { describe, expect, it } from 'vitest';
import {
  buildPivot,
  buildPivotRows,
  calculateTotals,
  flattenPivotRows,
  getUniqueColumnKeys,
  groupByFields,
  type PivotDataRow,
} from './pivot-engine';
import { createValueKey, getPivotAggregator, validatePivotConfig } from './pivot-model';
import { PivotPlugin } from './PivotPlugin';
import type { PivotConfig, PivotRow, PivotValueField } from './types';

describe('pivot-model', () => {
  describe('getPivotAggregator', () => {
    it('should calculate sum correctly', () => {
      const agg = getPivotAggregator('sum');
      expect(agg([1, 2, 3, 4, 5])).toBe(15);
    });

    it('should calculate avg correctly', () => {
      const agg = getPivotAggregator('avg');
      expect(agg([2, 4, 6, 8])).toBe(5);
    });

    it('should return 0 for avg of empty array', () => {
      const agg = getPivotAggregator('avg');
      expect(agg([])).toBe(0);
    });

    it('should calculate count correctly', () => {
      const agg = getPivotAggregator('count');
      expect(agg([1, 2, 3])).toBe(3);
    });

    it('should calculate min correctly', () => {
      const agg = getPivotAggregator('min');
      expect(agg([5, 2, 8, 1, 9])).toBe(1);
    });

    it('should return 0 for min of empty array', () => {
      const agg = getPivotAggregator('min');
      expect(agg([])).toBe(0);
    });

    it('should calculate max correctly', () => {
      const agg = getPivotAggregator('max');
      expect(agg([5, 2, 8, 1, 9])).toBe(9);
    });

    it('should return 0 for max of empty array', () => {
      const agg = getPivotAggregator('max');
      expect(agg([])).toBe(0);
    });

    it('should return first value', () => {
      const agg = getPivotAggregator('first');
      expect(agg([10, 20, 30])).toBe(10);
    });

    it('should return 0 for first of empty array', () => {
      const agg = getPivotAggregator('first');
      expect(agg([])).toBe(0);
    });

    it('should return last value', () => {
      const agg = getPivotAggregator('last');
      expect(agg([10, 20, 30])).toBe(30);
    });

    it('should return 0 for last of empty array', () => {
      const agg = getPivotAggregator('last');
      expect(agg([])).toBe(0);
    });

    it('should default to sum for unknown aggFunc', () => {
      const agg = getPivotAggregator('unknown');
      expect(agg([1, 2, 3])).toBe(6);
    });
  });

  describe('validatePivotConfig', () => {
    it('should return error when no row or column group fields', () => {
      const config: PivotConfig = {
        valueFields: [{ field: 'amount', aggFunc: 'sum' }],
      };
      const errors = validatePivotConfig(config);
      expect(errors).toContain('At least one row or column group field is required');
    });

    it('should return error when no value fields', () => {
      const config: PivotConfig = {
        rowGroupFields: ['category'],
      };
      const errors = validatePivotConfig(config);
      expect(errors).toContain('At least one value field is required');
    });

    it('should return multiple errors when both missing', () => {
      const config: PivotConfig = {};
      const errors = validatePivotConfig(config);
      expect(errors).toHaveLength(2);
    });

    it('should return no errors for valid config with row groups', () => {
      const config: PivotConfig = {
        rowGroupFields: ['category'],
        valueFields: [{ field: 'amount', aggFunc: 'sum' }],
      };
      const errors = validatePivotConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('should return no errors for valid config with column groups', () => {
      const config: PivotConfig = {
        columnGroupFields: ['region'],
        valueFields: [{ field: 'amount', aggFunc: 'sum' }],
      };
      const errors = validatePivotConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('should return no errors for valid config with both groups', () => {
      const config: PivotConfig = {
        rowGroupFields: ['category'],
        columnGroupFields: ['region'],
        valueFields: [{ field: 'amount', aggFunc: 'sum' }],
      };
      const errors = validatePivotConfig(config);
      expect(errors).toHaveLength(0);
    });
  });

  describe('createValueKey', () => {
    it('should create key from column values and field', () => {
      const key = createValueKey(['North', '2024'], 'sales');
      expect(key).toBe('North|2024|sales');
    });

    it('should handle single column value', () => {
      const key = createValueKey(['East'], 'revenue');
      expect(key).toBe('East|revenue');
    });

    it('should handle empty column values', () => {
      const key = createValueKey([], 'amount');
      expect(key).toBe('amount');
    });
  });
});

describe('pivot-engine', () => {
  describe('getUniqueColumnKeys', () => {
    it('should return ["value"] when no column fields', () => {
      const rows = [{ a: 1 }, { a: 2 }];
      const keys = getUniqueColumnKeys(rows, []);
      expect(keys).toEqual(['value']);
    });

    it('should extract unique single-field keys', () => {
      const rows = [
        { region: 'North', value: 10 },
        { region: 'South', value: 20 },
        { region: 'North', value: 30 },
      ];
      const keys = getUniqueColumnKeys(rows, ['region']);
      expect(keys).toEqual(['North', 'South']);
    });

    it('should extract unique multi-field keys', () => {
      const rows = [
        { region: 'North', year: 2023, value: 10 },
        { region: 'North', year: 2024, value: 20 },
        { region: 'South', year: 2023, value: 30 },
      ];
      const keys = getUniqueColumnKeys(rows, ['region', 'year']);
      expect(keys).toEqual(['North|2023', 'North|2024', 'South|2023']);
    });

    it('should handle missing field values', () => {
      const rows = [
        { region: 'North', value: 10 },
        { value: 20 }, // missing region
        { region: null, value: 30 },
      ];
      const keys = getUniqueColumnKeys(rows, ['region']);
      expect(keys).toContain('North');
      expect(keys).toContain('');
    });

    it('should handle empty rows array', () => {
      const keys = getUniqueColumnKeys([], ['region']);
      expect(keys).toEqual([]);
    });
  });

  describe('groupByFields', () => {
    it('should group rows by single field', () => {
      const rows = [
        { category: 'A', value: 1 },
        { category: 'B', value: 2 },
        { category: 'A', value: 3 },
      ];
      const groups = groupByFields(rows, ['category']);
      expect(groups.size).toBe(2);
      expect(groups.get('A')).toHaveLength(2);
      expect(groups.get('B')).toHaveLength(1);
    });

    it('should group rows by multiple fields', () => {
      const rows = [
        { category: 'A', region: 'North', value: 1 },
        { category: 'A', region: 'South', value: 2 },
        { category: 'A', region: 'North', value: 3 },
      ];
      const groups = groupByFields(rows, ['category', 'region']);
      expect(groups.size).toBe(2);
      expect(groups.get('A|North')).toHaveLength(2);
      expect(groups.get('A|South')).toHaveLength(1);
    });

    it('should handle empty fields (all rows in one group)', () => {
      const rows = [{ value: 1 }, { value: 2 }, { value: 3 }];
      const groups = groupByFields(rows, []);
      expect(groups.size).toBe(1);
      expect(groups.get('')).toHaveLength(3);
    });

    it('should handle empty rows', () => {
      const groups = groupByFields([], ['category']);
      expect(groups.size).toBe(0);
    });

    it('should handle missing field values', () => {
      const rows = [
        { category: 'A', value: 1 },
        { value: 2 }, // missing category
      ];
      const groups = groupByFields(rows, ['category']);
      expect(groups.get('A')).toHaveLength(1);
      expect(groups.get('')).toHaveLength(1);
    });
  });

  describe('buildPivotRows', () => {
    it('should build pivot rows with values', () => {
      const groupedData = new Map<string, PivotDataRow[]>([
        ['GroupA', [{ amount: 100 }, { amount: 200 }]],
        ['GroupB', [{ amount: 50 }]],
      ]);
      const valueFields: PivotValueField[] = [{ field: 'amount', aggFunc: 'sum' }];

      const rows = buildPivotRows(groupedData, [], ['value'], valueFields, 0);

      expect(rows).toHaveLength(2);
      expect(rows[0].rowKey).toBe('GroupA');
      expect(rows[0].rowLabel).toBe('GroupA');
      expect(rows[0].values['value|amount']).toBe(300);
      expect(rows[1].values['value|amount']).toBe(50);
    });

    it('should calculate totals per row', () => {
      const groupedData = new Map<string, PivotDataRow[]>([['GroupA', [{ sales: 100, profit: 20 }]]]);
      const valueFields: PivotValueField[] = [
        { field: 'sales', aggFunc: 'sum' },
        { field: 'profit', aggFunc: 'sum' },
      ];

      const rows = buildPivotRows(groupedData, [], ['value'], valueFields, 0);

      expect(rows[0].total).toBe(120);
    });

    it('should handle blank row keys', () => {
      const groupedData = new Map<string, PivotDataRow[]>([['', [{ amount: 100 }]]]);
      const valueFields: PivotValueField[] = [{ field: 'amount', aggFunc: 'sum' }];

      const rows = buildPivotRows(groupedData, [], ['value'], valueFields, 0);

      expect(rows[0].rowLabel).toBe('(blank)');
    });

    it('should set correct depth', () => {
      const groupedData = new Map<string, PivotDataRow[]>([['Group', [{ amount: 100 }]]]);
      const valueFields: PivotValueField[] = [{ field: 'amount', aggFunc: 'sum' }];

      const rows = buildPivotRows(groupedData, [], ['value'], valueFields, 2);

      expect(rows[0].depth).toBe(2);
    });
  });

  describe('calculateTotals', () => {
    it('should calculate column totals', () => {
      const pivotRows: PivotRow[] = [
        {
          rowKey: 'A',
          rowLabel: 'A',
          depth: 0,
          values: { 'North|sales': 100, 'South|sales': 50 },
          isGroup: false,
        },
        {
          rowKey: 'B',
          rowLabel: 'B',
          depth: 0,
          values: { 'North|sales': 200, 'South|sales': 75 },
          isGroup: false,
        },
      ];
      const valueFields: PivotValueField[] = [{ field: 'sales', aggFunc: 'sum' }];

      const totals = calculateTotals(pivotRows, ['North', 'South'], valueFields);

      expect(totals['North|sales']).toBe(300);
      expect(totals['South|sales']).toBe(125);
    });

    it('should handle null values', () => {
      const pivotRows: PivotRow[] = [
        {
          rowKey: 'A',
          rowLabel: 'A',
          depth: 0,
          values: { 'col|amount': 100 },
          isGroup: false,
        },
        {
          rowKey: 'B',
          rowLabel: 'B',
          depth: 0,
          values: { 'col|amount': null },
          isGroup: false,
        },
      ];
      const valueFields: PivotValueField[] = [{ field: 'amount', aggFunc: 'sum' }];

      const totals = calculateTotals(pivotRows, ['col'], valueFields);

      expect(totals['col|amount']).toBe(100);
    });
  });

  describe('flattenPivotRows', () => {
    it('should flatten nested rows', () => {
      const rows: PivotRow[] = [
        {
          rowKey: 'A',
          rowLabel: 'A',
          depth: 0,
          values: {},
          isGroup: true,
          children: [
            {
              rowKey: 'A1',
              rowLabel: 'A1',
              depth: 1,
              values: {},
              isGroup: false,
            },
            {
              rowKey: 'A2',
              rowLabel: 'A2',
              depth: 1,
              values: {},
              isGroup: false,
            },
          ],
        },
        {
          rowKey: 'B',
          rowLabel: 'B',
          depth: 0,
          values: {},
          isGroup: false,
        },
      ];

      const flat = flattenPivotRows(rows);

      expect(flat).toHaveLength(4);
      expect(flat.map((r) => r.rowKey)).toEqual(['A', 'A1', 'A2', 'B']);
    });

    it('should handle rows without children', () => {
      const rows: PivotRow[] = [
        {
          rowKey: 'X',
          rowLabel: 'X',
          depth: 0,
          values: {},
          isGroup: false,
        },
      ];

      const flat = flattenPivotRows(rows);

      expect(flat).toHaveLength(1);
    });

    it('should handle deeply nested children', () => {
      const rows: PivotRow[] = [
        {
          rowKey: 'L1',
          rowLabel: 'L1',
          depth: 0,
          values: {},
          isGroup: true,
          children: [
            {
              rowKey: 'L2',
              rowLabel: 'L2',
              depth: 1,
              values: {},
              isGroup: true,
              children: [
                {
                  rowKey: 'L3',
                  rowLabel: 'L3',
                  depth: 2,
                  values: {},
                  isGroup: false,
                },
              ],
            },
          ],
        },
      ];

      const flat = flattenPivotRows(rows);

      expect(flat).toHaveLength(3);
      expect(flat.map((r) => r.depth)).toEqual([0, 1, 2]);
    });

    it('should handle empty array', () => {
      const flat = flattenPivotRows([]);
      expect(flat).toEqual([]);
    });
  });

  describe('buildPivot', () => {
    it('should build complete pivot result', () => {
      const rows = [
        { category: 'Electronics', region: 'North', sales: 100 },
        { category: 'Electronics', region: 'South', sales: 150 },
        { category: 'Clothing', region: 'North', sales: 80 },
        { category: 'Clothing', region: 'South', sales: 120 },
      ];

      const config: PivotConfig = {
        rowGroupFields: ['category'],
        columnGroupFields: ['region'],
        valueFields: [{ field: 'sales', aggFunc: 'sum' }],
      };

      const result = buildPivot(rows, config);

      expect(result.rows).toHaveLength(2);
      expect(result.columnKeys).toEqual(['North', 'South']);
      expect(result.rows.find((r) => r.rowKey === 'Electronics')).toBeDefined();
      expect(result.rows.find((r) => r.rowKey === 'Clothing')).toBeDefined();
    });

    it('should calculate grand total', () => {
      const rows = [
        { category: 'A', amount: 100 },
        { category: 'B', amount: 200 },
      ];

      const config: PivotConfig = {
        rowGroupFields: ['category'],
        valueFields: [{ field: 'amount', aggFunc: 'sum' }],
      };

      const result = buildPivot(rows, config);

      expect(result.grandTotal).toBe(300);
    });

    it('should handle empty data', () => {
      const config: PivotConfig = {
        rowGroupFields: ['category'],
        valueFields: [{ field: 'amount', aggFunc: 'sum' }],
      };

      const result = buildPivot([], config);

      expect(result.rows).toHaveLength(0);
      expect(result.grandTotal).toBe(0);
    });

    it('should handle multiple value fields', () => {
      const rows = [
        { category: 'A', sales: 100, profit: 20 },
        { category: 'A', sales: 150, profit: 30 },
      ];

      const config: PivotConfig = {
        rowGroupFields: ['category'],
        valueFields: [
          { field: 'sales', aggFunc: 'sum' },
          { field: 'profit', aggFunc: 'avg' },
        ],
      };

      const result = buildPivot(rows, config);

      const categoryA = result.rows.find((r) => r.rowKey === 'A');
      expect(categoryA?.values['value|sales']).toBe(250);
      expect(categoryA?.values['value|profit']).toBe(25);
    });

    it('should handle missing field values gracefully', () => {
      const rows = [
        { category: 'A', amount: 100 },
        { category: 'A' }, // missing amount
        { category: 'B', amount: 50 },
      ];

      const config: PivotConfig = {
        rowGroupFields: ['category'],
        valueFields: [{ field: 'amount', aggFunc: 'sum' }],
      };

      const result = buildPivot(rows, config);

      const categoryA = result.rows.find((r) => r.rowKey === 'A');
      expect(categoryA?.values['value|amount']).toBe(100); // NaN becomes 0
    });

    it('should work with only column group fields', () => {
      const rows = [
        { region: 'North', sales: 100 },
        { region: 'South', sales: 200 },
        { region: 'North', sales: 50 },
      ];

      const config: PivotConfig = {
        columnGroupFields: ['region'],
        valueFields: [{ field: 'sales', aggFunc: 'sum' }],
      };

      const result = buildPivot(rows, config);

      // All rows grouped into one (empty key)
      expect(result.rows).toHaveLength(1);
      expect(result.columnKeys).toEqual(['North', 'South']);
    });
  });
});

describe('PivotPlugin.getToolPanel', () => {
  it('returns tool panel definition by default', () => {
    const plugin = new PivotPlugin({});
    expect(plugin.getToolPanel()).toBeDefined();
    expect(plugin.getToolPanel()?.id).toBe('pivot');
  });

  it('returns tool panel definition when showToolPanel is true', () => {
    const plugin = new PivotPlugin({ showToolPanel: true });
    expect(plugin.getToolPanel()).toBeDefined();
    expect(plugin.getToolPanel()?.id).toBe('pivot');
  });

  it('returns undefined when showToolPanel is false', () => {
    const plugin = new PivotPlugin({ showToolPanel: false });
    expect(plugin.getToolPanel()).toBeUndefined();
  });

  it('returns correct tool panel properties', () => {
    const plugin = new PivotPlugin({});
    const panel = plugin.getToolPanel();
    expect(panel?.title).toBe('Pivot');
    expect(panel?.icon).toBe('⊞');
    expect(panel?.tooltip).toBe('Configure pivot table');
    expect(panel?.order).toBe(90);
  });
});

describe('PivotPlugin lifecycle and API', () => {
  function createMockGrid() {
    let renderCount = 0;
    const columns = [
      { field: 'category', header: 'Category', visible: true },
      { field: 'region', header: 'Region', visible: true },
      { field: 'sales', header: 'Sales', visible: true },
    ];
    let toolPanelOpen = false;
    const expandedSections: string[] = [];

    // Create a real DOM element that plugins can query
    const grid = document.createElement('div');
    grid.className = 'tbw-grid';

    // Add container element
    const container = document.createElement('div');
    container.className = 'tbw-grid-root';
    grid.appendChild(container);

    // Add mock properties to the real DOM element
    Object.assign(grid, {
      columns,
      rows: [],
      effectiveConfig: {},
      requestRender: () => renderCount++,
      getAllColumns: () => columns,
      getRenderCount: () => renderCount,
    });

    // Define getters for tool panel state
    Object.defineProperties(grid, {
      isToolPanelOpen: {
        get: () => toolPanelOpen,
      },
      activeToolPanel: {
        get: () => (toolPanelOpen ? 'tool-panel' : undefined),
      },
      expandedToolPanelSections: {
        get: () => expandedSections,
      },
    });

    // Add methods
    Object.assign(grid, {
      openToolPanel: () => {
        toolPanelOpen = true;
      },
      closeToolPanel: () => {
        toolPanelOpen = false;
        expandedSections.length = 0;
      },
      toggleToolPanel: () => {
        toolPanelOpen = !toolPanelOpen;
        if (!toolPanelOpen) expandedSections.length = 0;
      },
      toggleToolPanelSection: (sectionId: string) => {
        const idx = expandedSections.indexOf(sectionId);
        if (idx >= 0) {
          expandedSections.splice(idx, 1);
        } else {
          expandedSections.push(sectionId);
        }
      },
    });

    return grid as any;
  }

  describe('detach', () => {
    it('resets all internal state', () => {
      const plugin = new PivotPlugin({
        rowGroupFields: ['category'],
        valueFields: [{ field: 'sales', aggFunc: 'sum' }],
      });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as any);

      // Enable pivot and process some data
      plugin.enablePivot();
      expect(plugin.isPivotActive()).toBe(true);

      // Detach should reset state
      plugin.detach();

      expect(plugin.isPivotActive()).toBe(false);
      expect(plugin.getPivotResult()).toBeNull();
    });
  });

  describe('Expand/Collapse API', () => {
    function setupPluginWithData() {
      const plugin = new PivotPlugin({
        rowGroupFields: ['category', 'subcategory'], // Two levels for hierarchical groups
        valueFields: [{ field: 'sales', aggFunc: 'sum' }],
        defaultExpanded: false,
      });
      const mockGrid = createMockGrid();
      mockGrid.rows = [
        { category: 'Electronics', subcategory: 'Phones', sales: 100 },
        { category: 'Electronics', subcategory: 'Tablets', sales: 200 },
        { category: 'Clothing', subcategory: 'Shirts', sales: 50 },
      ];
      plugin.attach(mockGrid as any);
      plugin.enablePivot();

      // Process rows to build pivot
      plugin.processRows(mockGrid.rows);
      return { plugin, mockGrid };
    }

    it('expand should add key to expanded set', () => {
      const { plugin } = setupPluginWithData();

      expect(plugin.isExpanded('Electronics')).toBe(false);
      plugin.expand('Electronics');
      expect(plugin.isExpanded('Electronics')).toBe(true);
    });

    it('collapse should remove key from expanded set', () => {
      const { plugin } = setupPluginWithData();

      plugin.expand('Electronics');
      expect(plugin.isExpanded('Electronics')).toBe(true);

      plugin.collapse('Electronics');
      expect(plugin.isExpanded('Electronics')).toBe(false);
    });

    it('toggle should toggle expanded state', () => {
      const { plugin } = setupPluginWithData();

      expect(plugin.isExpanded('Electronics')).toBe(false);
      plugin.toggle('Electronics');
      expect(plugin.isExpanded('Electronics')).toBe(true);
      plugin.toggle('Electronics');
      expect(plugin.isExpanded('Electronics')).toBe(false);
    });

    it('expandAll should expand all groups', () => {
      const { plugin } = setupPluginWithData();

      plugin.expandAll();
      // With hierarchical groups, Electronics is a group
      expect(plugin.isExpanded('Electronics')).toBe(true);
      expect(plugin.isExpanded('Clothing')).toBe(true);
    });

    it('collapseAll should collapse all groups', () => {
      const { plugin } = setupPluginWithData();

      plugin.expandAll();
      plugin.collapseAll();
      expect(plugin.isExpanded('Electronics')).toBe(false);
      expect(plugin.isExpanded('Clothing')).toBe(false);
    });
  });

  describe('Public API', () => {
    it('enablePivot should activate pivot mode', () => {
      const plugin = new PivotPlugin({
        rowGroupFields: ['category'],
        valueFields: [{ field: 'sales', aggFunc: 'sum' }],
      });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as any);

      expect(plugin.isPivotActive()).toBe(false);
      plugin.enablePivot();
      expect(plugin.isPivotActive()).toBe(true);
    });

    it('disablePivot should deactivate pivot mode', () => {
      const plugin = new PivotPlugin({
        rowGroupFields: ['category'],
        valueFields: [{ field: 'sales', aggFunc: 'sum' }],
      });
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as any);

      plugin.enablePivot();
      expect(plugin.isPivotActive()).toBe(true);

      plugin.disablePivot();
      expect(plugin.isPivotActive()).toBe(false);
    });

    it('getPivotResult returns null when not active', () => {
      const plugin = new PivotPlugin({});
      expect(plugin.getPivotResult()).toBeNull();
    });

    it('setRowGroupFields updates config', () => {
      const plugin = new PivotPlugin({});
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as any);

      plugin.setRowGroupFields(['category', 'region']);
      // Config is private, but processColumns should use it
      expect(mockGrid.getRenderCount()).toBeGreaterThan(0);
    });

    it('setColumnGroupFields updates config', () => {
      const plugin = new PivotPlugin({});
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as any);

      plugin.setColumnGroupFields(['region']);
      expect(mockGrid.getRenderCount()).toBeGreaterThan(0);
    });

    it('setValueFields updates config', () => {
      const plugin = new PivotPlugin({});
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as any);

      plugin.setValueFields([{ field: 'sales', aggFunc: 'sum' }]);
      expect(mockGrid.getRenderCount()).toBeGreaterThan(0);
    });

    it('refresh clears pivot result and re-renders', () => {
      const plugin = new PivotPlugin({
        rowGroupFields: ['category'],
        valueFields: [{ field: 'sales', aggFunc: 'sum' }],
      });
      const mockGrid = createMockGrid();
      mockGrid.rows = [{ category: 'A', sales: 100 }];
      plugin.attach(mockGrid as any);
      plugin.enablePivot();
      plugin.processRows(mockGrid.rows);

      expect(plugin.getPivotResult()).not.toBeNull();

      const countBefore = mockGrid.getRenderCount();
      plugin.refresh();
      expect(mockGrid.getRenderCount()).toBeGreaterThan(countBefore);
    });
  });

  describe('Tool Panel API', () => {
    it('showPanel opens the pivot panel', () => {
      const plugin = new PivotPlugin({});
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as any);

      plugin.showPanel();
      expect(mockGrid.isToolPanelOpen).toBe(true);
      expect(mockGrid.expandedToolPanelSections).toContain('pivot');
    });

    it('hidePanel closes the tool panel', () => {
      const plugin = new PivotPlugin({});
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as any);

      plugin.showPanel();
      expect(mockGrid.isToolPanelOpen).toBe(true);

      plugin.hidePanel();
      expect(mockGrid.isToolPanelOpen).toBe(false);
    });

    it('togglePanel toggles the pivot panel section', () => {
      const plugin = new PivotPlugin({});
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as any);

      expect(mockGrid.isToolPanelOpen).toBe(false);
      plugin.togglePanel();
      expect(mockGrid.isToolPanelOpen).toBe(true);
      expect(mockGrid.expandedToolPanelSections).toContain('pivot');
      plugin.togglePanel();
      expect(mockGrid.expandedToolPanelSections).not.toContain('pivot');
    });

    it('isPanelVisible returns correct state', () => {
      const plugin = new PivotPlugin({});
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as any);

      expect(plugin.isPanelVisible()).toBe(false);
      plugin.showPanel();
      expect(plugin.isPanelVisible()).toBe(true);
      plugin.hidePanel();
      expect(plugin.isPanelVisible()).toBe(false);
    });
  });

  describe('processRows', () => {
    it('returns original rows when pivot is not active', () => {
      const plugin = new PivotPlugin({});
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as any);

      const rows = [{ a: 1 }, { a: 2 }];
      const result = plugin.processRows(rows);

      expect(result).toEqual(rows);
    });

    it('transforms rows when pivot is active', () => {
      const plugin = new PivotPlugin({
        rowGroupFields: ['category'],
        valueFields: [{ field: 'sales', aggFunc: 'sum' }],
      });
      const mockGrid = createMockGrid();
      mockGrid.rows = [
        { category: 'A', sales: 100 },
        { category: 'B', sales: 200 },
      ];
      plugin.attach(mockGrid as any);
      plugin.enablePivot();

      const result = plugin.processRows(mockGrid.rows);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('__pivotRowKey');
      expect(result[0]).toHaveProperty('__pivotLabel');
    });

    it('adds pivot metadata to rows', () => {
      const plugin = new PivotPlugin({
        rowGroupFields: ['category'],
        valueFields: [{ field: 'sales', aggFunc: 'sum' }],
        indentWidth: 24,
      });
      const mockGrid = createMockGrid();
      mockGrid.rows = [{ category: 'A', sales: 100 }];
      plugin.attach(mockGrid as any);
      plugin.enablePivot();

      const result = plugin.processRows(mockGrid.rows);

      expect(result[0]).toHaveProperty('__pivotDepth');
      expect(result[0]).toHaveProperty('__pivotIsGroup');
      expect(result[0]).toHaveProperty('__pivotHasChildren');
      expect(result[0]).toHaveProperty('__pivotIndent');
    });
  });

  describe('processColumns', () => {
    it('returns original columns when pivot is not active', () => {
      const plugin = new PivotPlugin({});
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as any);

      const columns = [{ field: 'a' }, { field: 'b' }];
      const result = plugin.processColumns(columns);

      expect(result).toEqual(columns);
    });

    it('generates pivot columns when active', () => {
      const plugin = new PivotPlugin({
        rowGroupFields: ['category'],
        columnGroupFields: ['region'],
        valueFields: [{ field: 'sales', aggFunc: 'sum' }],
        showTotals: true,
      });
      const mockGrid = createMockGrid();
      mockGrid.rows = [
        { category: 'A', region: 'North', sales: 100 },
        { category: 'A', region: 'South', sales: 200 },
      ];
      plugin.attach(mockGrid as any);
      plugin.enablePivot();
      plugin.processRows(mockGrid.rows);

      const result = plugin.processColumns([]);

      // Should have label column + value columns + total column
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].field).toBe('__pivotLabel');
      expect(result[result.length - 1].field).toBe('__pivotTotal');
    });

    it('omits total column when showTotals is false', () => {
      const plugin = new PivotPlugin({
        rowGroupFields: ['category'],
        valueFields: [{ field: 'sales', aggFunc: 'sum' }],
        showTotals: false,
      });
      const mockGrid = createMockGrid();
      mockGrid.rows = [{ category: 'A', sales: 100 }];
      plugin.attach(mockGrid as any);
      plugin.enablePivot();
      plugin.processRows(mockGrid.rows);

      const result = plugin.processColumns([]);

      expect(result.find((c) => c.field === '__pivotTotal')).toBeUndefined();
    });
  });

  describe('renderRow', () => {
    it('returns false for non-pivot rows when pivot is not active', () => {
      const plugin = new PivotPlugin({});
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as any);

      const rowEl = document.createElement('div');
      const result = plugin.renderRow({ someField: 'value' }, rowEl);

      expect(result).toBe(false);
    });

    it('returns true for pivot group rows', () => {
      const plugin = new PivotPlugin({
        rowGroupFields: ['category', 'subcategory'],
        valueFields: [{ field: 'sales', aggFunc: 'sum' }],
      });
      const mockGrid = createMockGrid();
      mockGrid.rows = [{ category: 'Electronics', subcategory: 'Phones', sales: 100 }];
      plugin.attach(mockGrid as any);
      plugin.enablePivot();
      plugin.processRows(mockGrid.rows);

      const rowEl = document.createElement('div');
      const pivotRow = {
        __pivotRowKey: 'Electronics',
        __pivotHasChildren: true,
        __pivotLabel: 'Electronics',
        __pivotDepth: 0,
        __pivotIsGroup: true,
      };

      const result = plugin.renderRow(pivotRow, rowEl);

      expect(result).toBe(true);
      expect(rowEl.classList.contains('pivot-group-row')).toBe(true);
    });

    it('returns true for pivot leaf rows when pivot is active', () => {
      const plugin = new PivotPlugin({
        rowGroupFields: ['category'],
        valueFields: [{ field: 'sales', aggFunc: 'sum' }],
      });
      const mockGrid = createMockGrid();
      mockGrid.rows = [{ category: 'Electronics', sales: 100 }];
      plugin.attach(mockGrid as any);
      plugin.enablePivot();
      plugin.processRows(mockGrid.rows);

      const rowEl = document.createElement('div');
      const leafRow = {
        __pivotRowKey: 'Electronics',
        __pivotHasChildren: false,
        __pivotLabel: 'Electronics',
        __pivotDepth: 0,
      };

      const result = plugin.renderRow(leafRow, rowEl);

      expect(result).toBe(true);
      expect(rowEl.classList.contains('pivot-leaf-row')).toBe(true);
    });

    it('cleans up pivot styling from reused row elements', () => {
      const plugin = new PivotPlugin({});
      const mockGrid = createMockGrid();
      plugin.attach(mockGrid as any);

      // Simulate a row element that was previously a pivot row
      const rowEl = document.createElement('div');
      rowEl.classList.add('pivot-group-row');
      rowEl.setAttribute('data-pivot-depth', '1');
      rowEl.innerHTML = '<div>old content</div>';

      // renderRow should clean up when pivot is not active
      plugin.renderRow({ normalField: 'value' }, rowEl);

      expect(rowEl.classList.contains('pivot-group-row')).toBe(false);
      expect(rowEl.classList.contains('data-grid-row')).toBe(true);
      expect(rowEl.hasAttribute('data-pivot-depth')).toBe(false);
      expect(rowEl.innerHTML).toBe('');
    });
  });

  // afterRender is always called with a valid grid attached, so no edge case test needed

  describe('Config validation in processRows', () => {
    it('returns original rows when config has errors', () => {
      const plugin = new PivotPlugin({
        // Missing valueFields - this will cause validation error
        rowGroupFields: ['category'],
      });
      const mockGrid = createMockGrid();
      mockGrid.rows = [{ category: 'A', sales: 100 }];
      plugin.attach(mockGrid as any);
      plugin.enablePivot();

      const result = plugin.processRows(mockGrid.rows);

      // Should return original rows due to validation error
      expect(result).toEqual(mockGrid.rows);
    });
  });
});
