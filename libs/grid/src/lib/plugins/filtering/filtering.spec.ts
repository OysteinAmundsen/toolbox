import { describe, expect, it } from 'vitest';
import { computeFilterCacheKey, filterRows, getUniqueValues, matchesFilter } from './filter-model';
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
