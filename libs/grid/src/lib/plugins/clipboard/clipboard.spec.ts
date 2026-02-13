import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ColumnConfig } from '../../core/types';
import { ClipboardPlugin } from './ClipboardPlugin';
import { buildClipboardText, copyToClipboard, formatCellValue, type CopyParams } from './copy';
import { parseClipboardText, readFromClipboard } from './paste';
import type { ClipboardConfig, PasteDetail } from './types';
import { defaultPasteHandler } from './types';

describe('clipboard', () => {
  describe('formatCellValue', () => {
    const defaultConfig: ClipboardConfig = {
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
        config: { delimiter: '\t', newline: '\n' },
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
        config: { delimiter: '\t', newline: '\n' },
      };

      const result = buildClipboardText(params);
      expect(result).toBe('1\t\n\t2');
    });
  });

  describe('defaultPasteHandler', () => {
    // Mock grid element with minimal interface
    const createMockGrid = (
      rows: Record<string, unknown>[],
      columns: ColumnConfig[],
    ): { rows: unknown[]; effectiveConfig: { columns: ColumnConfig[] } } => ({
      rows: [...rows],
      effectiveConfig: { columns },
    });

    const columns: ColumnConfig[] = [
      { field: 'col1', header: 'Column 1', editable: true },
      { field: 'col2', header: 'Column 2', editable: true },
      { field: 'col3', header: 'Column 3', editable: true },
    ];

    it('should apply paste data starting at target cell', () => {
      const rows = [
        { col1: 'A1', col2: 'B1', col3: 'C1' },
        { col1: 'A2', col2: 'B2', col3: 'C2' },
      ];
      const grid = createMockGrid(rows, columns);

      const detail: PasteDetail = {
        rows: [['X', 'Y']],
        text: 'X\tY',
        target: { row: 0, col: 1, field: 'col2', bounds: null },
        fields: ['col2', 'col3'],
      };

      defaultPasteHandler(detail, grid as unknown as import('../../../public').GridElement);

      expect(grid.rows[0]).toEqual({ col1: 'A1', col2: 'X', col3: 'Y' });
      expect(grid.rows[1]).toEqual({ col1: 'A2', col2: 'B2', col3: 'C2' });
    });

    it('should handle multi-row paste', () => {
      const rows = [
        { col1: 'A1', col2: 'B1', col3: 'C1' },
        { col1: 'A2', col2: 'B2', col3: 'C2' },
        { col1: 'A3', col2: 'B3', col3: 'C3' },
      ];
      const grid = createMockGrid(rows, columns);

      const detail: PasteDetail = {
        rows: [
          ['X1', 'Y1'],
          ['X2', 'Y2'],
        ],
        text: 'X1\tY1\nX2\tY2',
        target: { row: 1, col: 0, field: 'col1', bounds: null },
        fields: ['col1', 'col2'],
      };

      defaultPasteHandler(detail, grid as unknown as import('../../../public').GridElement);

      expect(grid.rows[0]).toEqual({ col1: 'A1', col2: 'B1', col3: 'C1' });
      expect(grid.rows[1]).toEqual({ col1: 'X1', col2: 'Y1', col3: 'C2' });
      expect(grid.rows[2]).toEqual({ col1: 'X2', col2: 'Y2', col3: 'C3' });
    });

    it('should add new rows when pasting beyond current data (no bounds)', () => {
      const rows = [{ col1: 'A1', col2: 'B1', col3: 'C1' }];
      const grid = createMockGrid(rows, columns);

      const detail: PasteDetail = {
        rows: [
          ['X1', 'Y1'],
          ['X2', 'Y2'],
          ['X3', 'Y3'],
        ],
        text: 'X1\tY1\nX2\tY2\nX3\tY3',
        target: { row: 0, col: 0, field: 'col1', bounds: null },
        fields: ['col1', 'col2'],
      };

      defaultPasteHandler(detail, grid as unknown as import('../../../public').GridElement);

      expect(grid.rows).toHaveLength(3);
      expect(grid.rows[0]).toEqual({ col1: 'X1', col2: 'Y1', col3: 'C1' });
      expect(grid.rows[1]).toEqual({ col1: 'X2', col2: 'Y2', col3: '' });
      expect(grid.rows[2]).toEqual({ col1: 'X3', col2: 'Y3', col3: '' });
    });

    it('should clip paste to selection bounds (row constraint)', () => {
      // User's example: clipboard has 2 rows, selection is 2 rows, should paste both
      const rows = [
        { col1: 'A1', col2: 'A2', col3: 'A3' },
        { col1: 'B1', col2: 'B2', col3: 'B3' },
      ];
      const grid = createMockGrid(rows, columns);

      // Clipboard: X1 X2 X3 / Y1 Y2 Y3
      // Selection: from (0,1) to (1,2) -> A2:B3
      // Result: A1 X1 X2 / B1 Y1 Y2
      const detail: PasteDetail = {
        rows: [
          ['X1', 'X2', 'X3'],
          ['Y1', 'Y2', 'Y3'],
        ],
        text: 'X1\tX2\tX3\nY1\tY2\tY3',
        target: { row: 0, col: 1, field: 'col2', bounds: { endRow: 1, endCol: 2 } },
        fields: ['col2', 'col3'], // Only 2 fields because bounds.endCol = 2
      };

      defaultPasteHandler(detail, grid as unknown as import('../../../public').GridElement);

      // X3 and Y3 should be clipped (only col2 and col3 in selection)
      expect(grid.rows[0]).toEqual({ col1: 'A1', col2: 'X1', col3: 'X2' });
      expect(grid.rows[1]).toEqual({ col1: 'B1', col2: 'Y1', col3: 'Y2' });
    });

    it('should not add rows when bounds are set', () => {
      const rows = [
        { col1: 'A1', col2: 'B1', col3: 'C1' },
        { col1: 'A2', col2: 'B2', col3: 'C2' },
      ];
      const grid = createMockGrid(rows, columns);

      // Try to paste 4 rows into a 2-row selection
      const detail: PasteDetail = {
        rows: [['X1'], ['X2'], ['X3'], ['X4']],
        text: 'X1\nX2\nX3\nX4',
        target: { row: 0, col: 0, field: 'col1', bounds: { endRow: 1, endCol: 0 } },
        fields: ['col1'],
      };

      defaultPasteHandler(detail, grid as unknown as import('../../../public').GridElement);

      // Only first 2 rows should be updated
      expect(grid.rows).toHaveLength(2);
      expect(grid.rows[0]).toEqual({ col1: 'X1', col2: 'B1', col3: 'C1' });
      expect(grid.rows[1]).toEqual({ col1: 'X2', col2: 'B2', col3: 'C2' });
    });

    it('should do nothing when target is null', () => {
      const rows = [{ col1: 'A1', col2: 'B1', col3: 'C1' }];
      const grid = createMockGrid(rows, columns);

      const detail: PasteDetail = {
        rows: [['X', 'Y']],
        text: 'X\tY',
        target: null,
        fields: [],
      };

      defaultPasteHandler(detail, grid as unknown as import('../../../public').GridElement);

      // Should remain unchanged
      expect(grid.rows[0]).toEqual({ col1: 'A1', col2: 'B1', col3: 'C1' });
    });

    it('should handle paste with fewer columns than fields', () => {
      const rows = [{ col1: 'A1', col2: 'B1', col3: 'C1' }];
      const grid = createMockGrid(rows, columns);

      const detail: PasteDetail = {
        rows: [['X']], // Only one value
        text: 'X',
        target: { row: 0, col: 0, field: 'col1', bounds: null },
        fields: ['col1', 'col2'], // But two fields
      };

      defaultPasteHandler(detail, grid as unknown as import('../../../public').GridElement);

      // Only first field should be updated
      expect(grid.rows[0]).toEqual({ col1: 'X', col2: 'B1', col3: 'C1' });
    });

    it('should maintain immutability of original rows', () => {
      const originalRow = { col1: 'A1', col2: 'B1', col3: 'C1' };
      const rows = [originalRow];
      const grid = createMockGrid(rows, columns);

      const detail: PasteDetail = {
        rows: [['X']],
        text: 'X',
        target: { row: 0, col: 0, field: 'col1', bounds: null },
        fields: ['col1'],
      };

      defaultPasteHandler(detail, grid as unknown as import('../../../public').GridElement);

      // Original row object should be unchanged
      expect(originalRow).toEqual({ col1: 'A1', col2: 'B1', col3: 'C1' });
      // Grid should have new row object
      expect(grid.rows[0]).toEqual({ col1: 'X', col2: 'B1', col3: 'C1' });
      expect(grid.rows[0]).not.toBe(originalRow);
    });

    it('should skip non-editable columns during paste', () => {
      // Columns with mixed editable state: col1=editable, col2=NOT editable, col3=editable
      const mixedColumns: ColumnConfig[] = [
        { field: 'col1', header: 'Column 1', editable: true },
        { field: 'col2', header: 'Column 2', editable: false },
        { field: 'col3', header: 'Column 3', editable: true },
      ];
      const rows = [
        { col1: 'A1', col2: 'B1', col3: 'C1' },
        { col1: 'A2', col2: 'B2', col3: 'C2' },
      ];
      const grid = createMockGrid(rows, mixedColumns);

      // Pasting 3 columns of data across all columns
      const detail: PasteDetail = {
        rows: [
          ['X1', 'X2', 'X3'],
          ['Y1', 'Y2', 'Y3'],
        ],
        text: 'X1\tX2\tX3\nY1\tY2\tY3',
        target: { row: 0, col: 0, field: 'col1', bounds: null },
        fields: ['col1', 'col2', 'col3'],
      };

      defaultPasteHandler(detail, grid as unknown as import('../../../public').GridElement);

      // col2 should remain unchanged (not editable)
      expect(grid.rows[0]).toEqual({ col1: 'X1', col2: 'B1', col3: 'X3' });
      expect(grid.rows[1]).toEqual({ col1: 'Y1', col2: 'B2', col3: 'Y3' });
    });

    it('should skip columns without editable property during paste', () => {
      // Columns without editable property should default to not editable
      const noEditableColumns: ColumnConfig[] = [
        { field: 'col1', header: 'Column 1' },
        { field: 'col2', header: 'Column 2' },
      ];
      const rows = [{ col1: 'A1', col2: 'B1' }];
      const grid = createMockGrid(rows, noEditableColumns);

      const detail: PasteDetail = {
        rows: [['X1', 'X2']],
        text: 'X1\tX2',
        target: { row: 0, col: 0, field: 'col1', bounds: null },
        fields: ['col1', 'col2'],
      };

      defaultPasteHandler(detail, grid as unknown as import('../../../public').GridElement);

      // Neither column should be updated (no editable: true)
      expect(grid.rows[0]).toEqual({ col1: 'A1', col2: 'B1' });
    });
  });

  // #region copyToClipboard & readFromClipboard

  describe('copyToClipboard', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should write text using navigator.clipboard API', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      });

      const result = await copyToClipboard('hello world');
      expect(result).toBe(true);
      expect(writeTextMock).toHaveBeenCalledWith('hello world');
    });

    it('should return false when clipboard API fails', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
        writable: true,
        configurable: true,
      });
      // Mock execCommand fallback (not available in happy-dom)
      document.execCommand = vi.fn(() => false);

      const result = await copyToClipboard('test');
      expect(result).toBe(false);
    });
  });

  describe('readFromClipboard', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should read text from navigator.clipboard API', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { readText: vi.fn().mockResolvedValue('clipboard content') },
        writable: true,
        configurable: true,
      });

      const result = await readFromClipboard();
      expect(result).toBe('clipboard content');
    });

    it('should return empty string when clipboard API fails', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { readText: vi.fn().mockRejectedValue(new Error('denied')) },
        writable: true,
        configurable: true,
      });

      const result = await readFromClipboard();
      expect(result).toBe('');
    });
  });

  // #endregion

  // #region ClipboardPlugin class

  describe('ClipboardPlugin class', () => {
    function createGridMockForPlugin(rows: Record<string, unknown>[] = [], columns: ColumnConfig[] = []) {
      return {
        rows,
        sourceRows: rows,
        columns,
        _columns: columns,
        _visibleColumns: columns,
        _focusRow: 0,
        _focusCol: 0,
        gridConfig: {},
        effectiveConfig: {},
        getPlugin: () => undefined,
        query: () => [],
        queryPlugins: () => [],
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
        requestRender: vi.fn(),
        children: [document.createElement('div')],
        querySelectorAll: () => [],
        querySelector: () => null,
        clientWidth: 800,
        classList: { add: vi.fn(), remove: vi.fn() },
      };
    }

    it('should have correct name', () => {
      const plugin = new ClipboardPlugin();
      expect(plugin.name).toBe('clipboard');
    });

    it('should have selection as optional dependency', () => {
      expect(ClipboardPlugin.dependencies).toBeDefined();
      const dep = ClipboardPlugin.dependencies![0];
      expect(dep.name).toBe('selection');
      expect(dep.required).toBe(false);
    });

    it('should attach and detach cleanly', () => {
      const plugin = new ClipboardPlugin();
      const grid = createGridMockForPlugin();
      plugin.attach(grid as any);
      expect(grid.addEventListener).toHaveBeenCalled();

      plugin.detach();
      expect(plugin.getLastCopied()).toBeNull();
    });

    it('should return null from getLastCopied when nothing copied', () => {
      const plugin = new ClipboardPlugin();
      expect(plugin.getLastCopied()).toBeNull();
    });

    it('should return empty string from getSelectionAsText when no data', () => {
      const plugin = new ClipboardPlugin();
      const grid = createGridMockForPlugin([], []);
      plugin.attach(grid as any);

      const text = plugin.getSelectionAsText();
      expect(text).toBe('');
    });

    it('should build text from all rows when no selection', () => {
      const columns: ColumnConfig[] = [
        { field: 'name', header: 'Name' },
        { field: 'age', header: 'Age' },
      ];
      const rows = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ];
      const plugin = new ClipboardPlugin();
      const grid = createGridMockForPlugin(rows, columns);
      plugin.attach(grid as any);

      const text = plugin.getSelectionAsText();
      expect(text).toContain('Alice');
      expect(text).toContain('Bob');
    });

    it('should include headers when configured', () => {
      const columns: ColumnConfig[] = [{ field: 'name', header: 'Name' }];
      const rows = [{ name: 'Alice' }];
      const plugin = new ClipboardPlugin({ includeHeaders: true });
      const grid = createGridMockForPlugin(rows, columns);
      plugin.attach(grid as any);

      const text = plugin.getSelectionAsText();
      expect(text).toContain('Name');
      expect(text).toContain('Alice');
    });

    it('should respect options override for includeHeaders', () => {
      const columns: ColumnConfig[] = [{ field: 'name', header: 'Name' }];
      const rows = [{ name: 'Alice' }];
      const plugin = new ClipboardPlugin({ includeHeaders: false });
      const grid = createGridMockForPlugin(rows, columns);
      plugin.attach(grid as any);

      const text = plugin.getSelectionAsText({ includeHeaders: true });
      expect(text).toContain('Name');
    });

    it('should respect columns option in getSelectionAsText', () => {
      const columns: ColumnConfig[] = [
        { field: 'name', header: 'Name' },
        { field: 'age', header: 'Age' },
        { field: 'email', header: 'Email' },
      ];
      const rows = [{ name: 'Alice', age: 30, email: 'alice@test.com' }];
      const plugin = new ClipboardPlugin();
      const grid = createGridMockForPlugin(rows, columns);
      plugin.attach(grid as any);

      const text = plugin.getSelectionAsText({ columns: ['name', 'email'] });
      expect(text).toContain('Alice');
      expect(text).toContain('alice@test.com');
      expect(text).not.toContain('30');
    });

    it('should copy data and update lastCopied', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        writable: true,
        configurable: true,
      });

      const columns: ColumnConfig[] = [{ field: 'name', header: 'Name' }];
      const rows = [{ name: 'Alice' }];
      const plugin = new ClipboardPlugin();
      const grid = createGridMockForPlugin(rows, columns);
      plugin.attach(grid as any);

      const text = await plugin.copy();
      expect(text).toContain('Alice');
      expect(plugin.getLastCopied()).not.toBeNull();
      expect(plugin.getLastCopied()?.text).toBe(text);
    });

    it('should emit copy event on successful copy', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        writable: true,
        configurable: true,
      });

      const columns: ColumnConfig[] = [{ field: 'name', header: 'Name' }];
      const rows = [{ name: 'Alice' }];
      const plugin = new ClipboardPlugin();
      const grid = createGridMockForPlugin(rows, columns);
      plugin.attach(grid as any);

      await plugin.copy();
      expect(grid.dispatchEvent).toHaveBeenCalled();
      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe('copy');
      expect(event.detail.rowCount).toBe(1);
      expect(event.detail.columnCount).toBe(1);
    });

    it('should return empty string from copy when no data', async () => {
      const plugin = new ClipboardPlugin();
      const grid = createGridMockForPlugin([], []);
      plugin.attach(grid as any);

      const text = await plugin.copy();
      expect(text).toBe('');
    });

    it('should copy specific rows via copyRows', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        writable: true,
        configurable: true,
      });

      const columns: ColumnConfig[] = [{ field: 'name', header: 'Name' }];
      const rows = [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }];
      const plugin = new ClipboardPlugin();
      const grid = createGridMockForPlugin(rows, columns);
      plugin.attach(grid as any);

      const text = await plugin.copyRows([0, 2]);
      expect(text).toContain('Alice');
      expect(text).toContain('Charlie');
      expect(text).not.toContain('Bob');
    });

    it('should return empty string from copyRows with empty indices', async () => {
      const plugin = new ClipboardPlugin();
      const grid = createGridMockForPlugin([], []);
      plugin.attach(grid as any);

      const text = await plugin.copyRows([]);
      expect(text).toBe('');
    });

    it('should parse clipboard content via paste()', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { readText: vi.fn().mockResolvedValue('A\tB\nC\tD') },
        writable: true,
        configurable: true,
      });

      const plugin = new ClipboardPlugin();
      const grid = createGridMockForPlugin();
      plugin.attach(grid as any);

      const result = await plugin.paste();
      expect(result).toEqual([
        ['A', 'B'],
        ['C', 'D'],
      ]);
    });

    it('should return null from paste() when clipboard is empty', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { readText: vi.fn().mockResolvedValue('') },
        writable: true,
        configurable: true,
      });

      const plugin = new ClipboardPlugin();
      const grid = createGridMockForPlugin();
      plugin.attach(grid as any);

      const result = await plugin.paste();
      expect(result).toBeNull();
    });

    it('should handle onKeyDown for Ctrl+C', () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        writable: true,
        configurable: true,
      });

      const columns: ColumnConfig[] = [{ field: 'name', header: 'Name' }];
      const rows = [{ name: 'Alice' }];
      const plugin = new ClipboardPlugin();
      const grid = createGridMockForPlugin(rows, columns);
      plugin.attach(grid as any);

      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true });
      const cell = document.createElement('div');
      Object.defineProperty(event, 'target', { value: cell });

      const result = plugin.onKeyDown(event);
      expect(result).toBe(true);
    });

    it('should not handle onKeyDown for non-copy keys', () => {
      const plugin = new ClipboardPlugin();
      const grid = createGridMockForPlugin();
      plugin.attach(grid as any);

      const event = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true });
      const result = plugin.onKeyDown(event);
      expect(result).toBe(false);
    });

    it('should clear lastCopied on detach', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        writable: true,
        configurable: true,
      });

      const columns: ColumnConfig[] = [{ field: 'name', header: 'Name' }];
      const rows = [{ name: 'Alice' }];
      const plugin = new ClipboardPlugin();
      const grid = createGridMockForPlugin(rows, columns);
      plugin.attach(grid as any);

      await plugin.copy();
      expect(plugin.getLastCopied()).not.toBeNull();

      plugin.detach();
      expect(plugin.getLastCopied()).toBeNull();
    });
  });

  // #endregion
});
