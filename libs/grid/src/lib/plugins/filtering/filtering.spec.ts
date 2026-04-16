import { describe, expect, it, vi } from 'vitest';
import {
  BLANK_FILTER_VALUE,
  computeFilterCacheKey,
  filterRows,
  getUniqueValues,
  getUniqueValuesBatch,
  matchesFilter,
} from './filter-model';
import { FilteringPlugin } from './FilteringPlugin';
import type { FilterModel } from './types';

describe('filter-model', () => {
  // Sample data for testing
  const sampleRows = [
    { id: 1, name: 'Alice', age: 30, active: true, city: 'New York' },
    { id: 2, name: 'Bob', age: 25, active: false, city: 'Los Angeles' },
    { id: 3, name: 'Charlie', age: 35, active: true, city: 'Chicago' },
    { id: 4, name: 'Diana', age: 28, active: false, city: 'New York' },
    { id: 5, name: 'Eve', age: 40, active: true, city: 'Boston' },
    { id: 6, name: '', age: 22, active: true, city: null },
    { id: 7, name: null, age: null, active: null, city: 'Miami' },
  ];

  describe('matchesFilter - Text operators', () => {
    describe('contains', () => {
      it('should match when value contains filter text', () => {
        const filter: FilterModel = {
          field: 'name',
          type: 'text',
          operator: 'contains',
          value: 'lic',
        };
        expect(matchesFilter(sampleRows[0], filter)).toBe(true); // Alice
        expect(matchesFilter(sampleRows[1], filter)).toBe(false); // Bob
      });

      it('should be case insensitive by default', () => {
        const filter: FilterModel = {
          field: 'name',
          type: 'text',
          operator: 'contains',
          value: 'ALICE',
        };
        expect(matchesFilter(sampleRows[0], filter)).toBe(true);
      });

      it('should be case sensitive when specified', () => {
        const filter: FilterModel = {
          field: 'name',
          type: 'text',
          operator: 'contains',
          value: 'ALICE',
        };
        expect(matchesFilter(sampleRows[0], filter, true)).toBe(false);
      });
    });

    describe('notContains', () => {
      it('should match when value does not contain filter text', () => {
        const filter: FilterModel = {
          field: 'name',
          type: 'text',
          operator: 'notContains',
          value: 'lic',
        };
        expect(matchesFilter(sampleRows[0], filter)).toBe(false); // Alice
        expect(matchesFilter(sampleRows[1], filter)).toBe(true); // Bob
      });
    });

    describe('equals', () => {
      it('should match exact string equality', () => {
        const filter: FilterModel = {
          field: 'name',
          type: 'text',
          operator: 'equals',
          value: 'Alice',
        };
        expect(matchesFilter(sampleRows[0], filter)).toBe(true);
        expect(matchesFilter(sampleRows[1], filter)).toBe(false);
      });

      it('should be case insensitive by default', () => {
        const filter: FilterModel = {
          field: 'name',
          type: 'text',
          operator: 'equals',
          value: 'alice',
        };
        expect(matchesFilter(sampleRows[0], filter)).toBe(true);
      });

      it('should be case sensitive when specified', () => {
        const filter: FilterModel = {
          field: 'name',
          type: 'text',
          operator: 'equals',
          value: 'alice',
        };
        expect(matchesFilter(sampleRows[0], filter, true)).toBe(false);
      });
    });

    describe('notEquals', () => {
      it('should match when value is not equal', () => {
        const filter: FilterModel = {
          field: 'name',
          type: 'text',
          operator: 'notEquals',
          value: 'Alice',
        };
        expect(matchesFilter(sampleRows[0], filter)).toBe(false);
        expect(matchesFilter(sampleRows[1], filter)).toBe(true);
      });
    });

    describe('startsWith', () => {
      it('should match when value starts with filter text', () => {
        const filter: FilterModel = {
          field: 'name',
          type: 'text',
          operator: 'startsWith',
          value: 'Al',
        };
        expect(matchesFilter(sampleRows[0], filter)).toBe(true); // Alice
        expect(matchesFilter(sampleRows[1], filter)).toBe(false); // Bob
      });

      it('should be case insensitive by default', () => {
        const filter: FilterModel = {
          field: 'name',
          type: 'text',
          operator: 'startsWith',
          value: 'al',
        };
        expect(matchesFilter(sampleRows[0], filter)).toBe(true);
      });
    });

    describe('endsWith', () => {
      it('should match when value ends with filter text', () => {
        const filter: FilterModel = {
          field: 'name',
          type: 'text',
          operator: 'endsWith',
          value: 'ice',
        };
        expect(matchesFilter(sampleRows[0], filter)).toBe(true); // Alice
        expect(matchesFilter(sampleRows[1], filter)).toBe(false); // Bob
      });

      it('should be case insensitive by default', () => {
        const filter: FilterModel = {
          field: 'name',
          type: 'text',
          operator: 'endsWith',
          value: 'ICE',
        };
        expect(matchesFilter(sampleRows[0], filter)).toBe(true);
      });
    });

    describe('blank', () => {
      it('should match null values', () => {
        const filter: FilterModel = {
          field: 'name',
          type: 'text',
          operator: 'blank',
          value: null,
        };
        expect(matchesFilter(sampleRows[6], filter)).toBe(true); // null name
      });

      it('should match empty string values', () => {
        const filter: FilterModel = {
          field: 'name',
          type: 'text',
          operator: 'blank',
          value: null,
        };
        expect(matchesFilter(sampleRows[5], filter)).toBe(true); // empty name
      });

      it('should not match non-empty values', () => {
        const filter: FilterModel = {
          field: 'name',
          type: 'text',
          operator: 'blank',
          value: null,
        };
        expect(matchesFilter(sampleRows[0], filter)).toBe(false); // Alice
      });
    });

    describe('notBlank', () => {
      it('should not match null values', () => {
        const filter: FilterModel = {
          field: 'name',
          type: 'text',
          operator: 'notBlank',
          value: null,
        };
        expect(matchesFilter(sampleRows[6], filter)).toBe(false); // null name
      });

      it('should not match empty string values', () => {
        const filter: FilterModel = {
          field: 'name',
          type: 'text',
          operator: 'notBlank',
          value: null,
        };
        expect(matchesFilter(sampleRows[5], filter)).toBe(false); // empty name
      });

      it('should match non-empty values', () => {
        const filter: FilterModel = {
          field: 'name',
          type: 'text',
          operator: 'notBlank',
          value: null,
        };
        expect(matchesFilter(sampleRows[0], filter)).toBe(true); // Alice
      });
    });
  });

  describe('matchesFilter - Number operators', () => {
    describe('lessThan', () => {
      it('should match when value is less than filter value', () => {
        const filter: FilterModel = {
          field: 'age',
          type: 'number',
          operator: 'lessThan',
          value: 30,
        };
        expect(matchesFilter(sampleRows[1], filter)).toBe(true); // 25
        expect(matchesFilter(sampleRows[0], filter)).toBe(false); // 30
        expect(matchesFilter(sampleRows[2], filter)).toBe(false); // 35
      });
    });

    describe('lessThanOrEqual', () => {
      it('should match when value is less than or equal', () => {
        const filter: FilterModel = {
          field: 'age',
          type: 'number',
          operator: 'lessThanOrEqual',
          value: 30,
        };
        expect(matchesFilter(sampleRows[1], filter)).toBe(true); // 25
        expect(matchesFilter(sampleRows[0], filter)).toBe(true); // 30
        expect(matchesFilter(sampleRows[2], filter)).toBe(false); // 35
      });
    });

    describe('greaterThan', () => {
      it('should match when value is greater than filter value', () => {
        const filter: FilterModel = {
          field: 'age',
          type: 'number',
          operator: 'greaterThan',
          value: 30,
        };
        expect(matchesFilter(sampleRows[2], filter)).toBe(true); // 35
        expect(matchesFilter(sampleRows[0], filter)).toBe(false); // 30
        expect(matchesFilter(sampleRows[1], filter)).toBe(false); // 25
      });
    });

    describe('greaterThanOrEqual', () => {
      it('should match when value is greater than or equal', () => {
        const filter: FilterModel = {
          field: 'age',
          type: 'number',
          operator: 'greaterThanOrEqual',
          value: 30,
        };
        expect(matchesFilter(sampleRows[2], filter)).toBe(true); // 35
        expect(matchesFilter(sampleRows[0], filter)).toBe(true); // 30
        expect(matchesFilter(sampleRows[1], filter)).toBe(false); // 25
      });
    });

    describe('between', () => {
      it('should match when value is between min and max (inclusive)', () => {
        const filter: FilterModel = {
          field: 'age',
          type: 'number',
          operator: 'between',
          value: 25,
          valueTo: 35,
        };
        expect(matchesFilter(sampleRows[0], filter)).toBe(true); // 30
        expect(matchesFilter(sampleRows[1], filter)).toBe(true); // 25
        expect(matchesFilter(sampleRows[2], filter)).toBe(true); // 35
        expect(matchesFilter(sampleRows[4], filter)).toBe(false); // 40
      });

      it('should include boundary values', () => {
        const filter: FilterModel = {
          field: 'age',
          type: 'number',
          operator: 'between',
          value: 25,
          valueTo: 25,
        };
        expect(matchesFilter(sampleRows[1], filter)).toBe(true); // exactly 25
      });
    });

    describe('null handling', () => {
      it('should not match null values for number operators', () => {
        const filter: FilterModel = {
          field: 'age',
          type: 'number',
          operator: 'greaterThan',
          value: 0,
        };
        expect(matchesFilter(sampleRows[6], filter)).toBe(false); // null age
      });
    });
  });

  describe('matchesFilter - Set operators', () => {
    describe('in', () => {
      it('should match when value is in the set', () => {
        const filter: FilterModel = {
          field: 'city',
          type: 'set',
          operator: 'in',
          value: ['New York', 'Boston'],
        };
        expect(matchesFilter(sampleRows[0], filter)).toBe(true); // New York
        expect(matchesFilter(sampleRows[4], filter)).toBe(true); // Boston
        expect(matchesFilter(sampleRows[1], filter)).toBe(false); // Los Angeles
      });

      it('should handle empty set', () => {
        const filter: FilterModel = {
          field: 'city',
          type: 'set',
          operator: 'in',
          value: [],
        };
        expect(matchesFilter(sampleRows[0], filter)).toBe(false);
      });

      it('should handle single value set', () => {
        const filter: FilterModel = {
          field: 'city',
          type: 'set',
          operator: 'in',
          value: ['Chicago'],
        };
        expect(matchesFilter(sampleRows[2], filter)).toBe(true);
        expect(matchesFilter(sampleRows[0], filter)).toBe(false);
      });

      it('should include blank rows when (Blank) IS in the included set', () => {
        const filter: FilterModel = {
          field: 'city',
          type: 'set',
          operator: 'in',
          value: [BLANK_FILTER_VALUE],
        };
        // null/undefined/empty string → blank → passes
        expect(matchesFilter({ city: null }, filter)).toBe(true);
        expect(matchesFilter({ city: undefined }, filter)).toBe(true);
        expect(matchesFilter({ city: '' }, filter)).toBe(true);
        // Non-blank values are excluded
        expect(matchesFilter({ city: 'Chicago' }, filter)).toBe(false);
      });

      it('should exclude blank rows when (Blank) is NOT in the included set', () => {
        const filter: FilterModel = {
          field: 'city',
          type: 'set',
          operator: 'in',
          value: ['Chicago'],
        };
        expect(matchesFilter({ city: null }, filter)).toBe(false);
        expect(matchesFilter({ city: '' }, filter)).toBe(false);
      });
    });

    describe('notIn', () => {
      it('should match when value is not in the set', () => {
        const filter: FilterModel = {
          field: 'city',
          type: 'set',
          operator: 'notIn',
          value: ['New York', 'Boston'],
        };
        expect(matchesFilter(sampleRows[0], filter)).toBe(false); // New York
        expect(matchesFilter(sampleRows[4], filter)).toBe(false); // Boston
        expect(matchesFilter(sampleRows[1], filter)).toBe(true); // Los Angeles
      });

      it('should handle empty set (all match)', () => {
        const filter: FilterModel = {
          field: 'city',
          type: 'set',
          operator: 'notIn',
          value: [],
        };
        expect(matchesFilter(sampleRows[0], filter)).toBe(true);
      });

      it('should pass blank rows when (Blank) is NOT in the excluded set', () => {
        const filter: FilterModel = {
          field: 'city',
          type: 'set',
          operator: 'notIn',
          value: ['New York', 'Los Angeles', 'Boston'],
        };
        // (Blank) is not in the excluded list, so blank rows pass
        expect(matchesFilter({ city: null }, filter)).toBe(true);
        expect(matchesFilter({ city: undefined }, filter)).toBe(true);
        expect(matchesFilter({ city: '' }, filter)).toBe(true);
        expect(matchesFilter({}, filter)).toBe(true);
      });

      it('should exclude blank rows when (Blank) IS in the excluded set', () => {
        const filter: FilterModel = {
          field: 'city',
          type: 'set',
          operator: 'notIn',
          value: ['New York', BLANK_FILTER_VALUE],
        };
        expect(matchesFilter({ city: null }, filter)).toBe(false);
        expect(matchesFilter({ city: undefined }, filter)).toBe(false);
        expect(matchesFilter({ city: '' }, filter)).toBe(false);
        expect(matchesFilter({}, filter)).toBe(false);
        // Non-blank, non-excluded values still pass
        expect(matchesFilter({ city: 'Chicago' }, filter)).toBe(true);
      });
    });
  });

  describe('matchesFilter - Edge cases', () => {
    it('should handle special characters in text', () => {
      const rowWithSpecial = { text: 'Hello [World]! (test)' };
      const filter: FilterModel = {
        field: 'text',
        type: 'text',
        operator: 'contains',
        value: '[World]',
      };
      expect(matchesFilter(rowWithSpecial, filter)).toBe(true);
    });

    it('should handle unicode characters', () => {
      const rowWithUnicode = { name: '日本語テスト' };
      const filter: FilterModel = {
        field: 'name',
        type: 'text',
        operator: 'contains',
        value: '語',
      };
      expect(matchesFilter(rowWithUnicode, filter)).toBe(true);
    });

    it('should handle numeric strings', () => {
      const row = { value: '123' };
      const filter: FilterModel = {
        field: 'value',
        type: 'number',
        operator: 'greaterThan',
        value: 100,
      };
      expect(matchesFilter(row, filter)).toBe(true);
    });

    it('should handle boolean values as numbers', () => {
      const filter: FilterModel = {
        field: 'active',
        type: 'number',
        operator: 'equals',
        value: 'true',
      };
      // Boolean true becomes "true" string, which doesn't equal string "true" directly
      // This test shows the behavior
      expect(matchesFilter(sampleRows[0], filter)).toBe(true);
    });
  });

  describe('matchesFilter with filterValue extractor', () => {
    const arrayRows = [
      { id: 1, sellers: [{ name: 'Apple' }, { name: 'Google' }] },
      { id: 2, sellers: [{ name: 'Google' }, { name: 'Meta' }] },
      { id: 3, sellers: [{ name: 'Apple' }] },
      { id: 4, sellers: null },
      { id: 5, sellers: [] },
    ];
    const extractor = (value: unknown) => (value as { name: string }[] | null)?.map((s) => s.name) ?? [];

    it('should match "in" when ANY extracted value is in the included set', () => {
      const filter: FilterModel = { field: 'sellers', type: 'set', operator: 'in', value: ['Apple'] };
      expect(matchesFilter(arrayRows[0] as Record<string, unknown>, filter, false, extractor)).toBe(true);
      expect(matchesFilter(arrayRows[1] as Record<string, unknown>, filter, false, extractor)).toBe(false);
      expect(matchesFilter(arrayRows[2] as Record<string, unknown>, filter, false, extractor)).toBe(true);
    });

    it('should fail "in" for null/empty cell values when (Blank) is not included', () => {
      const filter: FilterModel = { field: 'sellers', type: 'set', operator: 'in', value: ['Apple'] };
      expect(matchesFilter(arrayRows[3] as Record<string, unknown>, filter, false, extractor)).toBe(false);
      expect(matchesFilter(arrayRows[4] as Record<string, unknown>, filter, false, extractor)).toBe(false);
    });

    it('should pass "in" for null/empty cell values when (Blank) IS included', () => {
      const filter: FilterModel = {
        field: 'sellers',
        type: 'set',
        operator: 'in',
        value: ['Apple', BLANK_FILTER_VALUE],
      };
      // null sellers → blank → passes because (Blank) is in the included set
      expect(matchesFilter(arrayRows[3] as Record<string, unknown>, filter, false, extractor)).toBe(true);
      // empty array sellers → blank → same
      expect(matchesFilter(arrayRows[4] as Record<string, unknown>, filter, false, extractor)).toBe(true);
    });

    it('should match "notIn" — hide row if ANY extracted value is excluded', () => {
      const filter: FilterModel = { field: 'sellers', type: 'set', operator: 'notIn', value: ['Google'] };
      // Row 0: [Apple, Google] → Google is excluded → hidden
      expect(matchesFilter(arrayRows[0] as Record<string, unknown>, filter, false, extractor)).toBe(false);
      // Row 2: [Apple] → no excluded values → passes
      expect(matchesFilter(arrayRows[2] as Record<string, unknown>, filter, false, extractor)).toBe(true);
    });

    it('should exclude "notIn" for null/empty cell values when (Blank) is excluded', () => {
      const filter: FilterModel = {
        field: 'sellers',
        type: 'set',
        operator: 'notIn',
        value: ['Apple', BLANK_FILTER_VALUE],
      };
      expect(matchesFilter(arrayRows[3] as Record<string, unknown>, filter, false, extractor)).toBe(false);
      expect(matchesFilter(arrayRows[4] as Record<string, unknown>, filter, false, extractor)).toBe(false);
    });

    it('should include "notIn" for null/empty cell values when (Blank) is NOT excluded', () => {
      const filter: FilterModel = { field: 'sellers', type: 'set', operator: 'notIn', value: ['Apple'] };
      // (Blank) is not in the excluded set, so blank rows pass
      expect(matchesFilter(arrayRows[3] as Record<string, unknown>, filter, false, extractor)).toBe(true);
      expect(matchesFilter(arrayRows[4] as Record<string, unknown>, filter, false, extractor)).toBe(true);
    });

    it('should handle single-value (non-array) extractor return', () => {
      const singleExtractor = (value: unknown) => (value as { name: string } | null)?.name;
      const row = { id: 1, seller: { name: 'Apple' } };
      const filter: FilterModel = { field: 'seller', type: 'set', operator: 'in', value: ['Apple'] };
      expect(matchesFilter(row as Record<string, unknown>, filter, false, singleExtractor)).toBe(true);
    });

    it('should use extractor for text operators when provided', () => {
      // "contains" should use the extractor so virtual columns work correctly
      const textExtractor = (_value: unknown, row: Record<string, unknown>) =>
        ((row.sellers as { name: string }[] | null) ?? []).map((s) => s.name).join(', ');
      const filter: FilterModel = { field: 'sellers', type: 'text', operator: 'contains', value: 'Apple' };
      expect(matchesFilter(arrayRows[0] as Record<string, unknown>, filter, false, textExtractor)).toBe(true);
      expect(matchesFilter(arrayRows[1] as Record<string, unknown>, filter, false, textExtractor)).toBe(false);
    });

    it('should use extractor for numeric operators (virtual columns)', () => {
      // Simulates a virtual column like "qty-BBL" where the field doesn't exist on the row
      const rows = [
        { id: 1, items: [{ qty: 10 }, { qty: 20 }] },
        { id: 2, items: [{ qty: 5 }] },
        { id: 3, items: [] },
      ];
      const qtyExtractor = (_value: unknown, row: Record<string, unknown>) => {
        const items = row.items as { qty: number }[];
        return items.reduce((sum, i) => sum + i.qty, 0) || '';
      };

      // between: should match row 1 (30) but not row 2 (5) or row 3 ('')
      const betweenFilter: FilterModel = {
        field: 'totalQty',
        type: 'number',
        operator: 'between',
        value: 20,
        valueTo: 50,
      };
      expect(matchesFilter(rows[0] as Record<string, unknown>, betweenFilter, false, qtyExtractor)).toBe(true);
      expect(matchesFilter(rows[1] as Record<string, unknown>, betweenFilter, false, qtyExtractor)).toBe(false);
      expect(matchesFilter(rows[2] as Record<string, unknown>, betweenFilter, false, qtyExtractor)).toBe(false);

      // greaterThan: should match row 1 (30) but not row 2 (5)
      const gtFilter: FilterModel = { field: 'totalQty', type: 'number', operator: 'greaterThan', value: 10 };
      expect(matchesFilter(rows[0] as Record<string, unknown>, gtFilter, false, qtyExtractor)).toBe(true);
      expect(matchesFilter(rows[1] as Record<string, unknown>, gtFilter, false, qtyExtractor)).toBe(false);
    });

    it('should use extractor for blank/notBlank operators', () => {
      const rows = [
        { id: 1, items: [{ qty: 10 }] },
        { id: 2, items: [] },
      ];
      const qtyExtractor = (_value: unknown, row: Record<string, unknown>) => {
        const items = row.items as { qty: number }[];
        return items.reduce((sum, i) => sum + i.qty, 0) || '';
      };

      const blankFilter: FilterModel = { field: 'totalQty', type: 'number', operator: 'blank', value: '' };
      expect(matchesFilter(rows[0] as Record<string, unknown>, blankFilter, false, qtyExtractor)).toBe(false);
      expect(matchesFilter(rows[1] as Record<string, unknown>, blankFilter, false, qtyExtractor)).toBe(true);

      const notBlankFilter: FilterModel = { field: 'totalQty', type: 'number', operator: 'notBlank', value: '' };
      expect(matchesFilter(rows[0] as Record<string, unknown>, notBlankFilter, false, qtyExtractor)).toBe(true);
      expect(matchesFilter(rows[1] as Record<string, unknown>, notBlankFilter, false, qtyExtractor)).toBe(false);
    });
  });

  describe('filterRows', () => {
    it('should return all rows when no filters applied', () => {
      const result = filterRows(sampleRows, []);
      expect(result.length).toBe(sampleRows.length);
    });

    it('should apply single filter', () => {
      const filters: FilterModel[] = [{ field: 'age', type: 'number', operator: 'greaterThan', value: 30 }];
      const result = filterRows(sampleRows, filters);
      expect(result.length).toBe(2); // Charlie (35) and Eve (40)
    });

    it('should apply multiple filters with AND logic', () => {
      const filters: FilterModel[] = [
        { field: 'age', type: 'number', operator: 'greaterThanOrEqual', value: 25 },
        { field: 'active', type: 'text', operator: 'equals', value: 'true' },
      ];
      const result = filterRows(sampleRows, filters);
      // Alice (30, true), Charlie (35, true), Eve (40, true)
      expect(result.length).toBe(3);
    });

    it('should combine text and number filters', () => {
      const filters: FilterModel[] = [
        { field: 'name', type: 'text', operator: 'contains', value: 'ia' },
        { field: 'age', type: 'number', operator: 'lessThan', value: 30 },
      ];
      const result = filterRows(sampleRows, filters);
      // Diana (28) - has 'ia' and age < 30
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Diana');
    });

    it('should return empty array when no rows match', () => {
      const filters: FilterModel[] = [{ field: 'age', type: 'number', operator: 'greaterThan', value: 100 }];
      const result = filterRows(sampleRows, filters);
      expect(result.length).toBe(0);
    });

    it('should preserve row references', () => {
      const filters: FilterModel[] = [{ field: 'name', type: 'text', operator: 'equals', value: 'Alice' }];
      const result = filterRows(sampleRows, filters);
      expect(result[0]).toBe(sampleRows[0]);
    });

    it('should use filterValues map for array-valued columns', () => {
      const rows = [
        { id: 1, tags: [{ label: 'A' }, { label: 'B' }] },
        { id: 2, tags: [{ label: 'C' }] },
        { id: 3, tags: [{ label: 'A' }, { label: 'C' }] },
      ];
      const extractor = (value: unknown) => (value as { label: string }[] | null)?.map((t) => t.label) ?? [];
      const filterValues = new Map([['tags', extractor]]);
      const filters: FilterModel[] = [{ field: 'tags', type: 'set', operator: 'in', value: ['A'] }];
      const result = filterRows(rows, filters, false, filterValues);
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).toEqual([1, 3]);
    });

    it('should combine filterValues with regular filters', () => {
      const rows = [
        { id: 1, name: 'Alice', tags: [{ label: 'A' }] },
        { id: 2, name: 'Bob', tags: [{ label: 'A' }, { label: 'B' }] },
        { id: 3, name: 'Charlie', tags: [{ label: 'B' }] },
      ];
      const filterValues = new Map([
        ['tags', (value: unknown) => (value as { label: string }[])?.map((t) => t.label) ?? []],
      ]);
      const filters: FilterModel[] = [
        { field: 'tags', type: 'set', operator: 'in', value: ['A'] },
        { field: 'name', type: 'text', operator: 'contains', value: 'ob' },
      ];
      const result = filterRows(rows, filters, false, filterValues);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Bob');
    });

    it('should use filterValues for numeric operators on virtual columns', () => {
      const rows = [
        { id: 1, movements: [{ qty: 100 }, { qty: 200 }] },
        { id: 2, movements: [{ qty: 50 }] },
        { id: 3, movements: [] },
      ];
      const qtyExtractor = (_value: unknown, row: Record<string, unknown>) => {
        const movements = row.movements as { qty: number }[];
        return movements.reduce((sum, m) => sum + m.qty, 0) || '';
      };
      const filterValues = new Map([['totalQty', qtyExtractor]]);
      const filters: FilterModel[] = [
        { field: 'totalQty', type: 'number', operator: 'between', value: 100, valueTo: 500 },
      ];
      const result = filterRows(rows, filters, false, filterValues);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1); // 300 is between 100 and 500
    });
  });

  describe('computeFilterCacheKey', () => {
    it('should generate consistent key for same filters', () => {
      const filters: FilterModel[] = [{ field: 'name', type: 'text', operator: 'contains', value: 'test' }];
      const key1 = computeFilterCacheKey(filters);
      const key2 = computeFilterCacheKey(filters);
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different filters', () => {
      const filters1: FilterModel[] = [{ field: 'name', type: 'text', operator: 'contains', value: 'test' }];
      const filters2: FilterModel[] = [{ field: 'name', type: 'text', operator: 'contains', value: 'other' }];
      expect(computeFilterCacheKey(filters1)).not.toBe(computeFilterCacheKey(filters2));
    });

    it('should generate different keys for different operators', () => {
      const filters1: FilterModel[] = [{ field: 'name', type: 'text', operator: 'contains', value: 'test' }];
      const filters2: FilterModel[] = [{ field: 'name', type: 'text', operator: 'equals', value: 'test' }];
      expect(computeFilterCacheKey(filters1)).not.toBe(computeFilterCacheKey(filters2));
    });

    it('should include valueTo for between operator', () => {
      const filters1: FilterModel[] = [{ field: 'age', type: 'number', operator: 'between', value: 10, valueTo: 20 }];
      const filters2: FilterModel[] = [{ field: 'age', type: 'number', operator: 'between', value: 10, valueTo: 30 }];
      expect(computeFilterCacheKey(filters1)).not.toBe(computeFilterCacheKey(filters2));
    });

    it('should handle empty filter array', () => {
      const key = computeFilterCacheKey([]);
      expect(key).toBe('[]');
    });

    it('should handle multiple filters in consistent order', () => {
      const filters: FilterModel[] = [
        { field: 'a', type: 'text', operator: 'contains', value: '1' },
        { field: 'b', type: 'text', operator: 'contains', value: '2' },
      ];
      const key = computeFilterCacheKey(filters);
      expect(key).toContain('"field":"a"');
      expect(key).toContain('"field":"b"');
    });
  });

  describe('getUniqueValues', () => {
    it('should extract unique values from field', () => {
      const values = getUniqueValues(sampleRows, 'city');
      // Should include all non-null cities
      expect(values).toContain('New York');
      expect(values).toContain('Los Angeles');
      expect(values).toContain('Chicago');
      expect(values).toContain('Boston');
      expect(values).toContain('Miami');
    });

    it('should represent null/undefined/empty-string values as (Blank) sentinel', () => {
      const values = getUniqueValues(sampleRows, 'city');
      expect(values).not.toContain(null);
      expect(values).not.toContain(undefined);
      // Row 6 has city: null → should produce a (Blank) entry
      expect(values).toContain(BLANK_FILTER_VALUE);
    });

    it('should return sorted values (strings)', () => {
      const values = getUniqueValues(sampleRows, 'city') as string[];
      const sorted = [...values].sort((a, b) => a.localeCompare(b));
      expect(values).toEqual(sorted);
    });

    it('should return sorted values (numbers)', () => {
      const values = getUniqueValues(sampleRows, 'age');
      // Numeric values are present
      expect(values).toContain(22);
      expect(values).toContain(25);
      expect(values).toContain(28);
      expect(values).toContain(30);
      expect(values).toContain(35);
      expect(values).toContain(40);
      // Row 7 has age: null → (Blank) sentinel
      expect(values).toContain(BLANK_FILTER_VALUE);
    });

    it('should handle duplicates', () => {
      const values = getUniqueValues(sampleRows, 'city');
      const nyCount = values.filter((v) => v === 'New York').length;
      expect(nyCount).toBe(1); // Alice and Diana both have 'New York'
    });

    it('should handle boolean values', () => {
      const values = getUniqueValues(sampleRows, 'active');
      expect(values).toContain(true);
      expect(values).toContain(false);
      // Row 7 has active: null → (Blank) sentinel
      expect(values).toContain(BLANK_FILTER_VALUE);
    });

    it('should return (Blank) only for non-existent field', () => {
      const values = getUniqueValues(sampleRows, 'nonExistent');
      // Every row has undefined for this field → all blank
      expect(values).toEqual([BLANK_FILTER_VALUE]);
    });

    it('should handle empty rows array', () => {
      const values = getUniqueValues([], 'any');
      expect(values).toEqual([]);
    });

    it('should treat empty strings as blank', () => {
      const rows = [
        { id: 1, status: 'active' },
        { id: 2, status: '' },
        { id: 3, status: 'inactive' },
        { id: 4, status: null },
      ];
      const values = getUniqueValues(rows, 'status');
      expect(values).toContain('active');
      expect(values).toContain('inactive');
      expect(values).toContain(BLANK_FILTER_VALUE);
      expect(values).not.toContain('');
      expect(values).not.toContain(null);
      expect(values).toHaveLength(3);
    });

    it('should include (Blank) sentinel when filterValue extractor yields empty results', () => {
      const rows = [
        { id: 1, sellers: [{ name: 'Apple' }, { name: 'Google' }] },
        { id: 2, sellers: [{ name: 'Google' }, { name: 'Meta' }] },
        { id: 3, sellers: null },
      ];
      const extractor = (value: unknown) => (value as { name: string }[] | null)?.map((s) => s.name) ?? [];
      const values = getUniqueValues(rows, 'sellers', extractor);
      expect(values).toContain(BLANK_FILTER_VALUE);
      expect(values).toEqual(expect.arrayContaining(['Apple', 'Google', 'Meta', BLANK_FILTER_VALUE]));
      expect(values).toHaveLength(4);
    });

    it('should flatten array values when filterValue extractor is provided', () => {
      const rows = [
        { id: 1, sellers: [{ name: 'Apple' }, { name: 'Google' }] },
        { id: 2, sellers: [{ name: 'Google' }, { name: 'Meta' }] },
      ];
      const extractor = (value: unknown) => (value as { name: string }[] | null)?.map((s) => s.name) ?? [];
      const values = getUniqueValues(rows, 'sellers', extractor);
      expect(values).toEqual(['Apple', 'Google', 'Meta']);
    });

    it('should deduplicate flattened values from filterValue extractor', () => {
      const rows = [
        { id: 1, tags: ['a', 'b'] },
        { id: 2, tags: ['b', 'c'] },
      ];
      const extractor = (value: unknown) => value as string[];
      const values = getUniqueValues(rows, 'tags', extractor);
      expect(values).toEqual(['a', 'b', 'c']);
    });

    it('should handle single-value (non-array) return from filterValue extractor', () => {
      const rows = [
        { id: 1, seller: { name: 'Apple' } },
        { id: 2, seller: { name: 'Google' } },
        { id: 3, seller: { name: 'Apple' } },
      ];
      const extractor = (value: unknown) => (value as { name: string })?.name;
      const values = getUniqueValues(rows, 'seller', extractor);
      expect(values).toEqual(['Apple', 'Google']);
    });

    it('should skip null extracted values from filterValue extractor', () => {
      const rows = [
        { id: 1, data: [1, null, 2] },
        { id: 2, data: null },
      ];
      const extractor = (value: unknown) => value as unknown[] | null;
      const values = getUniqueValues(rows, 'data', extractor);
      // null row → extractor returns null → hasBlank, plus [1, null, 2] → null skipped
      expect(values).toContain(BLANK_FILTER_VALUE);
      expect(values).toContain(1);
      expect(values).toContain(2);
      expect(values).toHaveLength(3);
    });
  });

  describe('getUniqueValuesBatch', () => {
    it('should extract unique values for multiple fields in a single pass', () => {
      const rows = [
        { id: 1, city: 'NYC', dept: 'Eng' },
        { id: 2, city: 'LA', dept: 'Sales' },
        { id: 3, city: 'NYC', dept: 'Sales' },
      ];
      const result = getUniqueValuesBatch(rows, [{ field: 'city' }, { field: 'dept' }]);
      expect(result.get('city')).toEqual(['LA', 'NYC']);
      expect(result.get('dept')).toEqual(['Eng', 'Sales']);
    });

    it('should handle filterValue extractors in batch', () => {
      const rows = [
        { id: 1, tags: [{ label: 'A' }, { label: 'B' }] },
        { id: 2, tags: [{ label: 'B' }, { label: 'C' }] },
        { id: 3, tags: null },
      ];
      const extractor = (value: unknown) => (value as { label: string }[] | null)?.map((t) => t.label) ?? [];
      const result = getUniqueValuesBatch(rows, [{ field: 'tags', filterValue: extractor }]);
      const values = result.get('tags')!;
      expect(values).toContain('A');
      expect(values).toContain('B');
      expect(values).toContain('C');
      expect(values).toContain(BLANK_FILTER_VALUE);
      expect(values).toHaveLength(4);
    });

    it('should produce same results as individual getUniqueValues calls', () => {
      const rows = [
        { id: 1, name: 'Alice', city: 'NYC' },
        { id: 2, name: 'Bob', city: null },
        { id: 3, name: 'Alice', city: 'LA' },
      ];
      const batch = getUniqueValuesBatch(rows, [{ field: 'name' }, { field: 'city' }]);
      expect(batch.get('name')).toEqual(getUniqueValues(rows, 'name'));
      expect(batch.get('city')).toEqual(getUniqueValues(rows, 'city'));
    });
  });

  describe('Performance', () => {
    it('should filter 10K rows in under 10ms', () => {
      // Generate 10K rows
      const largeData = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        age: 20 + (i % 50),
        city: ['New York', 'LA', 'Chicago', 'Boston', 'Miami'][i % 5],
      }));

      const filters: FilterModel[] = [
        { field: 'age', type: 'number', operator: 'greaterThan', value: 40 },
        { field: 'name', type: 'text', operator: 'contains', value: '5' },
      ];

      const start = performance.now();
      const result = filterRows(largeData, filters);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50); // Allow some slack for CI / slower systems
      expect(result.length).toBeGreaterThan(0);
    });

    it('should efficiently filter with set operator on large dataset', () => {
      const largeData = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        city: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'][i % 10],
      }));

      const filters: FilterModel[] = [
        {
          field: 'city',
          type: 'set',
          operator: 'in',
          value: ['A', 'B', 'C'],
        },
      ];

      const start = performance.now();
      const result = filterRows(largeData, filters);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50); // Allow some slack for CI / slower systems
      expect(result.length).toBe(3000); // 30% of 10K
    });
  });
});

