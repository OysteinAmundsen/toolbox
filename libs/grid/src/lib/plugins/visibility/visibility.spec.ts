import { describe, it, expect } from 'vitest';
import { filterVisibleColumns, canHideColumn, toggleColumnVisibility } from './visibility';
import type { ColumnConfig } from '../../core/types';

describe('visibility', () => {
  describe('filterVisibleColumns', () => {
    interface TestRow {
      name: string;
      age: number;
      city: string;
    }

    const testColumns: ColumnConfig<TestRow>[] = [{ field: 'name' }, { field: 'age' }, { field: 'city' }];

    it('should return all columns when none are hidden', () => {
      const hidden = new Set<string>();
      const result = filterVisibleColumns(testColumns, hidden);

      expect(result).toHaveLength(3);
      expect(result.map((c) => c.field)).toEqual(['name', 'age', 'city']);
    });

    it('should filter out hidden columns', () => {
      const hidden = new Set(['age']);
      const result = filterVisibleColumns(testColumns, hidden);

      expect(result).toHaveLength(2);
      expect(result.map((c) => c.field)).toEqual(['name', 'city']);
    });

    it('should filter out multiple hidden columns', () => {
      const hidden = new Set(['name', 'city']);
      const result = filterVisibleColumns(testColumns, hidden);

      expect(result).toHaveLength(1);
      expect(result.map((c) => c.field)).toEqual(['age']);
    });

    it('should return empty array when all columns are hidden', () => {
      const hidden = new Set(['name', 'age', 'city']);
      const result = filterVisibleColumns(testColumns, hidden);

      expect(result).toHaveLength(0);
    });

    it('should ignore hidden fields that do not exist in columns', () => {
      const hidden = new Set(['nonexistent']);
      const result = filterVisibleColumns(testColumns, hidden);

      expect(result).toHaveLength(3);
    });

    it('should return a new array (not mutate original)', () => {
      const hidden = new Set<string>();
      const result = filterVisibleColumns(testColumns, hidden);

      expect(result).not.toBe(testColumns);
    });
  });

  describe('canHideColumn', () => {
    interface TestRow {
      name: string;
      age: number;
      city: string;
      id: string;
    }

    const testColumns: ColumnConfig<TestRow>[] = [
      { field: 'name' },
      { field: 'age' },
      { field: 'city' },
      { field: 'id', lockVisible: true },
    ];

    it('should allow hiding a column when others remain visible', () => {
      const hidden = new Set<string>();
      const result = canHideColumn(testColumns, 'name', hidden, false);

      expect(result).toBe(true);
    });

    it('should not allow hiding a lockVisible column', () => {
      const hidden = new Set<string>();
      const result = canHideColumn(testColumns, 'id', hidden, false);

      expect(result).toBe(false);
    });

    it('should not allow hiding the last visible column when allowHideAll is false', () => {
      const hidden = new Set(['name', 'age', 'id']);
      const result = canHideColumn(testColumns, 'city', hidden, false);

      expect(result).toBe(false);
    });

    it('should allow hiding the last visible column when allowHideAll is true', () => {
      const hidden = new Set(['name', 'age', 'id']);
      const result = canHideColumn(testColumns, 'city', hidden, true);

      expect(result).toBe(true);
    });

    it('should not allow hiding lockVisible column even when allowHideAll is true', () => {
      const hidden = new Set<string>();
      const result = canHideColumn(testColumns, 'id', hidden, true);

      expect(result).toBe(false);
    });

    it('should allow hiding when multiple columns remain visible', () => {
      const hidden = new Set(['name']);
      const result = canHideColumn(testColumns, 'age', hidden, false);

      expect(result).toBe(true);
    });

    it('should return true for non-existent field (no lockVisible)', () => {
      const hidden = new Set<string>();
      const result = canHideColumn(testColumns, 'nonexistent', hidden, false);

      expect(result).toBe(true);
    });
  });

  describe('toggleColumnVisibility', () => {
    it('should add field to hidden set when toggling visible column', () => {
      const hidden = new Set<string>();
      const result = toggleColumnVisibility(hidden, 'name');

      expect(result.has('name')).toBe(true);
      expect(result.size).toBe(1);
    });

    it('should remove field from hidden set when toggling hidden column', () => {
      const hidden = new Set(['name']);
      const result = toggleColumnVisibility(hidden, 'name');

      expect(result.has('name')).toBe(false);
      expect(result.size).toBe(0);
    });

    it('should explicitly show column when visible=true', () => {
      const hidden = new Set(['name']);
      const result = toggleColumnVisibility(hidden, 'name', true);

      expect(result.has('name')).toBe(false);
    });

    it('should explicitly hide column when visible=false', () => {
      const hidden = new Set<string>();
      const result = toggleColumnVisibility(hidden, 'name', false);

      expect(result.has('name')).toBe(true);
    });

    it('should not add column again when already hidden and visible=false', () => {
      const hidden = new Set(['name']);
      const result = toggleColumnVisibility(hidden, 'name', false);

      expect(result.has('name')).toBe(true);
      expect(result.size).toBe(1);
    });

    it('should not remove column when already visible and visible=true', () => {
      const hidden = new Set<string>();
      const result = toggleColumnVisibility(hidden, 'name', true);

      expect(result.has('name')).toBe(false);
      expect(result.size).toBe(0);
    });

    it('should not mutate original set', () => {
      const hidden = new Set(['age']);
      const result = toggleColumnVisibility(hidden, 'name');

      expect(hidden.size).toBe(1);
      expect(hidden.has('age')).toBe(true);
      expect(hidden.has('name')).toBe(false);

      expect(result).not.toBe(hidden);
      expect(result.size).toBe(2);
    });

    it('should preserve other hidden columns when toggling', () => {
      const hidden = new Set(['age', 'city']);
      const result = toggleColumnVisibility(hidden, 'name');

      expect(result.has('name')).toBe(true);
      expect(result.has('age')).toBe(true);
      expect(result.has('city')).toBe(true);
      expect(result.size).toBe(3);
    });
  });

  describe('integration scenarios', () => {
    interface TestRow {
      id: string;
      name: string;
      email: string;
      phone: string;
    }

    const columns: ColumnConfig<TestRow>[] = [
      { field: 'id', lockVisible: true },
      { field: 'name' },
      { field: 'email' },
      { field: 'phone', hidden: true },
    ];

    it('should initialize with hidden columns from column config', () => {
      const hidden = new Set<string>();
      for (const col of columns) {
        if (col.hidden) hidden.add(col.field);
      }

      expect(hidden.has('phone')).toBe(true);
      expect(hidden.size).toBe(1);
    });

    it('should filter visible columns after initialization', () => {
      const hidden = new Set<string>();
      for (const col of columns) {
        if (col.hidden) hidden.add(col.field);
      }

      const visible = filterVisibleColumns(columns, hidden);

      expect(visible.map((c) => c.field)).toEqual(['id', 'name', 'email']);
    });

    it('should respect lockVisible when trying to hide multiple columns', () => {
      const hidden = new Set(['name', 'email', 'phone']);

      // Try to hide 'id' which is lockVisible
      const canHideId = canHideColumn(columns, 'id', hidden, false);
      expect(canHideId).toBe(false);

      // Verify id is still visible
      const visible = filterVisibleColumns(columns, hidden);
      expect(visible.map((c) => c.field)).toEqual(['id']);
    });

    it('should allow showing previously hidden columns', () => {
      let hidden = new Set(['phone', 'email']);

      // Show email
      hidden = toggleColumnVisibility(hidden, 'email', true);

      const visible = filterVisibleColumns(columns, hidden);
      expect(visible.map((c) => c.field)).toEqual(['id', 'name', 'email']);
    });

    it('should handle show all columns scenario', () => {
      // Start with some columns hidden
      const initialHidden = new Set(['name', 'email', 'phone']);
      const hiddenBefore = filterVisibleColumns(columns, initialHidden);
      expect(hiddenBefore).toHaveLength(1); // only 'id'

      // Clear all hidden (show all)
      const cleared = new Set<string>();
      const visible = filterVisibleColumns(columns, cleared);
      expect(visible).toHaveLength(4);
    });
  });
});
