# Editing Plugin

Inline cell editing for `<tbw-grid>` with built-in and custom editors, validation, and change tracking.

## Installation

```typescript
import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';
```

## Usage

```typescript
import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';

grid.gridConfig = {
  columns: [
    { field: 'name', editable: true },
    { field: 'age', editable: true, editor: 'number' },
    { field: 'active', editable: true, editor: 'boolean' },
  ],
  plugins: [new EditingPlugin({ mode: 'row', editOn: 'dblclick' })],
};
```

## Configuration

| Option              | Type                                              | Default   | Description                                                              |
| ------------------- | ------------------------------------------------- | --------- | ------------------------------------------------------------------------ |
| `mode`              | `'row' \| 'grid'`                                 | `'row'`   | Row mode: edit one row at a time. Grid mode: all editors visible         |
| `editOn`            | `'click' \| 'dblclick' \| 'manual' \| false`      | `'click'` | How editing is triggered (row mode only)                                 |
| `onBeforeEditClose` | `(event: MouseEvent \| KeyboardEvent) => boolean` | —         | Return `false` to prevent row edit from closing                          |
| `focusTrap`         | `boolean`                                         | `false`   | When `true`, focus is returned to the editing cell if it leaves the grid |
| `dirtyTracking`     | `boolean`                                         | `false`   | Track row baselines and expose dirty/pristine state                      |

## Edit Modes

### Row Mode (`'row'`)

Click/double-click a row to enter edit mode. One row at a time.

- **Enter**: Begin row edit / commit
- **F2**: Edit single cell
- **Escape**: Cancel and revert
- **Tab**: Move to next editable cell

### Grid Mode (`'grid'`)

All editable cells always show editors (spreadsheet-like).

## Column Configuration

| Property       | Type               | Description                                   |
| -------------- | ------------------ | --------------------------------------------- |
| `editable`     | `boolean`          | Whether the column is editable                |
| `editor`       | `ColumnEditorSpec` | Built-in editor type or custom editor factory |
| `editorParams` | `EditorParams`     | Configuration for built-in editors            |

### Built-in Editors

- `'text'` — Text input (default for string columns)
- `'number'` — Number input with min/max/step
- `'date'` — Date picker
- `'boolean'` — Checkbox toggle
- `'select'` — Dropdown with options

## Events

| Event                | Detail                        | Description                                                                                                                                |
| -------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `cell-commit`        | `CellCommitDetail<TRow>`      | Cell value committed (cancelable)                                                                                                          |
| `row-commit`         | `RowCommitDetail<TRow>`       | Row edit session ended (cancelable)                                                                                                        |
| `edit-open`          | `EditOpenDetail<TRow>`        | Row entered edit mode                                                                                                                      |
| `before-edit-close`  | `BeforeEditCloseDetail<TRow>` | Fires synchronously before edit state is cleared on commit (row mode). Lets managed editors flush pending values. Does not fire on revert. |
| `edit-close`         | `EditCloseDetail<TRow>`       | Row left edit mode                                                                                                                         |
| `changed-rows-reset` | `ChangedRowsResetDetail`      | Change tracking reset                                                                                                                      |
| `dirty-change`       | `DirtyChangeDetail<TRow>`     | Row dirty state changed (requires `dirtyTracking: true`). Detail includes `rowId`, `row`, `original`, `type`                               |

## API Methods

Access via `grid.getPlugin(EditingPlugin)`:

```typescript
const editing = grid.getPlugin(EditingPlugin);

// Check state
editing.isRowEditing(rowIndex);
editing.isCellEditing(rowIndex, colIndex);
editing.isRowChanged(rowIndex);

// Change tracking
editing.changedRows; // All modified rows
editing.changedRowIds; // IDs of modified rows
editing.resetChangedRows();

// Programmatic editing
editing.beginCellEdit(rowIndex, field);
editing.beginBulkEdit(rowIndex);
editing.commitActiveRowEdit();
editing.cancelActiveRowEdit();

// Validation
editing.setInvalid(rowId, field, 'Required');
editing.clearInvalid(rowId, field);
editing.isCellInvalid(rowId, field);
editing.hasInvalidCells(rowId);
editing.getInvalidFields(rowId);

// Dirty tracking (requires dirtyTracking: true)
editing.isDirty(rowId); // true if row differs from baseline
editing.isPristine(rowId); // opposite of isDirty
editing.dirty; // true if any row is dirty
editing.getDirtyRows(); // [{ id, original, current }]
editing.markAsPristine(rowId); // re-snapshot after save
editing.markAllPristine(); // re-snapshot all after batch save
editing.revertRow(rowId); // revert to baseline values
editing.getOriginalRow(rowId); // deep clone of baseline
```

## Row CSS Classes

When `dirtyTracking: true`, the plugin applies CSS classes to rows:

| CSS Class       | Meaning                            |
| --------------- | ---------------------------------- |
| `tbw-row-dirty` | Row data differs from baseline     |
| `tbw-row-new`   | Row was inserted via `insertRow()` |

## Documentation

See the [Storybook docs](https://toolboxjs.com/?path=/docs/grid-plugins-editing--docs) for live examples.
