/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExportPlugin } from './ExportPlugin';
import type { ExportCompleteDetail } from './types';

// Mock download functions to prevent actual file downloads
vi.mock('./csv', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    downloadCsv: vi.fn(),
    downloadBlob: vi.fn(),
  };
});

vi.mock('./excel', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    downloadExcel: vi.fn(),
  };
});

function createGridMock(rows: any[] = [], columns: any[] = []) {
  const gridEl = document.createElement('div');
  return {
    rows,
    sourceRows: rows,
    columns,
    _visibleColumns: columns.filter((c: any) => !c.hidden),
    _hostElement: gridEl,
    gridConfig: {},
    effectiveConfig: {},
    getPlugin: () => undefined,
    getPluginState: vi.fn(() => null),
    query: () => [],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
    requestRender: vi.fn(),
    requestStateChange: vi.fn(),
    children: [document.createElement('div')],
    querySelectorAll: () => [],
    querySelector: () => null,
    clientWidth: 800,
    classList: { add: vi.fn(), remove: vi.fn() },
    disconnectSignal: new AbortController().signal,
  };
}

const sampleColumns = [
  { field: 'name', header: 'Name' },
  { field: 'age', header: 'Age', type: 'number' as const },
  { field: 'city', header: 'City' },
];

const sampleRows = [
  { name: 'Alice', age: 30, city: 'New York' },
  { name: 'Bob', age: 25, city: 'Los Angeles' },
  { name: 'Charlie', age: 35, city: 'Chicago' },
];

