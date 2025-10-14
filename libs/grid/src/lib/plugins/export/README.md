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
  plugins: [new ExportPlugin()],
};

// Export via API
const exporter = grid.getPlugin(ExportPlugin);
exporter.exportCsv('data.csv');
```

## API Methods

Access via `grid.getPlugin(ExportPlugin)`:

```typescript
const exporter = grid.getPlugin(ExportPlugin);

// Export to CSV
exporter.exportCsv('data.csv', {
  delimiter: ',',
  includeHeaders: true,
});

// Export to Excel (XML format)
exporter.exportExcel('data.xlsx', {
  sheetName: 'Data',
});

// Export to JSON
exporter.exportJson('data.json', {
  pretty: true,
});

// Get export data without downloading
const csvString = exporter.toCsv();
const jsonData = exporter.toJson();
```

## Export Options

### CSV Options

| Option           | Type      | Default | Description               |
| ---------------- | --------- | ------- | ------------------------- |
| `delimiter`      | `string`  | `','`   | Field delimiter           |
| `includeHeaders` | `boolean` | `true`  | Include column headers    |
| `selectedOnly`   | `boolean` | `false` | Export only selected rows |

### Excel Options

| Option           | Type      | Default    | Description               |
| ---------------- | --------- | ---------- | ------------------------- |
| `sheetName`      | `string`  | `'Sheet1'` | Excel sheet name          |
| `includeHeaders` | `boolean` | `true`     | Include column headers    |
| `selectedOnly`   | `boolean` | `false`    | Export only selected rows |

### JSON Options

| Option         | Type      | Default | Description               |
| -------------- | --------- | ------- | ------------------------- |
| `pretty`       | `boolean` | `false` | Pretty-print JSON         |
| `selectedOnly` | `boolean` | `false` | Export only selected rows |
