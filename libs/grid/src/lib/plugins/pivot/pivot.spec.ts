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
