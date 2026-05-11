# Export Plugin

Export grid data to CSV, Excel (XML), and JSON formats.

## Installation

```typescript
import { ExportPlugin } from '@toolbox-web/grid/plugins/export';
```

## Usage

```typescript
import { ExportPlugin } from '@toolbox-web/grid/plugins/export';

grid.gridConfig = {
  plugins: [
    new ExportPlugin({
      fileName: 'my-data',
      includeHeaders: true,
    }),
  ],
};

// Export via API
const exporter = grid.getPluginByName('export');
exporter.exportCsv({ fileName: 'data' });
```

## Configuration

| Option           | Type      | Default    | Description                   |
| ---------------- | --------- | ---------- | ----------------------------- |
| `fileName`       | `string`  | `'export'` | Default file name for exports |
| `includeHeaders` | `boolean` | `true`     | Include column headers        |
| `onlyVisible`    | `boolean` | `true`     | Export only visible columns   |
| `onlySelected`   | `boolean` | `false`    | Export only selected rows     |

## API Methods

Access via `grid.getPluginByName('export')`:

```typescript
const exporter = grid.getPluginByName('export');

// Export to CSV
exporter.exportCsv({
  fileName: 'data',
  includeHeaders: true,
});

// Export to Excel (XML format)
exporter.exportExcel({ fileName: 'data' });

// Export to JSON
exporter.exportJson({ fileName: 'data' });

// Export specific columns/rows
exporter.exportCsv({
  columns: ['name', 'email'],
  rowIndices: [0, 1, 2],
});

// Check export status
const isExporting = exporter.isExporting();
const lastExport = exporter.getLastExport();
```

## Export Parameters (`ExportParams`)

All export methods accept optional `ExportParams`:

