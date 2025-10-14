import { describe, it, expect } from 'vitest';
import { formatCellValue, buildClipboardText, type CopyParams } from './copy';
import { parseClipboardText } from './paste';
import type { ClipboardConfig } from './types';
import type { ColumnConfig } from '../../core/types';

describe('clipboard', () => {
  describe('formatCellValue', () => {
    const defaultConfig: ClipboardConfig = {
      enabled: true,
      delimiter: '\t',
      newline: '\n',
      quoteStrings: false,
    };

    it('should return empty string for null', () => {
      expect(formatCellValue(null, 'field', {}, defaultConfig)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(formatCellValue(undefined, 'field', {}, defaultConfig)).toBe('');
    });

    it('should format Date as ISO string', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      expect(formatCellValue(date, 'field', {}, defaultConfig)).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should format object as JSON string', () => {
      const obj = { name: 'test', value: 123 };
      expect(formatCellValue(obj, 'field', {}, defaultConfig)).toBe('{"name":"test","value":123}');
    });

    it('should format array as JSON string', () => {
      const arr = [1, 2, 3];
      expect(formatCellValue(arr, 'field', {}, defaultConfig)).toBe('[1,2,3]');
    });

    it('should convert number to string', () => {
      expect(formatCellValue(42, 'field', {}, defaultConfig)).toBe('42');
    });

    it('should convert boolean to string', () => {
      expect(formatCellValue(true, 'field', {}, defaultConfig)).toBe('true');
      expect(formatCellValue(false, 'field', {}, defaultConfig)).toBe('false');
    });

    it('should quote strings containing delimiter', () => {
      expect(formatCellValue('hello\tworld', 'field', {}, defaultConfig)).toBe('"hello\tworld"');
    });

    it('should quote strings containing newline', () => {
      expect(formatCellValue('hello\nworld', 'field', {}, defaultConfig)).toBe('"hello\nworld"');
    });

    it('should escape and quote strings containing double quotes', () => {
      expect(formatCellValue('say "hello"', 'field', {}, defaultConfig)).toBe('"say ""hello"""');
    });

    it('should quote all strings when quoteStrings is true', () => {
      const config: ClipboardConfig = { ...defaultConfig, quoteStrings: true };
      expect(formatCellValue('simple', 'field', {}, config)).toBe('"simple"');
    });

    it('should use custom processCell when provided', () => {
      const config: ClipboardConfig = {
        ...defaultConfig,
        processCell: (value, field) => `[${field}:${value}]`,
      };
      expect(formatCellValue('test', 'myField', {}, config)).toBe('[myField:test]');
    });

    it('should pass row to processCell', () => {
      const row = { id: 1, name: 'Alice' };
      const config: ClipboardConfig = {
        ...defaultConfig,
        processCell: (value, field, r) => `${(r as { name: string }).name}-${value}`,
      };
      expect(formatCellValue('value', 'field', row, config)).toBe('Alice-value');
    });
  });

  describe('buildClipboardText', () => {
    const columns: ColumnConfig[] = [
      { field: 'id', header: 'ID' },
      { field: 'name', header: 'Name' },
      { field: 'email', header: 'Email' },
    ];

    const rows = [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
      { id: 3, name: 'Charlie', email: 'charlie@example.com' },
    ];

    const defaultConfig: ClipboardConfig = {
      enabled: true,
      delimiter: '\t',
      newline: '\n',
      includeHeaders: false,
      quoteStrings: false,
    };

    it('should build text from selected rows', () => {
      const params: CopyParams = {
        rows,
        columns,
        selectedIndices: new Set([0, 2]),
        config: defaultConfig,
      };

      const result = buildClipboardText(params);
      expect(result).toBe('1\tAlice\talice@example.com\n3\tCharlie\tcharlie@example.com');
    });

    it('should include headers when configured', () => {
      const params: CopyParams = {
        rows,
        columns,
        selectedIndices: new Set([1]),
        config: { ...defaultConfig, includeHeaders: true },
      };

      const result = buildClipboardText(params);
      expect(result).toBe('ID\tName\tEmail\n2\tBob\tbob@example.com');
    });

    it('should use custom delimiter', () => {
      const params: CopyParams = {
        rows,
        columns,
        selectedIndices: new Set([0]),
        config: { ...defaultConfig, delimiter: ',' },
      };

      const result = buildClipboardText(params);
      expect(result).toBe('1,Alice,alice@example.com');
    });

    it('should use custom newline', () => {
      const params: CopyParams = {
        rows,
        columns,
        selectedIndices: new Set([0, 1]),
        config: { ...defaultConfig, newline: '\r\n' },
      };

      const result = buildClipboardText(params);
      expect(result).toBe('1\tAlice\talice@example.com\r\n2\tBob\tbob@example.com');
    });

    it('should accept array of indices', () => {
      const params: CopyParams = {
        rows,
        columns,
        selectedIndices: [2, 0], // Order doesn't matter, will be sorted
        config: defaultConfig,
      };

      const result = buildClipboardText(params);
      expect(result).toBe('1\tAlice\talice@example.com\n3\tCharlie\tcharlie@example.com');
    });

    it('should filter out hidden columns', () => {
      const columnsWithHidden: ColumnConfig[] = [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name', hidden: true },
        { field: 'email', header: 'Email' },
      ];

      const params: CopyParams = {
        rows,
        columns: columnsWithHidden,
        selectedIndices: new Set([0]),
        config: defaultConfig,
      };

      const result = buildClipboardText(params);
      expect(result).toBe('1\talice@example.com');
    });

    it('should filter out internal columns (__ prefix)', () => {
      const columnsWithInternal: ColumnConfig[] = [
        { field: '__selection', header: '' },
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name' },
      ];

      const params: CopyParams = {
        rows: rows.map((r) => ({ ...r, __selection: true })),
        columns: columnsWithInternal,
        selectedIndices: new Set([0]),
        config: defaultConfig,
      };

      const result = buildClipboardText(params);
      expect(result).toBe('1\tAlice');
    });

    it('should return empty string for empty selection', () => {
      const params: CopyParams = {
        rows,
        columns,
        selectedIndices: new Set(),
        config: defaultConfig,
      };

      const result = buildClipboardText(params);
      expect(result).toBe('');
    });

    it('should return only headers for empty selection with includeHeaders', () => {
      const params: CopyParams = {
        rows,
        columns,
        selectedIndices: new Set(),
        config: { ...defaultConfig, includeHeaders: true },
      };

      const result = buildClipboardText(params);
      expect(result).toBe('ID\tName\tEmail');
    });

    it('should skip invalid row indices', () => {
      const params: CopyParams = {
        rows,
        columns,
        selectedIndices: new Set([0, 99, 1]), // 99 is out of bounds
        config: defaultConfig,
      };

      const result = buildClipboardText(params);
      expect(result).toBe('1\tAlice\talice@example.com\n2\tBob\tbob@example.com');
    });

    it('should quote header containing delimiter', () => {
      const columnsWithSpecialHeader: ColumnConfig[] = [
        { field: 'id', header: 'ID,Value' },
        { field: 'name', header: 'Name' },
      ];

      const params: CopyParams = {
        rows,
        columns: columnsWithSpecialHeader,
        selectedIndices: new Set([0]),
        config: { ...defaultConfig, delimiter: ',', includeHeaders: true },
      };

      const result = buildClipboardText(params);
      expect(result).toBe('"ID,Value",Name\n1,Alice');
    });
  });

  describe('parseClipboardText', () => {
    const defaultConfig: ClipboardConfig = {
      enabled: true,
      delimiter: '\t',
      newline: '\n',
    };

    it('should parse simple tab-separated text', () => {
      const text = '1\tAlice\talice@example.com\n2\tBob\tbob@example.com';
      const result = parseClipboardText(text, defaultConfig);

      expect(result).toEqual([
        ['1', 'Alice', 'alice@example.com'],
        ['2', 'Bob', 'bob@example.com'],
      ]);
    });

    it('should parse comma-separated text with custom delimiter', () => {
      const text = '1,Alice,alice@example.com\n2,Bob,bob@example.com';
      const result = parseClipboardText(text, { ...defaultConfig, delimiter: ',' });

      expect(result).toEqual([
        ['1', 'Alice', 'alice@example.com'],
        ['2', 'Bob', 'bob@example.com'],
      ]);
    });

    it('should handle quoted values', () => {
      const text = '"hello, world"\ttest';
      const result = parseClipboardText(text, defaultConfig);

      expect(result).toEqual([['hello, world', 'test']]);
    });

    it('should handle escaped quotes in quoted values', () => {
      const text = '"say ""hello"""\tnormal';
      const result = parseClipboardText(text, defaultConfig);

      expect(result).toEqual([['say "hello"', 'normal']]);
    });

    it('should handle newlines in quoted values', () => {
      const text = '"line1\nline2"\tnormal';
      const result = parseClipboardText(text, defaultConfig);

      // The newline in quotes is preserved as part of the value
      expect(result).toEqual([['line1\nline2', 'normal']]);
    });

    it('should filter out empty lines', () => {
      const text = '1\tAlice\n\n2\tBob\n';
      const result = parseClipboardText(text, defaultConfig);

      expect(result).toEqual([
        ['1', 'Alice'],
        ['2', 'Bob'],
      ]);
    });

    it('should handle Windows CRLF line endings', () => {
      const text = '1\tAlice\r\n2\tBob\r\n';
      const result = parseClipboardText(text, defaultConfig);

      expect(result).toEqual([
        ['1', 'Alice'],
        ['2', 'Bob'],
      ]);
    });

    it('should handle old Mac CR line endings', () => {
      const text = '1\tAlice\r2\tBob';
      const result = parseClipboardText(text, defaultConfig);

      expect(result).toEqual([
        ['1', 'Alice'],
        ['2', 'Bob'],
      ]);
    });

    it('should handle single cell', () => {
      const text = 'hello';
      const result = parseClipboardText(text, defaultConfig);

      expect(result).toEqual([['hello']]);
    });

    it('should handle empty cells', () => {
      const text = 'a\t\tb\n\tc\t';
      const result = parseClipboardText(text, defaultConfig);

      expect(result).toEqual([
        ['a', '', 'b'],
        ['', 'c', ''],
      ]);
    });

    it('should return empty array for whitespace-only input', () => {
      const text = '   \n   \n   ';
      const result = parseClipboardText(text, defaultConfig);

      expect(result).toEqual([]);
    });

    it('should handle complex quoted scenarios', () => {
      const text = 'a\t"b\tc"\t"d""e"\t"f\ng"';
      const result = parseClipboardText(text, defaultConfig);

      expect(result).toEqual([['a', 'b\tc', 'd"e', 'f\ng']]);
    });
  });

  describe('edge cases', () => {
    it('should handle round-trip with special characters', () => {
      const config: ClipboardConfig = {
        enabled: true,
        delimiter: '\t',
        newline: '\n',
        quoteStrings: false,
      };

      const columns: ColumnConfig[] = [{ field: 'text', header: 'Text' }];

      const rows = [
        { text: 'hello\tworld' }, // Contains tab
        { text: 'line1\nline2' }, // Contains newline
        { text: 'say "hi"' }, // Contains quotes
      ];

      const copyParams: CopyParams = {
        rows,
        columns,
        selectedIndices: new Set([0, 1, 2]),
        config,
      };

      const copied = buildClipboardText(copyParams);
      const parsed = parseClipboardText(copied, config);

      expect(parsed).toEqual([['hello\tworld'], ['line1\nline2'], ['say "hi"']]);
    });

    it('should handle empty columns array', () => {
      const params: CopyParams = {
        rows: [{ id: 1 }],
        columns: [],
        selectedIndices: new Set([0]),
        config: { enabled: true, delimiter: '\t', newline: '\n' },
      };

      const result = buildClipboardText(params);
      expect(result).toBe('');
    });

    it('should handle rows with missing fields', () => {
      const columns: ColumnConfig[] = [
        { field: 'a', header: 'A' },
        { field: 'b', header: 'B' },
      ];

      const rows = [
        { a: 1 }, // Missing 'b'
        { b: 2 }, // Missing 'a'
      ];

      const params: CopyParams = {
        rows,
        columns,
        selectedIndices: new Set([0, 1]),
        config: { enabled: true, delimiter: '\t', newline: '\n' },
      };

      const result = buildClipboardText(params);
      expect(result).toBe('1\t\n\t2');
    });
  });
});
