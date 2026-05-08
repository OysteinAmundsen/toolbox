import { describe, expect, it } from 'vitest';
import type { ColumnConfig } from '../../core/types';
import { applySorts, defaultComparator, getSortDirection, getSortIndex, toggleSort } from './multi-sort';
import type { SortModel } from './types';

describe('multiSort', () => {
  describe('defaultComparator', () => {
    it('should compare numbers correctly', () => {
      expect(defaultComparator(1, 2)).toBeLessThan(0);
      expect(defaultComparator(2, 1)).toBeGreaterThan(0);
      expect(defaultComparator(1, 1)).toBe(0);
    });

    it('should compare negative numbers', () => {
      expect(defaultComparator(-5, 3)).toBeLessThan(0);
      expect(defaultComparator(3, -5)).toBeGreaterThan(0);
      expect(defaultComparator(-2, -2)).toBe(0);
    });

    it('should compare floating point numbers', () => {
      expect(defaultComparator(1.5, 2.5)).toBeLessThan(0);
      expect(defaultComparator(2.5, 1.5)).toBeGreaterThan(0);
      expect(defaultComparator(1.5, 1.5)).toBe(0);
    });

    it('should compare strings correctly', () => {
      expect(defaultComparator('apple', 'banana')).toBeLessThan(0);
      expect(defaultComparator('banana', 'apple')).toBeGreaterThan(0);
      expect(defaultComparator('apple', 'apple')).toBe(0);
    });

    it('should compare strings case-insensitively via localeCompare', () => {
      // localeCompare handles case based on locale, typically case-insensitive
      expect(defaultComparator('Apple', 'apple')).toBe('Apple'.localeCompare('apple'));
    });

    it('should compare dates correctly', () => {
      const date1 = new Date('2023-01-01');
      const date2 = new Date('2023-12-31');
      const date3 = new Date('2023-01-01');

      expect(defaultComparator(date1, date2)).toBeLessThan(0);
      expect(defaultComparator(date2, date1)).toBeGreaterThan(0);
      expect(defaultComparator(date1, date3)).toBe(0);
    });

    it('should compare booleans correctly', () => {
      expect(defaultComparator(true, false)).toBeLessThan(0);
      expect(defaultComparator(false, true)).toBeGreaterThan(0);
      expect(defaultComparator(true, true)).toBe(0);
      expect(defaultComparator(false, false)).toBe(0);
    });

    it('should handle null values - push to end', () => {
      expect(defaultComparator(null, 'value')).toBe(1);
      expect(defaultComparator('value', null)).toBe(-1);
      expect(defaultComparator(null, null)).toBe(0);
    });

    it('should handle undefined values - push to end', () => {
      expect(defaultComparator(undefined, 'value')).toBe(1);
      expect(defaultComparator('value', undefined)).toBe(-1);
      expect(defaultComparator(undefined, undefined)).toBe(0);
    });

    it('should handle mixed null and undefined', () => {
      expect(defaultComparator(null, undefined)).toBe(0);
      expect(defaultComparator(undefined, null)).toBe(0);
    });

    it('should convert non-string/number/date/boolean to strings', () => {
      const obj1 = { toString: () => 'abc' };
      const obj2 = { toString: () => 'xyz' };

      expect(defaultComparator(obj1, obj2)).toBeLessThan(0);
    });
  });

  describe('applySorts', () => {
    interface TestRow {
      name: string;
      age: number;
      city: string;
    }

    const testRows: TestRow[] = [
      { name: 'Alice', age: 30, city: 'NYC' },
      { name: 'Bob', age: 25, city: 'LA' },
      { name: 'Charlie', age: 35, city: 'NYC' },
      { name: 'Diana', age: 25, city: 'Chicago' },
    ];

    const testColumns: ColumnConfig<TestRow>[] = [
      { field: 'name', sortable: true },
      { field: 'age', sortable: true },
      { field: 'city', sortable: true },
    ];

    it('should return original array when no sorts provided', () => {
      const result = applySorts(testRows, [], testColumns);
      expect(result).toEqual(testRows);
      expect(result).not.toBe(testRows); // Should be a copy
    });

    it('should sort by single column ascending', () => {
      const sorts: SortModel[] = [{ field: 'name', direction: 'asc' }];
      const result = applySorts(testRows, sorts, testColumns);

      expect(result.map((r) => r.name)).toEqual(['Alice', 'Bob', 'Charlie', 'Diana']);
    });

    it('should sort by single column descending', () => {
      const sorts: SortModel[] = [{ field: 'name', direction: 'desc' }];
      const result = applySorts(testRows, sorts, testColumns);

      expect(result.map((r) => r.name)).toEqual(['Diana', 'Charlie', 'Bob', 'Alice']);
    });

    it('should sort by number column ascending', () => {
      const sorts: SortModel[] = [{ field: 'age', direction: 'asc' }];
      const result = applySorts(testRows, sorts, testColumns);

      expect(result.map((r) => r.age)).toEqual([25, 25, 30, 35]);
    });

    it('should sort by number column descending', () => {
      const sorts: SortModel[] = [{ field: 'age', direction: 'desc' }];
      const result = applySorts(testRows, sorts, testColumns);

      expect(result.map((r) => r.age)).toEqual([35, 30, 25, 25]);
    });

    it('should apply multi-column sort with primary and secondary', () => {
      const sorts: SortModel[] = [
        { field: 'age', direction: 'asc' },
        { field: 'name', direction: 'asc' },
      ];
      const result = applySorts(testRows, sorts, testColumns);

      // Age 25: Bob, Diana (sorted by name)
      // Age 30: Alice
      // Age 35: Charlie
      expect(result.map((r) => r.name)).toEqual(['Bob', 'Diana', 'Alice', 'Charlie']);
    });

    it('should apply multi-column sort with mixed directions', () => {
      const sorts: SortModel[] = [
        { field: 'age', direction: 'asc' },
        { field: 'name', direction: 'desc' },
      ];
      const result = applySorts(testRows, sorts, testColumns);

      // Age 25: Diana, Bob (sorted by name desc)
      // Age 30: Alice
      // Age 35: Charlie
      expect(result.map((r) => r.name)).toEqual(['Diana', 'Bob', 'Alice', 'Charlie']);
    });

    it('should use custom comparator when provided', () => {
      const customColumns: ColumnConfig<TestRow>[] = [
        {
          field: 'name',
          sortable: true,
          // Custom: reverse alphabetical
          sortComparator: (a, b) => String(b).localeCompare(String(a)),
        },
        { field: 'age', sortable: true },
        { field: 'city', sortable: true },
      ];

      const sorts: SortModel[] = [{ field: 'name', direction: 'asc' }];
      const result = applySorts(testRows, sorts, customColumns);

      // Custom comparator reverses the order
      expect(result.map((r) => r.name)).toEqual(['Diana', 'Charlie', 'Bob', 'Alice']);
    });

    it('should not mutate original array', () => {
      const original = [...testRows];
      const sorts: SortModel[] = [{ field: 'age', direction: 'desc' }];

      applySorts(testRows, sorts, testColumns);

      expect(testRows).toEqual(original);
    });

    it('should handle empty array', () => {
      const sorts: SortModel[] = [{ field: 'name', direction: 'asc' }];
      const result = applySorts([], sorts, testColumns);

      expect(result).toEqual([]);
    });

    it('should handle single row', () => {
      const single = [{ name: 'Solo', age: 40, city: 'Boston' }];
      const sorts: SortModel[] = [{ field: 'name', direction: 'asc' }];
      const result = applySorts(single, sorts, testColumns);

      expect(result).toEqual(single);
    });

    it('should handle sorting with null values', () => {
      const rowsWithNulls = [
        { name: 'Alice', age: 30, city: 'NYC' },
        { name: null, age: 25, city: 'LA' },
        { name: 'Charlie', age: 35, city: 'NYC' },
      ] as unknown as TestRow[];

      const sorts: SortModel[] = [{ field: 'name', direction: 'asc' }];
      const result = applySorts(rowsWithNulls, sorts, testColumns);

      // null should be at the end
      expect(result[result.length - 1].name).toBeNull();
    });

    describe('performance', () => {
      it('should sort 10K rows within a constant factor of native multi-key sort', () => {
        const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
          name: `Person ${i}`,
          age: Math.floor(Math.random() * 80),
          city: ['NYC', 'LA', 'Chicago', 'Boston'][i % 4],
        }));

        const sorts: SortModel[] = [
          { field: 'age', direction: 'asc' },
          { field: 'name', direction: 'asc' },
        ];

        // Baseline: a hand-written native multi-key sort doing the same logical
        // work (sort by age asc, then name asc). This is the theoretical floor
        // for what `applySorts` can possibly cost — it has no column lookups,
        // no null-coalescing, no direction multiplier, no Schwartzian setup.
        const nativeSort = (data: typeof largeDataset) =>
          [...data].sort((a, b) => {
            if (a.age !== b.age) return a.age - b.age;
            return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
          });

        // Warm up JIT for both sides so compilation cost doesn't pollute samples.
        applySorts(largeDataset, sorts, testColumns);
        nativeSort(largeDataset);

        // Best-of-N sampling — noise can only inflate a sample, never deflate it,
        // so the minimum is the closest estimate of true hot-path cost. Sampling
        // both sides in the same loop keeps GC / scheduling pressure symmetrical.
        const SAMPLES = 5;
        let bestApply = Infinity;
        let bestNative = Infinity;
        for (let i = 0; i < SAMPLES; i++) {
          const t0 = performance.now();
          applySorts(largeDataset, sorts, testColumns);
          const t1 = performance.now();
          nativeSort(largeDataset);
          const t2 = performance.now();
          if (t1 - t0 < bestApply) bestApply = t1 - t0;
          if (t2 - t1 < bestNative) bestNative = t2 - t1;
        }

        // Relative budget: `applySorts` must stay within a constant factor of
        // native multi-key sort. This ratio is machine-independent — both
        // implementations move together with CPU speed, GC pressure, and runner
        // load — so the test is meaningful on a fast laptop AND a shared CI
        // runner without budget tuning.
        //
        // Observed ratio is ~1.5–3x (Schwartzian key cache + per-comparator
        // dispatch + null-safe compare vs. native's inlined `<`/`-`). 8x leaves
        // comfortable headroom for jitter on the smaller absolute timings (best-
        // of-5 still occasionally lands at ~6x on a loaded shared CI runner)
        // while still tripping on real algorithmic regressions: dropping the
        // key cache would push this to ~10–20x; reintroducing `columns.find()`
        // inside the comparator would push it to ~50x+.
        const ratio = bestApply / bestNative;
        expect(
          ratio,
          `applySorts=${bestApply.toFixed(2)}ms, native=${bestNative.toFixed(2)}ms, ratio=${ratio.toFixed(2)}x`,
        ).toBeLessThan(8);
      });
    });
  });

  describe('toggleSort', () => {
    const maxColumns = 3;

    describe('without shift key (single sort mode)', () => {
      it('should add ascending sort when field not sorted', () => {
        const result = toggleSort([], 'name', false, maxColumns);
        expect(result).toEqual([{ field: 'name', direction: 'asc' }]);
      });

      it('should flip to descending when currently ascending', () => {
        const current: SortModel[] = [{ field: 'name', direction: 'asc' }];
        const result = toggleSort(current, 'name', false, maxColumns);
        expect(result).toEqual([{ field: 'name', direction: 'desc' }]);
      });

      it('should clear sort when currently descending', () => {
        const current: SortModel[] = [{ field: 'name', direction: 'desc' }];
        const result = toggleSort(current, 'name', false, maxColumns);
        expect(result).toEqual([]);
      });

      it('should replace existing multi-sort with single sort', () => {
        const current: SortModel[] = [
          { field: 'age', direction: 'asc' },
          { field: 'name', direction: 'desc' },
        ];
        const result = toggleSort(current, 'city', false, maxColumns);
        expect(result).toEqual([{ field: 'city', direction: 'asc' }]);
      });

      it('should toggle field within multi-sort to single sort', () => {
        const current: SortModel[] = [
          { field: 'age', direction: 'asc' },
          { field: 'name', direction: 'asc' },
        ];
        const result = toggleSort(current, 'name', false, maxColumns);
        // Currently asc -> becomes desc (single)
        expect(result).toEqual([{ field: 'name', direction: 'desc' }]);
      });
    });

    describe('with shift key (multi-sort mode)', () => {
      it('should add ascending sort when field not sorted', () => {
        const current: SortModel[] = [{ field: 'age', direction: 'asc' }];
        const result = toggleSort(current, 'name', true, maxColumns);
        expect(result).toEqual([
          { field: 'age', direction: 'asc' },
          { field: 'name', direction: 'asc' },
        ]);
      });

      it('should flip to descending when currently ascending', () => {
        const current: SortModel[] = [
          { field: 'age', direction: 'asc' },
          { field: 'name', direction: 'asc' },
        ];
        const result = toggleSort(current, 'name', true, maxColumns);
        expect(result).toEqual([
          { field: 'age', direction: 'asc' },
          { field: 'name', direction: 'desc' },
        ]);
      });

      it('should remove from sort when currently descending', () => {
        const current: SortModel[] = [
          { field: 'age', direction: 'asc' },
          { field: 'name', direction: 'desc' },
        ];
        const result = toggleSort(current, 'name', true, maxColumns);
        expect(result).toEqual([{ field: 'age', direction: 'asc' }]);
      });

      it('should not add when max columns reached', () => {
        const current: SortModel[] = [
          { field: 'a', direction: 'asc' },
          { field: 'b', direction: 'asc' },
          { field: 'c', direction: 'asc' },
        ];
        const result = toggleSort(current, 'd', true, 3);
        expect(result).toEqual(current);
      });

      it('should allow toggling existing when at max columns', () => {
        const current: SortModel[] = [
          { field: 'a', direction: 'asc' },
          { field: 'b', direction: 'asc' },
          { field: 'c', direction: 'asc' },
        ];
        const result = toggleSort(current, 'b', true, 3);
        expect(result).toEqual([
          { field: 'a', direction: 'asc' },
          { field: 'b', direction: 'desc' },
          { field: 'c', direction: 'asc' },
        ]);
      });

      it('should preserve order when toggling middle column', () => {
        const current: SortModel[] = [
          { field: 'age', direction: 'asc' },
          { field: 'name', direction: 'asc' },
          { field: 'city', direction: 'asc' },
        ];
        const result = toggleSort(current, 'name', true, maxColumns);
        expect(result).toEqual([
          { field: 'age', direction: 'asc' },
          { field: 'name', direction: 'desc' },
          { field: 'city', direction: 'asc' },
        ]);
      });
    });

    describe('edge cases', () => {
      it('should handle empty sort model with shift', () => {
        const result = toggleSort([], 'name', true, maxColumns);
        expect(result).toEqual([{ field: 'name', direction: 'asc' }]);
      });

      it('should handle maxColumns of 1', () => {
        const current: SortModel[] = [{ field: 'age', direction: 'asc' }];
        const result = toggleSort(current, 'name', true, 1);
        expect(result).toEqual(current); // Cannot add more
      });

      it('should handle maxColumns of 0', () => {
        const result = toggleSort([], 'name', true, 0);
        expect(result).toEqual([]); // Cannot add any
      });
    });
  });

  describe('getSortIndex', () => {
    it('should return 1-based index for sorted field', () => {
      const sortModel: SortModel[] = [
        { field: 'age', direction: 'asc' },
        { field: 'name', direction: 'desc' },
        { field: 'city', direction: 'asc' },
      ];

      expect(getSortIndex(sortModel, 'age')).toBe(1);
      expect(getSortIndex(sortModel, 'name')).toBe(2);
      expect(getSortIndex(sortModel, 'city')).toBe(3);
    });

    it('should return undefined for unsorted field', () => {
      const sortModel: SortModel[] = [{ field: 'age', direction: 'asc' }];
      expect(getSortIndex(sortModel, 'name')).toBeUndefined();
    });

    it('should return undefined for empty sort model', () => {
      expect(getSortIndex([], 'name')).toBeUndefined();
    });
  });

  describe('getSortDirection', () => {
    it('should return direction for sorted field', () => {
      const sortModel: SortModel[] = [
        { field: 'age', direction: 'asc' },
        { field: 'name', direction: 'desc' },
      ];

      expect(getSortDirection(sortModel, 'age')).toBe('asc');
      expect(getSortDirection(sortModel, 'name')).toBe('desc');
    });

    it('should return undefined for unsorted field', () => {
      const sortModel: SortModel[] = [{ field: 'age', direction: 'asc' }];
      expect(getSortDirection(sortModel, 'city')).toBeUndefined();
    });

    it('should return undefined for empty sort model', () => {
      expect(getSortDirection([], 'name')).toBeUndefined();
    });
  });

  describe('placeholder pin (issue #231)', () => {
    const cols = [{ field: 'name' }, { field: 'age' }] as any;

    it('pins __loading rows to the end on ascending sort', () => {
      const rows = [
        { name: 'Alice', age: 30 },
        { __loading: true, __index: 1 },
        { name: 'Charlie', age: 25 },
        { name: 'Bob', age: 40 },
      ];
      const sorted = applySorts(rows, [{ field: 'name', direction: 'asc' }], cols);
      expect(sorted.map((r: any) => r.name ?? '__loading')).toEqual(['Alice', 'Bob', 'Charlie', '__loading']);
    });

    it('pins __loading rows to the end on descending sort', () => {
      const rows = [
        { name: 'Alice', age: 30 },
        { __loading: true, __index: 1 },
        { name: 'Charlie', age: 25 },
        { name: 'Bob', age: 40 },
      ];
      const sorted = applySorts(rows, [{ field: 'name', direction: 'desc' }], cols);
      expect(sorted.map((r: any) => r.name ?? '__loading')).toEqual(['Charlie', 'Bob', 'Alice', '__loading']);
    });

    it('pins __loading rows to the end with multi-column sort', () => {
      const rows = [
        { name: 'Alice', age: 30 },
        { __loading: true, __index: 1 },
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 20 },
      ];
      const sorted = applySorts(
        rows,
        [
          { field: 'name', direction: 'asc' },
          { field: 'age', direction: 'asc' },
        ],
        cols,
      );
      expect(sorted.map((r: any) => (r.__loading ? '__loading' : `${r.name}-${r.age}`))).toEqual([
        'Alice-25',
        'Alice-30',
        'Bob-20',
        '__loading',
      ]);
    });

    it('does NOT auto-pin when a custom column sortComparator is configured', () => {
      // Custom comparator that strictly compares numbers — placeholders should
      // be the user's responsibility under sortMode: 'local'. Verify the
      // placeholder reaches the comparator (not pre-filtered by the framework).
      const seenRows: any[] = [];
      const customCols = [
        {
          field: 'value',
          sortComparator: (_a: unknown, _b: unknown, rA: any, rB: any) => {
            seenRows.push(rA, rB);
            const av = (rA as any)?.__loading ? Infinity : (rA as any).value;
            const bv = (rB as any)?.__loading ? Infinity : (rB as any).value;
            return av - bv;
          },
        },
      ] as any;
      const rows = [{ value: 2 }, { __loading: true, __index: 99 }, { value: 1 }];
      const sorted = applySorts(rows, [{ field: 'value', direction: 'asc' }], customCols);
      expect(sorted.map((r: any) => (r.__loading ? '__loading' : r.value))).toEqual([1, 2, '__loading']);
      // Custom comparator was reachable (received placeholders)
      expect(seenRows.some((r) => r?.__loading === true)).toBe(true);
    });
  });
});
