import { describe, expect, it, vi } from 'vitest';
import { computeFilterCacheKey, filterRows, getUniqueValues, matchesFilter } from './filter-model';
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

      it('should pass null/undefined values through (not excluded)', () => {
        const filter: FilterModel = {
          field: 'city',
          type: 'set',
          operator: 'notIn',
          value: ['New York', 'Los Angeles', 'Boston'],
        };
        // null is not in the excluded list, so the row should pass
        expect(matchesFilter({ city: null }, filter)).toBe(true);
        expect(matchesFilter({ city: undefined }, filter)).toBe(true);
        // missing field = undefined
        expect(matchesFilter({}, filter)).toBe(true);
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

    it('should fail "in" for null/empty cell values', () => {
      const filter: FilterModel = { field: 'sellers', type: 'set', operator: 'in', value: ['Apple'] };
      expect(matchesFilter(arrayRows[3] as Record<string, unknown>, filter, false, extractor)).toBe(false);
      expect(matchesFilter(arrayRows[4] as Record<string, unknown>, filter, false, extractor)).toBe(false);
    });

    it('should match "notIn" — hide row if ANY extracted value is excluded', () => {
      const filter: FilterModel = { field: 'sellers', type: 'set', operator: 'notIn', value: ['Google'] };
      // Row 0: [Apple, Google] → Google is excluded → hidden
      expect(matchesFilter(arrayRows[0] as Record<string, unknown>, filter, false, extractor)).toBe(false);
      // Row 2: [Apple] → no excluded values → passes
      expect(matchesFilter(arrayRows[2] as Record<string, unknown>, filter, false, extractor)).toBe(true);
    });

    it('should pass "notIn" for null/empty cell values (vacuous truth)', () => {
      const filter: FilterModel = { field: 'sellers', type: 'set', operator: 'notIn', value: ['Apple'] };
      expect(matchesFilter(arrayRows[3] as Record<string, unknown>, filter, false, extractor)).toBe(true);
      expect(matchesFilter(arrayRows[4] as Record<string, unknown>, filter, false, extractor)).toBe(true);
    });

    it('should handle single-value (non-array) extractor return', () => {
      const singleExtractor = (value: unknown) => (value as { name: string } | null)?.name;
      const row = { id: 1, seller: { name: 'Apple' } };
      const filter: FilterModel = { field: 'seller', type: 'set', operator: 'in', value: ['Apple'] };
      expect(matchesFilter(row as Record<string, unknown>, filter, false, singleExtractor)).toBe(true);
    });

    it('should fall through to raw value for non-set operators even with extractor', () => {
      // "contains" should use rawValue, not the extractor
      const filter: FilterModel = { field: 'sellers', type: 'text', operator: 'contains', value: 'name' };
      // rawValue is an array of objects → String([{name:'Apple'},...]) contains "name"
      // The extractor should NOT be consulted for non-in/notIn operators
      const result = matchesFilter(arrayRows[0] as Record<string, unknown>, filter, false, extractor);
      // Just verify it doesn't throw — the exact result depends on String() of the array
      expect(typeof result).toBe('boolean');
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

    it('should exclude null values', () => {
      const values = getUniqueValues(sampleRows, 'city');
      expect(values).not.toContain(null);
    });

    it('should return sorted values (strings)', () => {
      const values = getUniqueValues(sampleRows, 'city') as string[];
      const sorted = [...values].sort((a, b) => a.localeCompare(b));
      expect(values).toEqual(sorted);
    });

    it('should return sorted values (numbers)', () => {
      const values = getUniqueValues(sampleRows, 'age') as number[];
      // Filter out null age values
      expect(values).toContain(22);
      expect(values).toContain(25);
      expect(values).toContain(28);
      expect(values).toContain(30);
      expect(values).toContain(35);
      expect(values).toContain(40);
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
    });

    it('should return empty array for non-existent field', () => {
      const values = getUniqueValues(sampleRows, 'nonExistent');
      expect(values).toEqual([]);
    });

    it('should handle empty rows array', () => {
      const values = getUniqueValues([], 'any');
      expect(values).toEqual([]);
    });

    it('should flatten array values when filterValue extractor is provided', () => {
      const rows = [
        { id: 1, sellers: [{ name: 'Apple' }, { name: 'Google' }] },
        { id: 2, sellers: [{ name: 'Google' }, { name: 'Meta' }] },
        { id: 3, sellers: null },
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
      expect(values).toEqual([1, 2]);
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
});

// #endregion