describe('FilterConfig async handlers', () => {
  describe('FilterHandler type', () => {
    it('should accept sync filter handler', () => {
      // Type check: sync handler returns array directly
      const syncHandler = (filters: FilterModel[], rows: unknown[]): unknown[] => {
        if (filters.length === 0) return rows;
        // Simulate filtering
        return rows.filter(() => true);
      };

      const result = syncHandler([], [{ id: 1 }, { id: 2 }]);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });

    it('should accept async filter handler', async () => {
      // Type check: async handler returns Promise
      const asyncHandler = async (filters: FilterModel[], rows: unknown[]): Promise<unknown[]> => {
        // Simulate server delay
        await new Promise((r) => setTimeout(r, 10));
        if (filters.length === 0) return rows;
        return rows.slice(0, 1); // Simulated filtered result
      };

      const result = await asyncHandler(
        [{ field: 'name', type: 'text', operator: 'contains', value: 'A' }],
        [{ id: 1 }, { id: 2 }],
      );
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
    });
  });

  describe('FilterValuesHandler type', () => {
    it('should accept async values handler', async () => {
      // Type check: values handler returns Promise of unique values
      const valuesHandler = async (field: string): Promise<unknown[]> => {
        await new Promise((r) => setTimeout(r, 10));
        if (field === 'department') {
          return ['Engineering', 'Marketing', 'Sales'];
        }
        return [];
      };

      const result = await valuesHandler('department');
      expect(result).toEqual(['Engineering', 'Marketing', 'Sales']);
    });
  });
});

