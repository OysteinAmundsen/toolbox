/**
 * Tests for the value-accessor module — caching, precedence,
 * invalidation, and the filterValue bridge.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ColumnConfig } from '../types';
import { accessorAsFilterValue, invalidateAccessorCache, resolveCellValue } from './value-accessor';

interface Row {
  id: number;
  first: string;
  last: string;
}

function col(overrides: Partial<ColumnConfig<Row>> = {}): ColumnConfig<Row> {
  return {
    field: 'first',
    header: 'First',
    ...overrides,
  } as ColumnConfig<Row>;
}

describe('value-accessor', () => {
  describe('resolveCellValue', () => {
    it('reads row[field] when no accessor is configured', () => {
      const row: Row = { id: 1, first: 'Ada', last: 'Lovelace' };
      expect(resolveCellValue(row, col({ field: 'first' }))).toBe('Ada');
      expect(resolveCellValue(row, col({ field: 'last' }))).toBe('Lovelace');
    });

    it('handles null/undefined rows gracefully', () => {
      expect(resolveCellValue(null as unknown as Row, col())).toBeUndefined();
      expect(resolveCellValue(undefined as unknown as Row, col())).toBeUndefined();
    });

    it('invokes valueAccessor with { row, column, rowIndex }', () => {
      const row: Row = { id: 1, first: 'Ada', last: 'Lovelace' };
      const accessor = vi.fn(({ row: r }) => `${r.first} ${r.last}`);
      const c = col({ field: 'fullName', valueAccessor: accessor });
      expect(resolveCellValue(row, c, 7)).toBe('Ada Lovelace');
      expect(accessor).toHaveBeenCalledWith({ row, column: c, rowIndex: 7 });
    });

    it('memoizes per (row identity, field) on subsequent calls', () => {
      const row: Row = { id: 1, first: 'Ada', last: 'Lovelace' };
      const accessor = vi.fn(({ row: r }) => `${r.first} ${r.last}`);
      const c = col({ field: 'fullName', valueAccessor: accessor });
      resolveCellValue(row, c);
      resolveCellValue(row, c);
      resolveCellValue(row, c);
      expect(accessor).toHaveBeenCalledTimes(1);
    });

    it('different fields cache independently on the same row', () => {
      const row: Row = { id: 1, first: 'Ada', last: 'Lovelace' };
      const a = vi.fn(({ row: r }) => r.first.toUpperCase());
      const b = vi.fn(({ row: r }) => r.last.toUpperCase());
      resolveCellValue(row, col({ field: 'firstUpper', valueAccessor: a }));
      resolveCellValue(row, col({ field: 'lastUpper', valueAccessor: b }));
      resolveCellValue(row, col({ field: 'firstUpper', valueAccessor: a }));
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });

    it('different row identities do not share cache (immutable update auto-invalidates)', () => {
      const r1: Row = { id: 1, first: 'Ada', last: 'Lovelace' };
      const r2: Row = { ...r1, last: 'Byron' };
      const accessor = vi.fn(({ row: r }) => `${r.first} ${r.last}`);
      const c = col({ field: 'fullName', valueAccessor: accessor });
      expect(resolveCellValue(r1, c)).toBe('Ada Lovelace');
      expect(resolveCellValue(r2, c)).toBe('Ada Byron');
      expect(accessor).toHaveBeenCalledTimes(2);
    });

    it('bypasses cache for primitive rows', () => {
      const accessor = vi.fn(({ row }) => String(row));
      const c = col({ field: 'self', valueAccessor: accessor }) as unknown as ColumnConfig<number>;
      resolveCellValue(42 as unknown as Row, c as unknown as ColumnConfig<Row>);
      resolveCellValue(42 as unknown as Row, c as unknown as ColumnConfig<Row>);
      expect(accessor).toHaveBeenCalledTimes(2);
    });

    it('never invokes the accessor for loading placeholders (#508)', () => {
      const accessor = vi.fn(({ row: r }: { row: Row }) => r.first.toUpperCase());
      const c = col({ field: 'firstUpper', valueAccessor: accessor });
      const serverSide = { __loading: true, __index: 4 } as unknown as Row;
      const grouped = { __loading: true, __groupKey: 'dept=Sales' } as unknown as Row;
      expect(resolveCellValue(serverSide, c)).toBeUndefined();
      expect(resolveCellValue(grouped, c)).toBeUndefined();
      expect(accessor).not.toHaveBeenCalled();
    });
  });

  describe('invalidateAccessorCache', () => {
    let row: Row;
    let accessor: ReturnType<typeof vi.fn>;
    let c: ColumnConfig<Row>;

    beforeEach(() => {
      row = { id: 1, first: 'Ada', last: 'Lovelace' };
      accessor = vi.fn(({ row: r }) => `${r.first} ${r.last}`);
      c = col({ field: 'fullName', valueAccessor: accessor });
    });

    it('per-(row, field) invalidation refreshes only that key', () => {
      resolveCellValue(row, c);
      row.last = 'Byron';
      invalidateAccessorCache(row, 'fullName');
      expect(resolveCellValue(row, c)).toBe('Ada Byron');
      expect(accessor).toHaveBeenCalledTimes(2);
    });

    it('per-row invalidation clears all cached fields for that row', () => {
      const accessor2 = vi.fn(({ row: r }) => r.first.toUpperCase());
      const c2 = col({ field: 'firstUpper', valueAccessor: accessor2 });
      resolveCellValue(row, c);
      resolveCellValue(row, c2);
      invalidateAccessorCache(row);
      resolveCellValue(row, c);
      resolveCellValue(row, c2);
      expect(accessor).toHaveBeenCalledTimes(2);
      expect(accessor2).toHaveBeenCalledTimes(2);
    });

    it('no-arg call is a no-op (WeakMap cannot be cleared)', () => {
      resolveCellValue(row, c);
      invalidateAccessorCache();
      resolveCellValue(row, c);
      expect(accessor).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessorAsFilterValue', () => {
    it('returns undefined when no accessor is set', () => {
      expect(accessorAsFilterValue(col({ field: 'first' }))).toBeUndefined();
    });

    it('returns a (value, row) extractor that delegates to the accessor', () => {
      const row: Row = { id: 1, first: 'Ada', last: 'Lovelace' };
      const c = col({
        field: 'fullName',
        valueAccessor: ({ row: r }) => `${r.first} ${r.last}`,
      });
      const extractor = accessorAsFilterValue(c)!;
      expect(extractor('ignored', row)).toBe('Ada Lovelace');
    });
  });
});
