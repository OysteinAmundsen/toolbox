# Clipboard Plugin

Copy and paste grid data with configurable delimiters.

## Installation

```typescript
import { ClipboardPlugin } from '@toolbox-web/grid/plugins/clipboard';
```

## Usage

```typescript
import { ClipboardPlugin } from '@toolbox-web/grid/plugins/clipboard';

grid.gridConfig = {
  plugins: [
    new ClipboardPlugin({
      copyHeaders: true,
      delimiter: '\t',
    }),
  ],
};
```

## Configuration

| Option           | Type                            | Default | Description                                    |
| ---------------- | ------------------------------- | ------- | ---------------------------------------------- |
| `includeHeaders` | `boolean`                       | `false` | Include headers when copying                   |
| `delimiter`      | `string`                        | `'\t'`  | Column delimiter (tab for Excel compatibility) |
| `newline`        | `string`                        | `'\n'`  | Row delimiter                                  |
| `quoteStrings`   | `boolean`                       | `false` | Wrap string values with quotes                 |
| `processCell`    | `(value, field, row) => string` | -       | Custom cell value processor                    |

## Keyboard Shortcuts

| Shortcut | Action                   |
| -------- | ------------------------ |
| `Ctrl+C` | Copy selected cells/rows |
| `Ctrl+V` | Paste into grid          |

## Events

### `copy`

Fired when data is copied.

```typescript
grid.addEventListener('copy', (e) => {
  console.log('Copied text:', e.detail.text);
  console.log('Row count:', e.detail.rowCount);
  console.log('Column count:', e.detail.columnCount);
});
```

### `paste`

Fired when data is pasted.

```typescript
grid.addEventListener('paste', (e) => {
  console.log('Pasted rows:', e.detail.rows);
  console.log('Raw text:', e.detail.text);
});
```

## API Methods

Access via `grid.getPlugin(ClipboardPlugin)`:

### `copy(options?: CopyOptions): Promise<string>`

Copy data to the system clipboard. Without options, copies the current selection (or entire grid).
With options, copies exactly the specified columns and/or rows.

```typescript
const clipboard = grid.getPlugin(ClipboardPlugin);

// Copy current selection
await clipboard.copy();

// Copy specific columns from specific rows
await clipboard.copy({
  rowIndices: [0, 3, 7],
  columns: ['name', 'email'],
  includeHeaders: true,
});
```

### `copyRows(indices: number[], options?: CopyOptions): Promise<string>`

Copy specific rows by index. Supports non-contiguous indices.

```typescript
await clipboard.copyRows([0, 5], { columns: ['name', 'email'] });
```

### `getSelectionAsText(options?: CopyOptions): string`

Get the text representation without writing to the system clipboard.
Useful for previewing content or feeding into a custom UI dialog.

```typescript
const text = clipboard.getSelectionAsText({
  columns: ['name', 'department'],
  includeHeaders: true,
});
```

### `paste(): Promise<string[][] | null>`

Read and parse clipboard content.

```typescript
const parsed = await clipboard.paste();
```

### `getLastCopied(): { text: string; timestamp: number } | null`

Get info about the most recent copy operation.

### `CopyOptions`

| Option           | Type                            | Default      | Description                                    |
| ---------------- | ------------------------------- | ------------ | ---------------------------------------------- |
| `columns`        | `string[]`                      | -            | Specific column fields to include              |
| `rowIndices`     | `number[]`                      | -            | Specific row indices to copy                   |
| `includeHeaders` | `boolean`                       | config value | Include column headers in copied text          |
| `delimiter`      | `string`                        | config value | Column delimiter override                      |
| `newline`        | `string`                        | config value | Row delimiter override                         |
| `processCell`    | `(value, field, row) => string` | config value | Custom cell value processor for this operation |
