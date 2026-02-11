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
const exporter = grid.getPlugin(ExportPlugin);
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

Access via `grid.getPlugin(ExportPlugin)`:

```typescript
const exporter = grid.getPlugin(ExportPlugin);

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

| Option           | Type                         | Default      | Description                      |
| ---------------- | ---------------------------- | ------------ | -------------------------------- |
| `fileName`       | `string`                     | config value | File name (without extension)    |
| `columns`        | `string[]`                   | -            | Specific column fields to export |
| `rowIndices`     | `number[]`                   | -            | Specific row indices to export   |
| `includeHeaders` | `boolean`                    | config value | Include column headers in export |
| `processCell`    | `(value, field, row) => any` | -            | Custom cell value processor      |
| `processHeader`  | `(header, field) => string`  | -            | Custom header processor          |
