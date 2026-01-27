/**
 * Tests for column shorthand parsing.
 */

import { describe, expect, it } from 'vitest';
import { hasColumnShorthands, normalizeColumns, parseColumnShorthand } from './column-shorthand';

describe('column-shorthand', () => {
  describe('parseColumnShorthand', () => {
    it('should parse simple field name', () => {
      const result = parseColumnShorthand('name');
      expect(result).toEqual({
        field: 'name',
        header: 'Name',
      });
    });

    it('should parse field with number type', () => {
      const result = parseColumnShorthand('salary:number');
      expect(result).toEqual({
        field: 'salary',
        header: 'Salary',
        type: 'number',
      });
    });

    it('should parse field with date type', () => {
      const result = parseColumnShorthand('createdAt:date');
      expect(result).toEqual({
        field: 'createdAt',
        header: 'Created At',
        type: 'date',
      });
    });

    it('should parse field with boolean type', () => {
      const result = parseColumnShorthand('isActive:boolean');
      expect(result).toEqual({
        field: 'isActive',
        header: 'Is Active',
        type: 'boolean',
      });
    });

    it('should parse field with currency type', () => {
      const result = parseColumnShorthand('price:currency');
      expect(result).toEqual({
        field: 'price',
        header: 'Price',
        type: 'currency',
      });
    });

    it('should handle uppercase type (case insensitive)', () => {
      const result = parseColumnShorthand('id:NUMBER');
      expect(result).toEqual({
        field: 'id',
        header: 'ID',
        type: 'number',
      });
    });

    it('should handle unknown type as part of field name', () => {
      // 'field:unknown' should be treated as field name with colon
      const result = parseColumnShorthand('field:unknown');
      expect(result).toEqual({
        field: 'field:unknown',
        header: 'Field:unknown',
      });
    });

    it('should handle field with multiple colons (use last)', () => {
      // 'time:12:30' should try to parse '30' as type, fail, use whole string
      const result = parseColumnShorthand('time:12:30');
      expect(result.field).toBe('time:12:30');
    });

    it('should generate header from camelCase', () => {
      const result = parseColumnShorthand('firstName');
      expect(result.header).toBe('First Name');
    });

    it('should generate header from snake_case', () => {
      const result = parseColumnShorthand('first_name');
      expect(result.header).toBe('First Name');
    });

    it('should generate header from kebab-case', () => {
      const result = parseColumnShorthand('first-name');
      expect(result.header).toBe('First Name');
    });

    it('should handle ID special case', () => {
      const result = parseColumnShorthand('id');
      expect(result.header).toBe('ID');
    });

    it('should handle ID with type', () => {
      const result = parseColumnShorthand('id:number');
      expect(result).toEqual({
        field: 'id',
        header: 'ID',
        type: 'number',
      });
    });
  });

  describe('normalizeColumns', () => {
    it('should normalize array of string shorthands', () => {
      const result = normalizeColumns(['id:number', 'name', 'email']);
      expect(result).toEqual([
        { field: 'id', header: 'ID', type: 'number' },
        { field: 'name', header: 'Name' },
        { field: 'email', header: 'Email' },
      ]);
    });

    it('should pass through ColumnConfig objects unchanged', () => {
      const config = { field: 'email', width: 200, sortable: true };
      const result = normalizeColumns([config]);
      expect(result[0]).toBe(config); // Same reference
    });

    it('should handle mixed array', () => {
      const result = normalizeColumns(['id:number', { field: 'name', header: 'Full Name', editable: true }, 'email']);
      expect(result).toEqual([
        { field: 'id', header: 'ID', type: 'number' },
        { field: 'name', header: 'Full Name', editable: true },
        { field: 'email', header: 'Email' },
      ]);
    });

    it('should handle empty array', () => {
      const result = normalizeColumns([]);
      expect(result).toEqual([]);
    });
  });

  describe('hasColumnShorthands', () => {
    it('should return true for array with string shorthands', () => {
      expect(hasColumnShorthands(['id', 'name'])).toBe(true);
    });

    it('should return false for array with only ColumnConfig objects', () => {
      expect(hasColumnShorthands([{ field: 'id' }, { field: 'name' }])).toBe(false);
    });

    it('should return true for mixed array', () => {
      expect(hasColumnShorthands([{ field: 'id' }, 'name'])).toBe(true);
    });

    it('should return false for empty array', () => {
      expect(hasColumnShorthands([])).toBe(false);
    });
  });
});