| Option             | Type                                        | Default      | Description                                                                                                                                                                 |
| ------------------ | ------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fileName`         | `string`                                    | config value | File name (without extension)                                                                                                                                               |
| `columns`          | `string[]`                                  | -            | Specific column fields to export                                                                                                                                            |
| `rowIndices`       | `number[]`                                  | -            | Specific row indices to export                                                                                                                                              |
| `includeHeaders`   | `boolean`                                   | config value | Include column headers in export                                                                                                                                            |
| `processCell`      | `(value, field, row) => any`                | -            | Custom cell value processor                                                                                                                                                 |
| `processHeader`    | `(header, field) => string`                 | -            | Custom header processor                                                                                                                                                     |
| `processHeaderRow` | `(cell, rowIndex) => HeaderRowCell \| null` | -            | Per-cell processor for plugin-contributed header rows (e.g. column groups). Return `null` to blank a cell; if every cell in a row is blank the row is dropped. Since 2.10.0 |
| `mode`             | `'raw' \| 'formatted'`                      | `'raw'`      | `'raw'` = underlying typed values; `'formatted'` = what the grid displays (`column.format` + type defaults)                                                                 |
| `fileExtension`    | `string`                                    | `'.xls'`     | Override file extension for Excel export (e.g. `'.xml'`)                                                                                                                    |
| `excelStyles`      | `ExcelStyleConfig`                          | -            | Excel style configuration (Excel only). Includes new `groupHeaderStyle` (since 2.10.0) for styling plugin-contributed header rows.                                          |

## Column Groups in Exports (since 2.10.0)

When the [`GroupingColumnsPlugin`](../grouping-columns/) is installed alongside the export plugin, column group headers are automatically included above the leaf headers in **Excel** and **JSON** exports. Fixes [#314](https://github.com/OysteinAmundsen/toolbox/issues/314).

- **Excel**: each group becomes a merged-cell row above the leaf headers (`ss:MergeAcross`). Style independently via `excelStyles.groupHeaderStyle`.
- **JSON**: output becomes `{ headerRows, rows }` when groups are present; stays a flat array when not (backward-compatible).
- **CSV**: stays flat — no native span representation.

The mechanism is a generic `collectHeaderRows` plugin query — third-party plugins can contribute their own header rows the same way without the export plugin needing to know about them.

## Excel File Format

Excel export produces **XML Spreadsheet 2003** output. The default file extension is `.xls` so the file opens in Excel on most operating systems. Because the underlying format is XML, Excel displays a "format mismatch" warning when opening the file — this is harmless and the data is not corrupt.

Set `fileExtension: '.xml'` to use the technically correct extension and suppress the warning. Note that `.xml` files typically open in a web browser rather than Excel.

## Styled Excel Export

Pass `excelStyles` to `exportExcel()` for formatted output:

```typescript
exporter.exportExcel({
  fileName: 'report',
  excelStyles: {
    headerStyle: { font: { bold: true, color: '#FFFFFF' }, fill: { color: '#4472C4' } },
    defaultStyle: { font: { name: 'Calibri', size: 10 } },
    columnStyles: {
      salary: { numberFormat: '$#,##0.00' },
      date: { numberFormat: 'yyyy-mm-dd' },
    },
    cellStyle: (value, field) => {
      if (field === 'status' && value === 'Active') return { fill: { color: '#C6EFCE' } };
      return undefined;
    },
    columnWidths: { name: 25, salary: 15 },
    autoFitColumns: false,
  },
});
```

Style precedence (highest → lowest): `cellStyle` callback → `columnStyles[field]` → `defaultStyle`.

## Custom Output / Hand-off to a Real `.xlsx` Writer

The plugin exposes data accessors so you can drive the export pipeline from JS without producing a download — useful for piping rows into a real OOXML writer (e.g. [ExcelJS](https://github.com/exceljs/exceljs)), copying CSV to the clipboard, sending data to a server, or pre-processing before download.

| Method                               | Returns                     | Purpose                                                          |
| ------------------------------------ | --------------------------- | ---------------------------------------------------------------- |
| `export(params?)`                    | `Record<string, unknown>[]` | Resolve the rows that would be exported, keyed by `column.field` |
| `formatCsv(data, params?, options?)` | `string`                    | Format already-resolved rows as CSV (no download)                |
| `formatExcel(data, params?)`         | `string`                    | Format already-resolved rows as Excel XML (no download)          |
| `getResolvedColumns(params?)`        | `ColumnConfig[]`            | The columns (in order) that an export would include              |

All accessors honour `onlyVisible`, `onlySelected`, `columns`, and `rowIndices` (which columns/rows are included), and `processCell` (per-cell transformation — applied once on the values that get written).

`export()` additionally honours `mode` (it owns value resolution). `formatCsv()` / `formatExcel()` are pure formatters: they write whatever you pass in, after running `processCell`. They don't apply `mode` because the data is already resolved — use `export({ mode: 'formatted' })` upstream if you need displayed values.

```typescript
import { queryGrid } from '@toolbox-web/grid';
import type { ExportPlugin } from '@toolbox-web/grid/plugins/export';

const grid = queryGrid('tbw-grid');
const exporter = grid.getPluginByName('export') as ExportPlugin;

// 1. Default download — raw values + processCell (unchanged behaviour)
exporter.exportCsv();

// 2. "Export what I see" — column.format applied
exporter.exportCsv({ mode: 'formatted' });

// 3. Get the rows without producing a file
const rows = exporter.export();

// 4. Compose: copy CSV to the clipboard
const csv = exporter.formatCsv(exporter.export());
await navigator.clipboard.writeText(csv);

// 5. Hand off raw rows to a real .xlsx writer
import ExcelJS from 'exceljs';
const cols = exporter.getResolvedColumns();
const rawRows = exporter.export();
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Sheet1');
sheet.columns = cols.map((c) => ({ header: c.header ?? c.field, key: c.field }));
sheet.addRows(rawRows);
const buffer = await workbook.xlsx.writeBuffer();
```

### `mode: 'raw' | 'formatted'`

- `'raw'` (default) — values straight from the row via `resolveCellValue`. Dates stay `Date`, numbers stay numbers. **Identical to the pre-existing `exportCsv` / `exportExcel` / `exportJson` output**, so this is non-breaking.
- `'formatted'` — applies the column-type default formatter and `column.format(value, row)`, returning the same string the user sees in the cell. `processCell` runs last on the formatted value.