describe('ExportPlugin', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor & defaults', () => {
    it('should have name "export"', () => {
      const plugin = new ExportPlugin();
      expect(plugin.name).toBe('export');
    });

    it('should use default config values', () => {
      const plugin = new ExportPlugin();
      const grid = createGridMock(sampleRows, sampleColumns);
      plugin.attach(grid as any);

      // Verify defaults by exercising the plugin
      expect(plugin.isExporting()).toBe(false);
      expect(plugin.getLastExport()).toBeNull();
    });

    it('should accept custom config', () => {
      const plugin = new ExportPlugin({
        fileName: 'my-export',
        includeHeaders: false,
        onlyVisible: false,
        onlySelected: true,
      });
      expect(plugin.name).toBe('export');
    });
  });

  describe('exportCsv', () => {
    it('should export CSV and emit export-complete event', async () => {
      const plugin = new ExportPlugin({ fileName: 'test' });
      const grid = createGridMock(sampleRows, sampleColumns);
      plugin.attach(grid as any);

      plugin.exportCsv();

      expect(grid.dispatchEvent).toHaveBeenCalled();
      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ExportCompleteDetail>;
      expect(event.type).toBe('export-complete');
      expect(event.detail.format).toBe('csv');
      expect(event.detail.fileName).toBe('test.csv');
      expect(event.detail.rowCount).toBe(3);
      expect(event.detail.columnCount).toBe(3);
    });

    it('should not double-append .csv extension', () => {
      const plugin = new ExportPlugin({ fileName: 'test.csv' });
      const grid = createGridMock(sampleRows, sampleColumns);
      plugin.attach(grid as any);

      plugin.exportCsv();

      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ExportCompleteDetail>;
      expect(event.detail.fileName).toBe('test.csv');
    });

    it('should pass params override to export', () => {
      const plugin = new ExportPlugin({ fileName: 'default' });
      const grid = createGridMock(sampleRows, sampleColumns);
      plugin.attach(grid as any);

      plugin.exportCsv({ fileName: 'override' });

      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ExportCompleteDetail>;
      expect(event.detail.fileName).toBe('override.csv');
    });
  });

  describe('exportExcel', () => {
    it('should export Excel and emit export-complete event', () => {
      const plugin = new ExportPlugin({ fileName: 'test' });
      const grid = createGridMock(sampleRows, sampleColumns);
      plugin.attach(grid as any);

      plugin.exportExcel();

      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ExportCompleteDetail>;
      expect(event.type).toBe('export-complete');
      expect(event.detail.format).toBe('excel');
      expect(event.detail.fileName).toBe('test.xls');
      expect(event.detail.rowCount).toBe(3);
      expect(event.detail.columnCount).toBe(3);
    });

    it('should not double-append .xls extension', () => {
      const plugin = new ExportPlugin({ fileName: 'test.xls' });
      const grid = createGridMock(sampleRows, sampleColumns);
      plugin.attach(grid as any);

      plugin.exportExcel();

      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ExportCompleteDetail>;
      expect(event.detail.fileName).toBe('test.xls');
    });

    it('should pass excelStyles through to buildExcelXml', async () => {
      const { downloadExcel } = await import('./excel');
      const plugin = new ExportPlugin({ fileName: 'styled' });
      const grid = createGridMock(sampleRows, sampleColumns);
      plugin.attach(grid as any);

      plugin.exportExcel({
        excelStyles: {
          headerStyle: { font: { bold: true } },
          columnStyles: { age: { numberFormat: '0' } },
        },
      });

      const xmlContent = (downloadExcel as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as string;
      expect(xmlContent).toContain('<Styles>');
      expect(xmlContent).toContain('ss:Bold="1"');
      expect(xmlContent).toContain('ss:Format="0"');
    });

    it('should use .xml extension when fileExtension is overridden', () => {
      const plugin = new ExportPlugin({ fileName: 'report' });
      const grid = createGridMock(sampleRows, sampleColumns);
      plugin.attach(grid as any);

      plugin.exportExcel({ fileExtension: '.xml' });

      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ExportCompleteDetail>;
      expect(event.detail.fileName).toBe('report.xml');
    });

    it('should normalize fileExtension without leading dot', () => {
      const plugin = new ExportPlugin({ fileName: 'report' });
      const grid = createGridMock(sampleRows, sampleColumns);
      plugin.attach(grid as any);

      plugin.exportExcel({ fileExtension: 'xml' });

      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ExportCompleteDetail>;
      expect(event.detail.fileName).toBe('report.xml');
    });
  });

  describe('exportJson', () => {
    it('should export JSON and emit export-complete event', () => {
      const plugin = new ExportPlugin({ fileName: 'data' });
      const grid = createGridMock(sampleRows, sampleColumns);
      plugin.attach(grid as any);

      plugin.exportJson();

      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ExportCompleteDetail>;
      expect(event.type).toBe('export-complete');
      expect(event.detail.format).toBe('json');
      expect(event.detail.fileName).toBe('data.json');
      expect(event.detail.rowCount).toBe(3);
      expect(event.detail.columnCount).toBe(3);
    });

    it('should not double-append .json extension', () => {
      const plugin = new ExportPlugin({ fileName: 'data.json' });
      const grid = createGridMock(sampleRows, sampleColumns);
      plugin.attach(grid as any);

      plugin.exportJson();

      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ExportCompleteDetail>;
      expect(event.detail.fileName).toBe('data.json');
    });
  });

  describe('isExporting', () => {
    it('should return false when not exporting', () => {
      const plugin = new ExportPlugin();
      const grid = createGridMock(sampleRows, sampleColumns);
      plugin.attach(grid as any);

      expect(plugin.isExporting()).toBe(false);
    });

    it('should return false after export completes', () => {
      const plugin = new ExportPlugin();
      const grid = createGridMock(sampleRows, sampleColumns);
      plugin.attach(grid as any);

      plugin.exportCsv();

      expect(plugin.isExporting()).toBe(false);
    });
  });

  describe('getLastExport', () => {
    it('should return null when no export has occurred', () => {
      const plugin = new ExportPlugin();
      const grid = createGridMock(sampleRows, sampleColumns);
      plugin.attach(grid as any);

      expect(plugin.getLastExport()).toBeNull();
    });

    it('should return info about the last CSV export', () => {
      const plugin = new ExportPlugin();
      const grid = createGridMock(sampleRows, sampleColumns);
      plugin.attach(grid as any);

      plugin.exportCsv();

      const info = plugin.getLastExport();
      expect(info).not.toBeNull();
      expect(info!.format).toBe('csv');
      expect(info!.timestamp).toBeInstanceOf(Date);
    });

    it('should return info about the last Excel export', () => {
      const plugin = new ExportPlugin();
      const grid = createGridMock(sampleRows, sampleColumns);
      plugin.attach(grid as any);

      plugin.exportExcel();

      const info = plugin.getLastExport();
      expect(info!.format).toBe('excel');
    });

    it('should return info about the last JSON export', () => {
      const plugin = new ExportPlugin();
      const grid = createGridMock(sampleRows, sampleColumns);
      plugin.attach(grid as any);

      plugin.exportJson();

      const info = plugin.getLastExport();
      expect(info!.format).toBe('json');
    });

    it('should update to latest export', () => {
      const plugin = new ExportPlugin();
      const grid = createGridMock(sampleRows, sampleColumns);
      plugin.attach(grid as any);

      plugin.exportCsv();
      plugin.exportExcel();

      const info = plugin.getLastExport();
      expect(info!.format).toBe('excel');
    });
  });

  describe('onlyVisible columns', () => {
    it('should exclude hidden columns when onlyVisible is true', () => {
      const columns = [
        { field: 'name', header: 'Name' },
        { field: 'secret', header: 'Secret', hidden: true },
        { field: 'age', header: 'Age' },
      ];
      const rows = [{ name: 'Alice', secret: 'foo', age: 30 }];

      const plugin = new ExportPlugin({ onlyVisible: true });
      const grid = createGridMock(rows, columns);
      plugin.attach(grid as any);

      plugin.exportCsv();

      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ExportCompleteDetail>;
      expect(event.detail.columnCount).toBe(2);
    });

    it('should include hidden columns when onlyVisible is false', () => {
      const columns = [
        { field: 'name', header: 'Name' },
        { field: 'secret', header: 'Secret', hidden: true },
        { field: 'age', header: 'Age' },
      ];
      const rows = [{ name: 'Alice', secret: 'foo', age: 30 }];

      const plugin = new ExportPlugin({ onlyVisible: false });
      const grid = createGridMock(rows, columns);
      plugin.attach(grid as any);

      plugin.exportCsv();

      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ExportCompleteDetail>;
      expect(event.detail.columnCount).toBe(3);
    });

    it('should exclude utility columns', () => {
      const columns = [
        { field: '__select', header: '', meta: { utility: true } },
        { field: 'name', header: 'Name' },
        { field: 'age', header: 'Age' },
      ];
      const rows = [{ name: 'Alice', age: 30 }];

      const plugin = new ExportPlugin({ onlyVisible: true });
      const grid = createGridMock(rows, columns);
      plugin.attach(grid as any);

      plugin.exportCsv();

      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ExportCompleteDetail>;
      expect(event.detail.columnCount).toBe(2);
    });
  });

  describe('onlySelected rows', () => {
    it('should export only selected rows when onlySelected is true and rows are selected', () => {
      const plugin = new ExportPlugin({ onlySelected: true });
      const grid = createGridMock(sampleRows, sampleColumns);
      grid.getPluginState = vi.fn(() => ({ selected: new Set([0, 2]) }));
      plugin.attach(grid as any);

      plugin.exportCsv();

      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ExportCompleteDetail>;
      expect(event.detail.rowCount).toBe(2);
    });

    it('should export all rows when onlySelected is true but no rows are selected', () => {
      const plugin = new ExportPlugin({ onlySelected: true });
      const grid = createGridMock(sampleRows, sampleColumns);
      grid.getPluginState = vi.fn(() => ({ selected: new Set() }));
      plugin.attach(grid as any);

      plugin.exportCsv();

      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ExportCompleteDetail>;
      expect(event.detail.rowCount).toBe(3);
    });

    it('should export all rows when onlySelected is true but selection plugin is not loaded', () => {
      const plugin = new ExportPlugin({ onlySelected: true });
      const grid = createGridMock(sampleRows, sampleColumns);
      grid.getPluginState = vi.fn(() => null);
      plugin.attach(grid as any);

      plugin.exportCsv();

      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ExportCompleteDetail>;
      expect(event.detail.rowCount).toBe(3);
    });
  });

  describe('rowIndices parameter', () => {
    it('should export specific rows by index', () => {
      const plugin = new ExportPlugin();
      const grid = createGridMock(sampleRows, sampleColumns);
      plugin.attach(grid as any);

      plugin.exportCsv({ rowIndices: [1] });

      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ExportCompleteDetail>;
      expect(event.detail.rowCount).toBe(1);
    });
  });

  describe('columns parameter', () => {
    it('should export specific columns by field name', () => {
      const plugin = new ExportPlugin();
      const grid = createGridMock(sampleRows, sampleColumns);
      plugin.attach(grid as any);

      plugin.exportCsv({ columns: ['name', 'city'] });

      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ExportCompleteDetail>;
      expect(event.detail.columnCount).toBe(2);
    });
  });

  describe('processCell parameter', () => {
    it('should apply processCell to JSON export', () => {
      const plugin = new ExportPlugin();
      const grid = createGridMock([{ name: 'Alice', age: 30 }], sampleColumns);
      plugin.attach(grid as any);

      // The processCell callback is passed through to buildCsv/buildExcelXml/JSON builder
      // For JSON, we can verify the output indirectly through the event
      plugin.exportJson({
        processCell: (value, field) => (field === 'age' ? value * 2 : value),
      });

      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ExportCompleteDetail>;
      expect(event.detail.format).toBe('json');
      expect(event.detail.rowCount).toBe(1);
    });
  });

  describe('empty data', () => {
    it('should handle export with no rows', () => {
      const plugin = new ExportPlugin();
      const grid = createGridMock([], sampleColumns);
      plugin.attach(grid as any);

      plugin.exportCsv();

      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ExportCompleteDetail>;
      expect(event.detail.rowCount).toBe(0);
      expect(event.detail.columnCount).toBe(3);
    });

    it('should handle export with no columns', () => {
      const plugin = new ExportPlugin({ onlyVisible: false });
      const grid = createGridMock(sampleRows, []);
      plugin.attach(grid as any);

      plugin.exportCsv();

      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ExportCompleteDetail>;
      expect(event.detail.columnCount).toBe(0);
    });
  });

  describe('default fileName', () => {
    it('should use "export" as default fileName', () => {
      const plugin = new ExportPlugin();
      const grid = createGridMock(sampleRows, sampleColumns);
      plugin.attach(grid as any);

      plugin.exportCsv();

      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<ExportCompleteDetail>;
      expect(event.detail.fileName).toBe('export.csv');
    });
  });

  describe('data accessors (export, formatCsv, formatExcel, getResolvedColumns)', () => {
    const formattedColumns = [
      { field: 'name', header: 'Name' },
      {
        field: 'salary',
        header: 'Salary',
        type: 'number' as const,
        format: (v: unknown) => `$${(v as number).toFixed(2)}`,
      },
      { field: 'hired', header: 'Hired', type: 'date' as const },
      { field: 'active', header: 'Active', type: 'boolean' as const },
    ];

    const hireDate = new Date('2023-04-01T00:00:00Z');
    const formattedRows = [
      { name: 'Alice', salary: 95000, hired: hireDate, active: true },
      { name: 'Bob', salary: 75000, hired: hireDate, active: false },
    ];

    it('export() default mode "raw" returns underlying typed values', () => {
      const plugin = new ExportPlugin();
      const grid = createGridMock(formattedRows, formattedColumns);
      plugin.attach(grid as any);

      const data = plugin.export();

      expect(data).toHaveLength(2);
      expect(data[0]).toEqual({
        name: 'Alice',
        salary: 95000,
        hired: hireDate,
        active: true,
      });
      // Date stays Date, number stays number
      expect(data[0]['hired']).toBeInstanceOf(Date);
      expect(typeof data[0]['salary']).toBe('number');
    });

    it('export({ mode: "formatted" }) applies column.format and column-type defaults', () => {
      const plugin = new ExportPlugin();
      const grid = createGridMock(formattedRows, formattedColumns);
      plugin.attach(grid as any);

      const data = plugin.export({ mode: 'formatted' });

      // column.format applied to salary
      expect(data[0]['salary']).toBe('$95000.00');
      // date column-type default formatter applied (formatDateValue → toLocaleDateString)
      expect(typeof data[0]['hired']).toBe('string');
      expect(data[0]['hired']).not.toBe('');
      // boolean stays as boolean primitive
      expect(data[0]['active']).toBe(true);
      expect(data[1]['active']).toBe(false);
    });

    it('export() honours processCell after formatting', () => {
      const plugin = new ExportPlugin();
      const grid = createGridMock(formattedRows, formattedColumns);
      plugin.attach(grid as any);

      const data = plugin.export({
        mode: 'formatted',
        processCell: (v, field) => (field === 'name' ? `Mr. ${v}` : v),
      });

      expect(data[0]['name']).toBe('Mr. Alice');
      expect(data[0]['salary']).toBe('$95000.00');
    });

    it('export() honours columns + rowIndices filters', () => {
      const plugin = new ExportPlugin();
      const grid = createGridMock(formattedRows, formattedColumns);
      plugin.attach(grid as any);

      const data = plugin.export({ columns: ['name'], rowIndices: [1] });

      expect(data).toEqual([{ name: 'Bob' }]);
    });

    it('exportCsv() default behaviour matches the regression snapshot', async () => {
      const { downloadCsv } = await import('./csv');
      const plugin = new ExportPlugin({ fileName: 'snap' });
      const grid = createGridMock(formattedRows, formattedColumns);
      plugin.attach(grid as any);

      plugin.exportCsv();

      const csv = (downloadCsv as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as string;
      // Strip BOM for assertions
      const body = csv.replace(/^\uFEFF/, '');
      // Headers + 2 data rows; raw values (numbers stay numbers, Date → ISO via formatCsvValue)
      expect(body.split('\n')[0]).toBe('Name,Salary,Hired,Active');
      expect(body).toContain('Alice,95000,');
      expect(body).toContain('Bob,75000,');
      expect(body).toContain(hireDate.toISOString());
    });

    it('exportCsv({ mode: "formatted" }) reflects column.format output', async () => {
      const { downloadCsv } = await import('./csv');
      const plugin = new ExportPlugin({ fileName: 'snap' });
      const grid = createGridMock(formattedRows, formattedColumns);
      plugin.attach(grid as any);

      plugin.exportCsv({ mode: 'formatted' });

      const csv = (downloadCsv as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as string;
      const body = csv.replace(/^\uFEFF/, '');
      // $95000.00 contains no special chars → unquoted
      expect(body).toContain('Alice,$95000.00,');
      expect(body).toContain('Bob,$75000.00,');
    });

    it('formatCsv() and exportCsv() produce the same output for the same data + params', async () => {
      const { downloadCsv } = await import('./csv');
      const plugin = new ExportPlugin({ fileName: 'snap' });
      const grid = createGridMock(formattedRows, formattedColumns);
      plugin.attach(grid as any);

      plugin.exportCsv();
      const downloadedCsv = ((downloadCsv as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as string).replace(
        /^\uFEFF/,
        '',
      );

      const data = plugin.export();
      const composed = plugin.formatCsv(data);

      expect(composed).toBe(downloadedCsv);
    });

    it('formatExcel() and exportExcel() produce identical XML for the same data + params', async () => {
      const { downloadExcel } = await import('./excel');
      const plugin = new ExportPlugin({ fileName: 'snap' });
      const grid = createGridMock(formattedRows, formattedColumns);
      plugin.attach(grid as any);

      plugin.exportExcel();
      const downloadedXml = (downloadExcel as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as string;

      const data = plugin.export();
      const composed = plugin.formatExcel(data);

      expect(composed).toBe(downloadedXml);
    });

    it('formatCsv() respects the options argument (delimiter, newline, bom)', () => {
      const plugin = new ExportPlugin();
      const grid = createGridMock(formattedRows, formattedColumns);
      plugin.attach(grid as any);

      const csv = plugin.formatCsv(
        plugin.export({ columns: ['name', 'salary'] }),
        { columns: ['name', 'salary'] },
        {
          delimiter: ';',
          newline: '\r\n',
          bom: true,
        },
      );

      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('Name;Salary');
      expect(csv.split('\r\n').length).toBeGreaterThan(1);
    });

    it('getResolvedColumns() returns the columns an export would include', () => {
      const cols = [
        { field: 'a', header: 'A' },
        { field: 'b', header: 'B', hidden: true },
        { field: 'c', header: 'C' },
      ];
      const plugin = new ExportPlugin();
      const grid = createGridMock([], cols);
      plugin.attach(grid as any);

      // Default onlyVisible=true filters out hidden
      const visible = plugin.getResolvedColumns();
      expect(visible.map((c) => c.field)).toEqual(['a', 'c']);

      // Explicit columns filter is honoured
      const filtered = plugin.getResolvedColumns({ columns: ['c'] });
      expect(filtered.map((c) => c.field)).toEqual(['c']);
    });

    it('exportJson() default raw output matches JSON.stringify(export())', async () => {
      const { downloadBlob } = await import('./csv');
      const plugin = new ExportPlugin({ fileName: 'snap' });
      const grid = createGridMock(formattedRows, formattedColumns);
      plugin.attach(grid as any);

      plugin.exportJson();
      const blob = (downloadBlob as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as Blob;
      const text = await blob.text();

      const expected = JSON.stringify(plugin.export(), null, 2);
      expect(text).toBe(expected);
    });

    it('valueAccessor on a column is honoured during export() and not double-applied downstream', () => {
      const cols = [
        { field: 'name', header: 'Name' },
        {
          field: 'fullName',
          header: 'Full',
          valueAccessor: ({ row }: { row: Record<string, unknown> }) => `${row['first']} ${row['last']}`,
        },
      ];
      const rows = [{ name: 'A', first: 'Ada', last: 'Lovelace' }];
      const plugin = new ExportPlugin();
      const grid = createGridMock(rows, cols);
      plugin.attach(grid as any);

      const data = plugin.export();

      expect(data[0]).toEqual({ name: 'A', fullName: 'Ada Lovelace' });

      // CSV path also resolves the accessor via #buildExportData (not re-applied to synthetic rows)
      const csv = plugin.formatCsv(data);
      expect(csv).toContain('Ada Lovelace');
    });
  });
});