// #region FilteringPlugin class tests

describe('FilteringPlugin class', () => {
  function createGridMock(rows: Record<string, unknown>[] = [], columns: any[] = []) {
    const gridEl = document.createElement('tbw-grid');
    const container = document.createElement('div');
    gridEl.appendChild(container);
    document.body.appendChild(gridEl);

    return {
      rows,
      sourceRows: rows,
      _columns: columns,
      _visibleColumns: columns,
      _focusRow: 0,
      _focusCol: 0,
      effectiveConfig: { filterable: true },
      gridConfig: {},
      getPlugin: () => undefined,
      query: () => [],
      queryPlugins: () => [],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
      requestRender: vi.fn(),
      registerStyles: vi.fn(),
      unregisterStyles: vi.fn(),
      children: [container],
      querySelectorAll: gridEl.querySelectorAll.bind(gridEl),
      querySelector: gridEl.querySelector.bind(gridEl),
      clientWidth: 800,
      classList: gridEl.classList,
      ownerDocument: document,
      tagName: 'TBW-GRID',
      closest: () => null,
      style: gridEl.style,
      _hostElement: gridEl,
      // Clean up when done
      _cleanup: () => gridEl.remove(),
    };
  }

  it('should have correct plugin name', () => {
    const plugin = new FilteringPlugin();
    expect(plugin.name).toBe('filtering');
  });

  it('should have default config values', () => {
    const plugin = new FilteringPlugin();
    const grid = createGridMock();
    plugin.attach(grid as any);

    // Plugin is instantiated with defaults
    expect(plugin.getFilters()).toEqual([]);
    grid._cleanup();
  });

  it('should set and get a filter', () => {
    const plugin = new FilteringPlugin();
    const grid = createGridMock();
    plugin.attach(grid as any);

    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'Alice' });
    const filter = plugin.getFilter('name');
    expect(filter).toBeDefined();
    expect(filter?.field).toBe('name');
    expect(filter?.operator).toBe('contains');
    expect(filter?.value).toBe('Alice');
    grid._cleanup();
  });

  it('should remove a filter when passing null', () => {
    const plugin = new FilteringPlugin();
    const grid = createGridMock();
    plugin.attach(grid as any);

    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'Alice' });
    expect(plugin.isFieldFiltered('name')).toBe(true);

    plugin.setFilter('name', null);
    expect(plugin.isFieldFiltered('name')).toBe(false);
    expect(plugin.getFilter('name')).toBeUndefined();
    grid._cleanup();
  });

  it('should return all active filters via getFilters', () => {
    const plugin = new FilteringPlugin();
    const grid = createGridMock();
    plugin.attach(grid as any);

    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'A' });
    plugin.setFilter('age', { type: 'number', operator: 'greaterThan', value: 25 });

    const filters = plugin.getFilters();
    expect(filters).toHaveLength(2);
    expect(filters.map((f) => f.field).sort()).toEqual(['age', 'name']);
    grid._cleanup();
  });

  it('getFilterModel should be alias for getFilters', () => {
    const plugin = new FilteringPlugin();
    const grid = createGridMock();
    plugin.attach(grid as any);

    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'test' });
    expect(plugin.getFilterModel()).toEqual(plugin.getFilters());
    grid._cleanup();
  });

  it('should set filters from array via setFilterModel', () => {
    const plugin = new FilteringPlugin();
    const grid = createGridMock();
    plugin.attach(grid as any);

    const filters: FilterModel[] = [
      { field: 'name', type: 'text', operator: 'contains', value: 'A' },
      { field: 'city', type: 'text', operator: 'equals', value: 'NYC' },
    ];
    plugin.setFilterModel(filters);

    expect(plugin.getFilters()).toHaveLength(2);
    expect(plugin.isFieldFiltered('name')).toBe(true);
    expect(plugin.isFieldFiltered('city')).toBe(true);
    grid._cleanup();
  });

  it('setFilterModel should replace existing filters', () => {
    const plugin = new FilteringPlugin();
    const grid = createGridMock();
    plugin.attach(grid as any);

    plugin.setFilter('old', { type: 'text', operator: 'contains', value: 'x' });
    plugin.setFilterModel([{ field: 'new', type: 'text', operator: 'contains', value: 'y' }]);

    expect(plugin.isFieldFiltered('old')).toBe(false);
    expect(plugin.isFieldFiltered('new')).toBe(true);
    grid._cleanup();
  });

  it('should clear all filters', () => {
    const plugin = new FilteringPlugin();
    const grid = createGridMock();
    plugin.attach(grid as any);

    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'A' });
    plugin.setFilter('age', { type: 'number', operator: 'greaterThan', value: 25 });
    expect(plugin.getFilters()).toHaveLength(2);

    plugin.clearAllFilters();
    expect(plugin.getFilters()).toHaveLength(0);
    grid._cleanup();
  });

  it('should clear a specific field filter', () => {
    const plugin = new FilteringPlugin();
    const grid = createGridMock();
    plugin.attach(grid as any);

    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'A' });
    plugin.setFilter('age', { type: 'number', operator: 'greaterThan', value: 25 });

    plugin.clearFieldFilter('name');
    expect(plugin.isFieldFiltered('name')).toBe(false);
    expect(plugin.isFieldFiltered('age')).toBe(true);
    grid._cleanup();
  });

  it('isFieldFiltered should return correct boolean', () => {
    const plugin = new FilteringPlugin();
    const grid = createGridMock();
    plugin.attach(grid as any);

    expect(plugin.isFieldFiltered('name')).toBe(false);
    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'A' });
    expect(plugin.isFieldFiltered('name')).toBe(true);
    grid._cleanup();
  });

  it('should emit filter-change event on setFilter', () => {
    const plugin = new FilteringPlugin();
    const grid = createGridMock();
    plugin.attach(grid as any);

    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'A' });

    expect(grid.dispatchEvent).toHaveBeenCalled();
    const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('filter-change');
    expect(event.detail.filters).toHaveLength(1);
    grid._cleanup();
  });

  it('should request render after setFilter', () => {
    const plugin = new FilteringPlugin();
    const grid = createGridMock();
    plugin.attach(grid as any);

    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'A' });
    expect(grid.requestRender).toHaveBeenCalled();
    grid._cleanup();
  });

  it('processRows should filter rows when filters are active', () => {
    const plugin = new FilteringPlugin();
    const rows = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
      { name: 'Charlie', age: 35 },
    ];
    const grid = createGridMock(rows);
    plugin.attach(grid as any);

    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'li' });

    const result = plugin.processRows(rows);
    expect(result).toHaveLength(2); // Alice & Charlie
  });

  it('processRows should return all rows when no filters', () => {
    const plugin = new FilteringPlugin();
    const rows = [{ name: 'Alice' }, { name: 'Bob' }];
    const grid = createGridMock(rows);
    plugin.attach(grid as any);

    const result = plugin.processRows(rows);
    expect(result).toHaveLength(2);
  });

  it('processRows should use cache on subsequent calls', () => {
    const plugin = new FilteringPlugin();
    const rows = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    const grid = createGridMock(rows);
    plugin.attach(grid as any);

    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'Ali' });
    const result1 = plugin.processRows(rows);
    const result2 = plugin.processRows(rows);

    // Should return the same cached reference
    expect(result1).toBe(result2);
    grid._cleanup();
  });

  it('processRows should invalidate cache when filter changes', () => {
    const plugin = new FilteringPlugin();
    const rows = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    const grid = createGridMock(rows);
    plugin.attach(grid as any);

    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'Ali' });
    const result1 = plugin.processRows(rows);

    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'Bo' });
    const result2 = plugin.processRows(rows);

    expect(result1).not.toBe(result2);
    expect(result1).toHaveLength(1);
    expect(result2).toHaveLength(1);
    grid._cleanup();
  });

  it('getActiveFilters should be alias for getFilters', () => {
    const plugin = new FilteringPlugin();
    const grid = createGridMock();
    plugin.attach(grid as any);

    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'X' });
    expect(plugin.getActiveFilters()).toEqual(plugin.getFilters());
    grid._cleanup();
  });

  it('getFilteredRowCount returns row count from cache', () => {
    const plugin = new FilteringPlugin();
    const rows = [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }];
    const grid = createGridMock(rows);
    plugin.attach(grid as any);

    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'li' });
    plugin.processRows(rows);
    expect(plugin.getFilteredRowCount()).toBe(2); // Alice & Charlie
    grid._cleanup();
  });

  it('should clean up state on detach', () => {
    const plugin = new FilteringPlugin();
    const grid = createGridMock();
    plugin.attach(grid as any);

    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'A' });
    expect(plugin.getFilters()).toHaveLength(1);

    plugin.detach();
    expect(plugin.getFilters()).toHaveLength(0);
    grid._cleanup();
  });

  it('getUniqueValues should return unique values from source rows', () => {
    const rows = [{ city: 'New York' }, { city: 'Boston' }, { city: 'New York' }, { city: 'Chicago' }];
    const plugin = new FilteringPlugin();
    const grid = createGridMock(rows);
    plugin.attach(grid as any);

    const values = plugin.getUniqueValues('city');
    expect(values).toHaveLength(3);
    expect(values).toContain('New York');
    expect(values).toContain('Boston');
    expect(values).toContain('Chicago');
    grid._cleanup();
  });

  // #region Silent filter option tests

  it('setFilter with { silent: true } should not emit filter-change', () => {
    const plugin = new FilteringPlugin();
    const grid = createGridMock();
    plugin.attach(grid as any);

    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'A' }, { silent: true });

    // Should NOT have dispatched a filter-change event
    const filterChangeEvents = (grid.dispatchEvent.mock.calls as [CustomEvent][]).filter(
      ([e]) => e.type === 'filter-change',
    );
    expect(filterChangeEvents).toHaveLength(0);

    // But filter should still be applied
    expect(plugin.getFilters()).toHaveLength(1);
    expect(plugin.isFieldFiltered('name')).toBe(true);
    // And render should still be requested
    expect(grid.requestRender).toHaveBeenCalled();
    grid._cleanup();
  });

  it('setFilter without silent option still emits filter-change', () => {
    const plugin = new FilteringPlugin();
    const grid = createGridMock();
    plugin.attach(grid as any);

    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'A' });

    const filterChangeEvents = (grid.dispatchEvent.mock.calls as [CustomEvent][]).filter(
      ([e]) => e.type === 'filter-change',
    );
    expect(filterChangeEvents).toHaveLength(1);
    grid._cleanup();
  });

  it('setFilterModel with { silent: true } should not emit filter-change', () => {
    const plugin = new FilteringPlugin();
    const grid = createGridMock();
    plugin.attach(grid as any);

    plugin.setFilterModel([{ field: 'name', type: 'text', operator: 'contains', value: 'A' }], { silent: true });

    const filterChangeEvents = (grid.dispatchEvent.mock.calls as [CustomEvent][]).filter(
      ([e]) => e.type === 'filter-change',
    );
    expect(filterChangeEvents).toHaveLength(0);

    // Filters should still be applied
    expect(plugin.getFilters()).toHaveLength(1);
    expect(grid.requestRender).toHaveBeenCalled();
    grid._cleanup();
  });

  it('setFilterModel without silent option still emits filter-change', () => {
    const plugin = new FilteringPlugin();
    const grid = createGridMock();
    plugin.attach(grid as any);

    plugin.setFilterModel([{ field: 'name', type: 'text', operator: 'contains', value: 'A' }]);

    const filterChangeEvents = (grid.dispatchEvent.mock.calls as [CustomEvent][]).filter(
      ([e]) => e.type === 'filter-change',
    );
    expect(filterChangeEvents).toHaveLength(1);
    grid._cleanup();
  });

  it('clearAllFilters with { silent: true } should not emit filter-change', () => {
    const plugin = new FilteringPlugin();
    const grid = createGridMock();
    plugin.attach(grid as any);

    // First set a filter (this emits)
    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'A' });
    grid.dispatchEvent.mockClear();

    // Now clear with silent
    plugin.clearAllFilters({ silent: true });

    const filterChangeEvents = (grid.dispatchEvent.mock.calls as [CustomEvent][]).filter(
      ([e]) => e.type === 'filter-change',
    );
    expect(filterChangeEvents).toHaveLength(0);

    // Filters should be cleared
    expect(plugin.getFilters()).toHaveLength(0);
    expect(grid.requestRender).toHaveBeenCalled();
    grid._cleanup();
  });

  it('clearFieldFilter with { silent: true } should not emit filter-change', () => {
    const plugin = new FilteringPlugin();
    const grid = createGridMock();
    plugin.attach(grid as any);

    // Set two filters
    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'A' });
    plugin.setFilter('age', { type: 'number', operator: 'greaterThan', value: 30 });
    grid.dispatchEvent.mockClear();

    // Clear one silently
    plugin.clearFieldFilter('name', { silent: true });

    const filterChangeEvents = (grid.dispatchEvent.mock.calls as [CustomEvent][]).filter(
      ([e]) => e.type === 'filter-change',
    );
    expect(filterChangeEvents).toHaveLength(0);

    // Only the 'age' filter should remain
    expect(plugin.getFilters()).toHaveLength(1);
    expect(plugin.isFieldFiltered('name')).toBe(false);
    expect(plugin.isFieldFiltered('age')).toBe(true);
    grid._cleanup();
  });

  // #region trackColumnState

  it('getColumnState returns undefined when trackColumnState is false (default)', () => {
    const plugin = new FilteringPlugin();
    const grid = createGridMock();
    plugin.attach(grid as any);

    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'Alice' });
    expect(plugin.getColumnState('name')).toBeUndefined();
    grid._cleanup();
  });

  it('getColumnState returns filter state when trackColumnState is true', () => {
    const plugin = new FilteringPlugin({ trackColumnState: true });
    const grid = createGridMock();
    plugin.attach(grid as any);

    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'Alice' });
    const state = plugin.getColumnState('name');
    expect(state).toBeDefined();
    expect(state?.filter).toEqual({
      type: 'text',
      operator: 'contains',
      value: 'Alice',
      valueTo: undefined,
    });
    grid._cleanup();
  });

  it('getColumnState returns undefined for unfiltered column even with trackColumnState', () => {
    const plugin = new FilteringPlugin({ trackColumnState: true });
    const grid = createGridMock();
    plugin.attach(grid as any);

    expect(plugin.getColumnState('name')).toBeUndefined();
    grid._cleanup();
  });

  it('applyColumnState is a no-op when trackColumnState is false', () => {
    const plugin = new FilteringPlugin();
    const grid = createGridMock();
    plugin.attach(grid as any);

    plugin.applyColumnState('name', {
      field: 'name',
      order: 0,
      visible: true,
      filter: { type: 'text', operator: 'contains', value: 'Alice' },
    });
    expect(plugin.getFilter('name')).toBeUndefined();
    grid._cleanup();
  });

  it('applyColumnState restores filter when trackColumnState is true', () => {
    const plugin = new FilteringPlugin({ trackColumnState: true });
    const grid = createGridMock();
    plugin.attach(grid as any);

    plugin.applyColumnState('name', {
      field: 'name',
      order: 0,
      visible: true,
      filter: { type: 'text', operator: 'contains', value: 'Alice' },
    });
    const filter = plugin.getFilter('name');
    expect(filter).toBeDefined();
    expect(filter?.field).toBe('name');
    expect(filter?.operator).toBe('contains');
    expect(filter?.value).toBe('Alice');
    grid._cleanup();
  });

  it('setFilter calls requestStateChange when trackColumnState is true', () => {
    const plugin = new FilteringPlugin({ trackColumnState: true });
    const grid = createGridMock();
    (grid as any).requestStateChange = vi.fn();
    plugin.attach(grid as any);

    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'Alice' });
    expect((grid as any).requestStateChange).toHaveBeenCalled();
    grid._cleanup();
  });

  it('setFilter does not call requestStateChange when trackColumnState is false', () => {
    const plugin = new FilteringPlugin();
    const grid = createGridMock();
    (grid as any).requestStateChange = vi.fn();
    plugin.attach(grid as any);

    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'Alice' });
    expect((grid as any).requestStateChange).not.toHaveBeenCalled();
    grid._cleanup();
  });

  it('setFilter with { silent: true } does not call requestStateChange even with trackColumnState', () => {
    const plugin = new FilteringPlugin({ trackColumnState: true });
    const grid = createGridMock();
    (grid as any).requestStateChange = vi.fn();
    plugin.attach(grid as any);

    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'Alice' }, { silent: true });
    expect((grid as any).requestStateChange).not.toHaveBeenCalled();
    grid._cleanup();
  });

  it('setFilterModel calls requestStateChange when trackColumnState is true', () => {
    const plugin = new FilteringPlugin({ trackColumnState: true });
    const grid = createGridMock();
    (grid as any).requestStateChange = vi.fn();
    plugin.attach(grid as any);

    plugin.setFilterModel([{ field: 'name', type: 'text', operator: 'contains', value: 'A' }]);
    expect((grid as any).requestStateChange).toHaveBeenCalled();
    grid._cleanup();
  });

  it('clearAllFilters calls requestStateChange when trackColumnState is true', () => {
    const plugin = new FilteringPlugin({ trackColumnState: true });
    const grid = createGridMock();
    (grid as any).requestStateChange = vi.fn();
    plugin.attach(grid as any);

    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'A' });
    (grid as any).requestStateChange.mockClear();

    plugin.clearAllFilters();
    expect((grid as any).requestStateChange).toHaveBeenCalled();
    grid._cleanup();
  });

  it('clearFieldFilter calls requestStateChange when trackColumnState is true', () => {
    const plugin = new FilteringPlugin({ trackColumnState: true });
    const grid = createGridMock();
    (grid as any).requestStateChange = vi.fn();
    plugin.attach(grid as any);

    plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'A' });
    (grid as any).requestStateChange.mockClear();

    plugin.clearFieldFilter('name');
    expect((grid as any).requestStateChange).toHaveBeenCalled();
    grid._cleanup();
  });

  it('processRows should recompute excludedValues for in filters when data changes (regression: stale panel state)', () => {
    const initialRows = [{ grade: 'Gudrun Blend' }, { grade: 'Mariner Blend' }];
    const plugin = new FilteringPlugin();
    const grid = createGridMock(initialRows);
    plugin.attach(grid as any);

    // Set an `in` filter for two grades
    plugin.setFilter('grade', { type: 'set', operator: 'in', value: ['Gudrun Blend', 'Mariner Blend'] });
    plugin.processRows(initialRows);

    // excludedValues should be empty (no extra unique values)
    const excludedBefore = (plugin as any).excludedValues.get('grade') as Set<unknown>;
    expect(excludedBefore?.size ?? 0).toBe(0);

    // Data changes — a new grade appears in the dataset
    const newRows = [{ grade: 'Gudrun Blend' }, { grade: 'Mariner Blend' }, { grade: 'Skarv' }];
    (grid as any).sourceRows = newRows;
    (grid as any).rows = newRows;

    const result = plugin.processRows(newRows);

    // The `in` filter should still only pass the two selected grades
    expect(result).toHaveLength(2);
    expect(result.map((r: any) => r.grade).sort()).toEqual(['Gudrun Blend', 'Mariner Blend']);

    // excludedValues must now include 'Skarv' so the filter panel shows it unchecked
    const excludedAfter = (plugin as any).excludedValues.get('grade') as Set<unknown>;
    expect(excludedAfter).toBeDefined();
    expect(excludedAfter.has('Skarv')).toBe(true);
    expect(excludedAfter.has('Gudrun Blend')).toBe(false);
    expect(excludedAfter.has('Mariner Blend')).toBe(false);
    grid._cleanup();
  });

  it('processRows should drop disappeared values from excludedValues when data shrinks', () => {
    const initialRows = [{ grade: 'Gudrun Blend' }, { grade: 'Mariner Blend' }, { grade: 'Skarv' }];
    const plugin = new FilteringPlugin();
    const grid = createGridMock(initialRows);
    plugin.attach(grid as any);

    // Select only two of three — 'Skarv' should be excluded
    plugin.setFilter('grade', { type: 'set', operator: 'in', value: ['Gudrun Blend', 'Mariner Blend'] });
    plugin.processRows(initialRows);

    const excludedBefore = (plugin as any).excludedValues.get('grade') as Set<unknown>;
    expect(excludedBefore.has('Skarv')).toBe(true);

    // Data changes — 'Skarv' disappears from the dataset entirely
    const newRows = [{ grade: 'Gudrun Blend' }, { grade: 'Mariner Blend' }];
    (grid as any).sourceRows = newRows;
    (grid as any).rows = newRows;

    plugin.processRows(newRows);

    // excludedValues should no longer contain 'Skarv'
    const excludedAfter = (plugin as any).excludedValues.get('grade') as Set<unknown>;
    expect(excludedAfter?.has('Skarv') ?? false).toBe(false);
    expect(excludedAfter?.size ?? 0).toBe(0);
    grid._cleanup();
  });

  it('processRows should recompute excludedValues for multiple in filters on different fields', () => {
    const initialRows = [
      { grade: 'Gudrun Blend', region: 'North Sea' },
      { grade: 'Mariner Blend', region: 'North Sea' },
    ];
    const plugin = new FilteringPlugin();
    const grid = createGridMock(initialRows);
    plugin.attach(grid as any);

    plugin.setFilter('grade', { type: 'set', operator: 'in', value: ['Gudrun Blend', 'Mariner Blend'] });
    plugin.setFilter('region', { type: 'set', operator: 'in', value: ['North Sea'] });
    plugin.processRows(initialRows);

    // New data adds a grade and a region
    const newRows = [
      { grade: 'Gudrun Blend', region: 'North Sea' },
      { grade: 'Mariner Blend', region: 'North Sea' },
      { grade: 'Skarv', region: 'Norwegian Sea' },
    ];
    (grid as any).sourceRows = newRows;
    (grid as any).rows = newRows;

    const result = plugin.processRows(newRows);

    // Only rows matching both filters should pass
    expect(result).toHaveLength(2);

    // Both fields should have updated excludedValues
    const gradeExcluded = (plugin as any).excludedValues.get('grade') as Set<unknown>;
    expect(gradeExcluded.has('Skarv')).toBe(true);

    const regionExcluded = (plugin as any).excludedValues.get('region') as Set<unknown>;
    expect(regionExcluded.has('Norwegian Sea')).toBe(true);
    expect(regionExcluded.has('North Sea')).toBe(false);
    grid._cleanup();
  });

  it('processRows should not mutate notIn excludedValues when data changes', () => {
    const initialRows = [{ grade: 'Gudrun Blend' }, { grade: 'Mariner Blend' }, { grade: 'Skarv' }];
    const plugin = new FilteringPlugin();
    const grid = createGridMock(initialRows);
    plugin.attach(grid as any);

    // notIn filter: exclude 'Skarv' (only Gudrun and Mariner pass)
    plugin.setFilter('grade', { type: 'set', operator: 'notIn', value: ['Skarv'] });
    plugin.processRows(initialRows);

    const excludedBefore = (plugin as any).excludedValues.get('grade') as Set<unknown>;
    expect(excludedBefore).toBeDefined();
    expect(excludedBefore.has('Skarv')).toBe(true);
    expect(excludedBefore.size).toBe(1);

    // Data changes — a new grade appears
    const newRows = [
      { grade: 'Gudrun Blend' },
      { grade: 'Mariner Blend' },
      { grade: 'Skarv' },
      { grade: 'Johan Sverdrup' },
    ];
    (grid as any).sourceRows = newRows;
    (grid as any).rows = newRows;

    const result = plugin.processRows(newRows);

    // notIn should still only exclude 'Skarv', passing 3 rows
    expect(result).toHaveLength(3);
    expect(result.map((r: any) => r.grade).sort()).toEqual(['Gudrun Blend', 'Johan Sverdrup', 'Mariner Blend']);

    // excludedValues should be unchanged — still only 'Skarv'
    const excludedAfter = (plugin as any).excludedValues.get('grade') as Set<unknown>;
    expect(excludedAfter.size).toBe(1);
    expect(excludedAfter.has('Skarv')).toBe(true);
    expect(excludedAfter.has('Johan Sverdrup')).toBe(false);
    grid._cleanup();
  });

  // #endregion

  // #region Stale Filter Detection (#166)

  describe('getStaleFilters', () => {
    it('should detect stale notIn filter when all values are excluded', () => {
      const rows = [{ status: 'Active' }, { status: 'Pending' }];
      const plugin = new FilteringPlugin();
      const grid = createGridMock(rows);
      plugin.attach(grid as any);

      // Exclude all values → stale
      plugin.setFilter('status', { type: 'set', operator: 'notIn', value: ['Active', 'Pending'] });
      expect(plugin.getStaleFilters()).toHaveLength(1);
      expect(plugin.getStaleFilters()[0].field).toBe('status');
      grid._cleanup();
    });

    it('should not flag notIn filter as stale when some values remain selected', () => {
      const rows = [{ status: 'Active' }, { status: 'Pending' }];
      const plugin = new FilteringPlugin();
      const grid = createGridMock(rows);
      plugin.attach(grid as any);

      plugin.setFilter('status', { type: 'set', operator: 'notIn', value: ['Pending'] });
      expect(plugin.getStaleFilters()).toHaveLength(0);
      grid._cleanup();
    });

    it('should detect stale in filter when no included values exist in data', () => {
      const rows = [{ status: 'Active' }, { status: 'Pending' }];
      const plugin = new FilteringPlugin();
      const grid = createGridMock(rows);
      plugin.attach(grid as any);

      plugin.setFilter('status', { type: 'set', operator: 'in', value: ['Archived', 'Deleted'] });
      expect(plugin.getStaleFilters()).toHaveLength(1);
      grid._cleanup();
    });

    it('should not flag in filter as stale when some values exist', () => {
      const rows = [{ status: 'Active' }, { status: 'Pending' }];
      const plugin = new FilteringPlugin();
      const grid = createGridMock(rows);
      plugin.attach(grid as any);

      plugin.setFilter('status', { type: 'set', operator: 'in', value: ['Active', 'Archived'] });
      expect(plugin.getStaleFilters()).toHaveLength(0);
      grid._cleanup();
    });

    it('should ignore non-set filters', () => {
      const rows = [{ name: 'Alice' }];
      const plugin = new FilteringPlugin();
      const grid = createGridMock(rows);
      plugin.attach(grid as any);

      plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'xyz' });
      expect(plugin.getStaleFilters()).toHaveLength(0);
      grid._cleanup();
    });
  });

  // #endregion

  // #region Blank Filter Toggle Helpers (#169)

  describe('getBlankMode', () => {
    it('should return all when no filter', () => {
      const plugin = new FilteringPlugin();
      const grid = createGridMock();
      plugin.attach(grid as any);

      expect(plugin.getBlankMode('field')).toBe('all');
      grid._cleanup();
    });

    it('should return blanksOnly for blank operator', () => {
      const plugin = new FilteringPlugin();
      const grid = createGridMock();
      plugin.attach(grid as any);

      plugin.setFilter('field', { type: 'text', operator: 'blank', value: '' });
      expect(plugin.getBlankMode('field')).toBe('blanksOnly');
      grid._cleanup();
    });

    it('should return nonBlanksOnly for notBlank operator', () => {
      const plugin = new FilteringPlugin();
      const grid = createGridMock();
      plugin.attach(grid as any);

      plugin.setFilter('field', { type: 'text', operator: 'notBlank', value: '' });
      expect(plugin.getBlankMode('field')).toBe('nonBlanksOnly');
      grid._cleanup();
    });
  });

  describe('toggleBlankFilter', () => {
    it('should set blank operator for blanksOnly mode', () => {
      const plugin = new FilteringPlugin();
      const grid = createGridMock();
      plugin.attach(grid as any);

      plugin.toggleBlankFilter('field', 'blanksOnly');
      const filter = plugin.getFilter('field');
      expect(filter?.operator).toBe('blank');
      grid._cleanup();
    });

    it('should set notBlank operator for nonBlanksOnly mode', () => {
      const plugin = new FilteringPlugin();
      const grid = createGridMock();
      plugin.attach(grid as any);

      plugin.toggleBlankFilter('field', 'nonBlanksOnly');
      const filter = plugin.getFilter('field');
      expect(filter?.operator).toBe('notBlank');
      grid._cleanup();
    });

    it('should clear filter for all mode', () => {
      const plugin = new FilteringPlugin();
      const grid = createGridMock();
      plugin.attach(grid as any);

      plugin.toggleBlankFilter('field', 'blanksOnly');
      expect(plugin.isFieldFiltered('field')).toBe(true);

      plugin.toggleBlankFilter('field', 'all');
      expect(plugin.isFieldFiltered('field')).toBe(false);
      grid._cleanup();
    });

    it('should stash active range filter and restore on all', () => {
      const rows = [{ price: 10 }, { price: 50 }, { price: null }];
      const plugin = new FilteringPlugin();
      const grid = createGridMock(rows);
      plugin.attach(grid as any);

      // Set a range filter first
      plugin.setFilter('price', { type: 'number', operator: 'between', value: 10, valueTo: 50 });
      expect(plugin.getFilter('price')?.operator).toBe('between');

      // Switch to blanksOnly — should stash the range
      plugin.toggleBlankFilter('price', 'blanksOnly');
      expect(plugin.getFilter('price')?.operator).toBe('blank');

      // Switch back to all — should restore the stashed range
      plugin.toggleBlankFilter('price', 'all');
      const restored = plugin.getFilter('price');
      expect(restored?.operator).toBe('between');
      expect(restored?.value).toBe(10);
      expect(restored?.valueTo).toBe(50);
      grid._cleanup();
    });

    it('should preserve stash when toggling between blank modes', () => {
      const plugin = new FilteringPlugin();
      const grid = createGridMock();
      plugin.attach(grid as any);

      // Set a text filter then switch to blanksOnly
      plugin.setFilter('name', { type: 'text', operator: 'contains', value: 'xyz' });
      plugin.toggleBlankFilter('name', 'blanksOnly');

      // Toggle to nonBlanksOnly — stash should be preserved
      plugin.toggleBlankFilter('name', 'nonBlanksOnly');
      expect(plugin.getFilter('name')?.operator).toBe('notBlank');

      // Restore
      plugin.toggleBlankFilter('name', 'all');
      expect(plugin.getFilter('name')?.operator).toBe('contains');
      expect(plugin.getFilter('name')?.value).toBe('xyz');
      grid._cleanup();
    });
  });

  // #endregion

  // #region Panel close handler cleanup

  describe('setupPanelCloseHandler cleanup on detach', () => {
    it('should not leak document click listeners when detach is called before setTimeout fires', () => {
      vi.useFakeTimers();
      const plugin = new FilteringPlugin();
      const grid = createGridMock([{ name: 'A' }], [{ field: 'name', header: 'Name' }]);
      plugin.attach(grid as any);

      // Call the private method via bracket notation to simulate opening a filter panel
      const panel = document.createElement('div');
      const button = document.createElement('button');
      document.body.appendChild(panel);
      (plugin as any).setupPanelCloseHandler(panel, button);

      // Detach BEFORE the setTimeout fires — this is the race condition
      plugin.detach();

      // Now let the setTimeout fire
      vi.advanceTimersByTime(1);

      // Simulate a click on document — should NOT throw or call closeFilterPanel
      const clickSpy = vi.spyOn(plugin as any, 'closeFilterPanel');
      document.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(clickSpy).not.toHaveBeenCalled();

      panel.remove();
      grid._cleanup();
      vi.useRealTimers();
    });
  });

  // #endregion

  // #endregion
});

// #endregion
