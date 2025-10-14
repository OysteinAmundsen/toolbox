import { describe, expect, it } from 'vitest';
import { formatCsvValue, buildCsv } from './csv';
import { buildExcelXml } from './excel';
import type { ColumnConfig } from '../../core/types';
import type { ExportParams } from './types';

describe('Export Plugin', () => {
  describe('formatCsvValue', () => {
    it('handles null and undefined', () => {
      expect(formatCsvValue(null)).toBe('');
      expect(formatCsvValue(undefined)).toBe('');
    });

    it('handles primitive types', () => {
      expect(formatCsvValue('hello')).toBe('hello');
      expect(formatCsvValue(123)).toBe('123');
      expect(formatCsvValue(true)).toBe('true');
      expect(formatCsvValue(false)).toBe('false');
    });

    it('formats Date objects as ISO strings', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      expect(formatCsvValue(date)).toBe('2024-01-15T10:30:00.000Z');
    });

    it('stringifies objects', () => {
      const obj = { name: 'test', value: 42 };
      expect(formatCsvValue(obj)).toBe('{"name":"test","value":42}');
    });

    it('quotes strings containing commas', () => {
      expect(formatCsvValue('hello, world')).toBe('"hello, world"');
    });

    it('quotes strings containing double quotes and escapes them', () => {
      expect(formatCsvValue('say "hello"')).toBe('"say ""hello"""');
    });

    it('quotes strings containing newlines', () => {
      expect(formatCsvValue('line1\nline2')).toBe('"line1\nline2"');
      expect(formatCsvValue('line1\r\nline2')).toBe('"line1\r\nline2"');
    });

    it('respects quote=false option', () => {
      expect(formatCsvValue('hello, world', false)).toBe('hello, world');
    });
  });

  describe('buildCsv', () => {
    const sampleColumns: ColumnConfig[] = [
      { field: 'name', header: 'Name' },
      { field: 'age', header: 'Age' },
      { field: 'city', header: 'City' },
    ];

    const sampleRows = [
      { name: 'Alice', age: 30, city: 'New York' },
      { name: 'Bob', age: 25, city: 'Los Angeles' },
      { name: 'Charlie', age: 35, city: 'Chicago' },
    ];

    it('builds CSV with headers by default', () => {
      const params: ExportParams = { format: 'csv' };
      const result = buildCsv(sampleRows, sampleColumns, params);

      expect(result).toContain('Name,Age,City');
      expect(result).toContain('Alice,30,New York');
      expect(result).toContain('Bob,25,Los Angeles');
      expect(result).toContain('Charlie,35,Chicago');
    });

    it('builds CSV without headers when includeHeaders is false', () => {
      const params: ExportParams = { format: 'csv', includeHeaders: false };
      const result = buildCsv(sampleRows, sampleColumns, params);

      expect(result).not.toContain('Name,Age,City');
      expect(result.split('\n')).toHaveLength(3);
    });

    it('adds BOM when option is set', () => {
      const params: ExportParams = { format: 'csv' };
      const result = buildCsv(sampleRows, sampleColumns, params, { bom: true });

      expect(result.charCodeAt(0)).toBe(0xfeff);
    });

    it('uses custom delimiter', () => {
      const params: ExportParams = { format: 'csv' };
      const result = buildCsv(sampleRows, sampleColumns, params, { delimiter: ';' });

      expect(result).toContain('Name;Age;City');
      expect(result).toContain('Alice;30;New York');
    });

    it('uses custom newline', () => {
      const params: ExportParams = { format: 'csv' };
      const result = buildCsv(sampleRows, sampleColumns, params, { newline: '\r\n' });

      expect(result.split('\r\n')).toHaveLength(4);
    });

    it('applies processCell function', () => {
      const params: ExportParams = {
        format: 'csv',
        processCell: (value, field) => {
          if (field === 'age') return value * 2;
          return value;
        },
      };
      const result = buildCsv(sampleRows, sampleColumns, params);

      expect(result).toContain('60'); // 30 * 2
      expect(result).toContain('50'); // 25 * 2
      expect(result).toContain('70'); // 35 * 2
    });

    it('applies processHeader function', () => {
      const params: ExportParams = {
        format: 'csv',
        processHeader: (header) => header.toUpperCase(),
      };
      const result = buildCsv(sampleRows, sampleColumns, params);

      expect(result).toContain('NAME,AGE,CITY');
    });

    it('handles empty rows array', () => {
      const params: ExportParams = { format: 'csv' };
      const result = buildCsv([], sampleColumns, params);

      expect(result).toBe('Name,Age,City');
    });

    it('handles rows with missing fields', () => {
      const rows = [
        { name: 'Alice', age: 30 }, // missing city
        { name: 'Bob', city: 'LA' }, // missing age
      ];
      const params: ExportParams = { format: 'csv' };
      const result = buildCsv(rows, sampleColumns, params);

      expect(result).toContain('Alice,30,');
      expect(result).toContain('Bob,,LA');
    });
  });

  describe('buildExcelXml', () => {
    const sampleColumns: ColumnConfig[] = [
      { field: 'name', header: 'Name' },
      { field: 'value', header: 'Value' },
    ];

    const sampleRows = [
      { name: 'Item A', value: 100 },
      { name: 'Item B', value: 200 },
    ];

    it('generates valid XML structure', () => {
      const params: ExportParams = { format: 'excel' };
      const result = buildExcelXml(sampleRows, sampleColumns, params);

      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain('<?mso-application progid="Excel.Sheet"?>');
      expect(result).toContain('<Workbook');
      expect(result).toContain('<Worksheet ss:Name="Sheet1">');
      expect(result).toContain('<Table>');
      expect(result).toContain('</Table>');
      expect(result).toContain('</Worksheet>');
      expect(result).toContain('</Workbook>');
    });

    it('includes headers by default', () => {
      const params: ExportParams = { format: 'excel' };
      const result = buildExcelXml(sampleRows, sampleColumns, params);

      expect(result).toContain('<Data ss:Type="String">Name</Data>');
      expect(result).toContain('<Data ss:Type="String">Value</Data>');
    });

    it('excludes headers when includeHeaders is false', () => {
      const params: ExportParams = { format: 'excel', includeHeaders: false };
      const result = buildExcelXml(sampleRows, sampleColumns, params);

      // Count header cells - should not have Name and Value as headers
      const rowMatches = result.match(/<Row>/g);
      expect(rowMatches).toHaveLength(2); // Only data rows
    });

    it('uses Number type for numeric values', () => {
      const params: ExportParams = { format: 'excel' };
      const result = buildExcelXml(sampleRows, sampleColumns, params);

      expect(result).toContain('<Data ss:Type="Number">100</Data>');
      expect(result).toContain('<Data ss:Type="Number">200</Data>');
    });

    it('uses String type for text values', () => {
      const params: ExportParams = { format: 'excel' };
      const result = buildExcelXml(sampleRows, sampleColumns, params);

      expect(result).toContain('<Data ss:Type="String">Item A</Data>');
      expect(result).toContain('<Data ss:Type="String">Item B</Data>');
    });

    it('escapes XML special characters', () => {
      const rows = [{ name: 'Test <>&"\'', value: 0 }];
      const params: ExportParams = { format: 'excel' };
      const result = buildExcelXml(rows, sampleColumns, params);

      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
      expect(result).toContain('&amp;');
      expect(result).toContain('&quot;');
      expect(result).toContain('&apos;');
    });

    it('handles null values', () => {
      const rows = [{ name: null, value: null }];
      const params: ExportParams = { format: 'excel' };
      const result = buildExcelXml(rows, sampleColumns, params);

      expect(result).toContain('<Data ss:Type="String"></Data>');
    });

    it('handles Date values', () => {
      const date = new Date('2024-06-15T12:00:00.000Z');
      const rows = [{ name: date, value: 0 }];
      const params: ExportParams = { format: 'excel' };
      const result = buildExcelXml(rows, sampleColumns, params);

      expect(result).toContain('<Data ss:Type="DateTime">2024-06-15T12:00:00.000Z</Data>');
    });

    it('applies processCell function', () => {
      const params: ExportParams = {
        format: 'excel',
        processCell: (value, field) => {
          if (field === 'value') return value + 50;
          return value;
        },
      };
      const result = buildExcelXml(sampleRows, sampleColumns, params);

      expect(result).toContain('<Data ss:Type="Number">150</Data>');
      expect(result).toContain('<Data ss:Type="Number">250</Data>');
    });

    it('applies processHeader function', () => {
      const params: ExportParams = {
        format: 'excel',
        processHeader: (header) => `Col: ${header}`,
      };
      const result = buildExcelXml(sampleRows, sampleColumns, params);

      expect(result).toContain('<Data ss:Type="String">Col: Name</Data>');
      expect(result).toContain('<Data ss:Type="String">Col: Value</Data>');
    });
  });
});
