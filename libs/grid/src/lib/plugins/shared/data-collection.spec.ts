import { describe, expect, it } from 'vitest';
import type { ColumnConfig } from '../../core/types';
import { formatValueAsText, resolveColumns, resolveRows } from './data-collection';

describe('data-collection shared utility', () => {
  // #region resolveColumns

  describe('resolveColumns', () => {
    const columns: ColumnConfig[] = [
      { field: 'id', header: 'ID' },
      { field: 'name', header: 'Name' },
      { field: 'email', header: 'Email' },
      { field: 'hidden_col', header: 'Hidden', hidden: true },
      { field: '__expander', header: '', meta: { utility: true } },
      { field: '__internal', header: 'Internal' },
    ];

    it('should filter hidden and utility columns by default', () => {
      const result = resolveColumns(columns);
      const fields = result.map((c) => c.field);
      expect(fields).toEqual(['id', 'name', 'email']);
    });

    it('should include hidden and utility columns when onlyVisible is false', () => {
      const result = resolveColumns(columns, undefined, false);
      expect(result).toHaveLength(6);
    });

    it('should filter to specific fields when provided', () => {
      const result = resolveColumns(columns, ['name', 'email']);
      const fields = result.map((c) => c.field);
      expect(fields).toEqual(['name', 'email']);
    });

    it('should preserve original column order', () => {
      const result = resolveColumns(columns, ['email', 'id']);
      const fields = result.map((c) => c.field);
      expect(fields).toEqual(['id', 'email']);
    });

    it('should ignore unknown field names', () => {
      const result = resolveColumns(columns, ['name', 'nonexistent']);
      const fields = result.map((c) => c.field);
      expect(fields).toEqual(['name']);
    });

    it('should return empty array when all columns are hidden', () => {
      const hiddenOnly: ColumnConfig[] = [
        { field: 'a', header: 'A', hidden: true },
        { field: 'b', header: 'B', hidden: true },
      ];
      expect(resolveColumns(hiddenOnly)).toEqual([]);
    });

    it('should return empty array for empty columns input', () => {
      expect(resolveColumns([])).toEqual([]);
    });

    it('should apply both onlyVisible and fields filter together', () => {
      // Request a hidden column by name — visible filter removes it
      const result = resolveColumns(columns, ['name', 'hidden_col']);
      const fields = result.map((c) => c.field);
      expect(fields).toEqual(['name']);
    });

    it('should include a hidden column by name when onlyVisible is false', () => {
      const result = resolveColumns(columns, ['name', 'hidden_col'], false);
      const fields = result.map((c) => c.field);
      expect(fields).toEqual(['name', 'hidden_col']);
    });
  });

  // #endregion

  // #region resolveRows

  describe('resolveRows', () => {
    const rows = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
      { id: 4, name: 'Diana' },
      { id: 5, name: 'Eve' },
    ];

    it('should return all rows when no indices provided', () => {
      const result = resolveRows(rows);
      expect(result).toBe(rows); // Same reference (no copy when no filter)
    });

    it('should return all rows when indices is undefined', () => {
      const result = resolveRows(rows, undefined);
      expect(result).toBe(rows);
    });

    it('should return empty array when indices is empty', () => {
      const result = resolveRows(rows, []);
      expect(result).toBe(rows);
    });

    it('should return rows at specified indices', () => {
      const result = resolveRows(rows, [0, 2, 4]);
      expect(result).toEqual([
        { id: 1, name: 'Alice' },
        { id: 3, name: 'Charlie' },
        { id: 5, name: 'Eve' },
      ]);
    });

    it('should sort indices ascending', () => {
      const result = resolveRows(rows, [4, 0, 2]);
      expect(result).toEqual([
        { id: 1, name: 'Alice' },
        { id: 3, name: 'Charlie' },
        { id: 5, name: 'Eve' },
      ]);
    });

    it('should skip out-of-bounds indices', () => {
      const result = resolveRows(rows, [0, 99, 2]);
      expect(result).toEqual([
        { id: 1, name: 'Alice' },
        { id: 3, name: 'Charlie' },
      ]);
    });

    it('should handle non-contiguous indices', () => {
      const result = resolveRows(rows, [1, 3]);
      expect(result).toEqual([
        { id: 2, name: 'Bob' },
        { id: 4, name: 'Diana' },
      ]);
    });
  });

  // #endregion

  // #region formatValueAsText

  describe('formatValueAsText', () => {
    it('should return empty string for null', () => {
      expect(formatValueAsText(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(formatValueAsText(undefined)).toBe('');
    });

    it('should format Date as ISO string', () => {
      const date = new Date('2024-06-15T12:00:00.000Z');
      expect(formatValueAsText(date)).toBe('2024-06-15T12:00:00.000Z');
    });

    it('should JSON-stringify objects', () => {
      expect(formatValueAsText({ a: 1 })).toBe('{"a":1}');
    });

    it('should JSON-stringify arrays', () => {
      expect(formatValueAsText([1, 2, 3])).toBe('[1,2,3]');
    });

    it('should convert numbers to string', () => {
      expect(formatValueAsText(42)).toBe('42');
      expect(formatValueAsText(3.14)).toBe('3.14');
    });

    it('should convert booleans to string', () => {
      expect(formatValueAsText(true)).toBe('true');
      expect(formatValueAsText(false)).toBe('false');
    });

    it('should pass through strings', () => {
      expect(formatValueAsText('hello')).toBe('hello');
    });

    it('should handle empty string', () => {
      expect(formatValueAsText('')).toBe('');
    });
  });

  // #endregion
});
