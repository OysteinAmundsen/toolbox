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

| Option           | Type                         | Default      | Description                                              |
| ---------------- | ---------------------------- | ------------ | -------------------------------------------------------- |
| `fileName`       | `string`                     | config value | File name (without extension)                            |
| `columns`        | `string[]`                   | -            | Specific column fields to export                         |
| `rowIndices`     | `number[]`                   | -            | Specific row indices to export                           |
| `includeHeaders` | `boolean`                    | config value | Include column headers in export                         |
| `processCell`    | `(value, field, row) => any` | -            | Custom cell value processor                              |
| `processHeader`  | `(header, field) => string`  | -            | Custom header processor                                  |
| `fileExtension`  | `string`                     | `'.xls'`     | Override file extension for Excel export (e.g. `'.xml'`) |
| `excelStyles`    | `ExcelStyleConfig`           | -            | Excel style configuration (Excel only)                   |

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
