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

```typescript
const clipboard = grid.getPlugin(ClipboardPlugin);

// Copy selection to clipboard
await clipboard.copy();

// Paste from clipboard
await clipboard.paste();

// Copy specific range
await clipboard.copyRange(startRow, startCol, endRow, endCol);
```
