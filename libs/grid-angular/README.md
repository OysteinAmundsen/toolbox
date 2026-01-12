# @toolbox-web/grid-angular

[![npm version](https://img.shields.io/npm/v/@toolbox-web/grid-angular.svg)](https://www.npmjs.com/package/@toolbox-web/grid-angular)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)

Angular adapter for `@toolbox-web/grid` data grid component. Provides directives for declarative template-driven cell renderers and editors.

## Features

- ✅ **Auto-adapter registration** - Just import `Grid` directive
- ✅ **Structural directives** - Clean `*tbwRenderer` and `*tbwEditor` syntax
- ✅ **Template-driven renderers** - Use `<ng-template>` for custom cell views
- ✅ **Template-driven editors** - Use `<ng-template>` for custom cell editors
- ✅ **Auto-wiring** - Editor components just emit events, no manual binding needed
- ✅ **Full type safety** - Typed template contexts (`GridCellContext`, `GridEditorContext`)
- ✅ **Angular 17+** - Standalone components, signals support
- ✅ **AOT compatible** - Works with Angular's ahead-of-time compilation

## Installation

```bash
# npm
npm install @toolbox-web/grid @toolbox-web/grid-angular

# yarn
yarn add @toolbox-web/grid @toolbox-web/grid-angular

# pnpm
pnpm add @toolbox-web/grid @toolbox-web/grid-angular

# bun
bun add @toolbox-web/grid @toolbox-web/grid-angular
```

## Quick Start

### 1. Register the Grid Component

In your Angular application, import the grid registration:

```typescript
// main.ts or app.config.ts
import '@toolbox-web/grid';
```

### 2. Use in Components

```typescript
import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Grid } from '@toolbox-web/grid-angular';

@Component({
  selector: 'app-my-grid',
  imports: [Grid],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: ` <tbw-grid [rows]="rows" [gridConfig]="config" style="height: 400px; display: block;"> </tbw-grid> `,
})
export class MyGridComponent {
  rows = [
    { id: 1, name: 'Alice', status: 'active' },
    { id: 2, name: 'Bob', status: 'inactive' },
  ];

  config = {
    columns: [
      { field: 'id', header: 'ID', type: 'number' },
      { field: 'name', header: 'Name' },
      { field: 'status', header: 'Status' },
    ],
  };
}
```

## Structural Directives (Recommended)

The cleanest way to define custom renderers and editors is with structural directives. These provide a concise syntax without the boilerplate of nested `<ng-template>` elements.

### TbwRenderer

Use `*tbwRenderer` to customize how cell values are displayed:

```typescript
import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Grid, TbwRenderer } from '@toolbox-web/grid-angular';

@Component({
  imports: [Grid, TbwRenderer, StatusBadgeComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <tbw-grid [rows]="rows" [gridConfig]="config">
      <tbw-grid-column field="status">
        <app-status-badge *tbwRenderer="let value" [value]="value" />
      </tbw-grid-column>
    </tbw-grid>
  `,
})
export class MyGridComponent {}
```

**Template Context:**

| Variable    | Type      | Description                           |
| ----------- | --------- | ------------------------------------- |
| `$implicit` | `TValue`  | The cell value (use with `let-value`) |
| `row`       | `TRow`    | The full row data object              |
| `column`    | `unknown` | The column configuration              |

### TbwEditor

Use `*tbwEditor` for custom cell editors. The adapter automatically listens for `commit` and `cancel` events from your component, so you don't need to manually wire up callbacks:

```typescript
import { Component, CUSTOM_ELEMENTS_SCHEMA, output } from '@angular/core';
import { Grid, TbwRenderer, TbwEditor } from '@toolbox-web/grid-angular';

// Your editor component just needs to emit 'commit' and 'cancel' events
@Component({
  selector: 'app-status-editor',
  template: `
    <select [value]="value()" (change)="commit.emit($any($event.target).value)">
      <option value="active">Active</option>
      <option value="inactive">Inactive</option>
    </select>
  `,
})
export class StatusEditorComponent {
  value = input<string>();
  commit = output<string>();
  cancel = output<void>();
}

@Component({
  imports: [Grid, TbwRenderer, TbwEditor, StatusBadgeComponent, StatusEditorComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <tbw-grid [rows]="rows" [gridConfig]="config">
      <tbw-grid-column field="status" editable>
        <app-status-badge *tbwRenderer="let value" [value]="value" />
        <app-status-editor *tbwEditor="let value" [value]="value" />
      </tbw-grid-column>
    </tbw-grid>
  `,
})
export class MyGridComponent {}
```

**Template Context:**

| Variable    | Type       | Description                                  |
| ----------- | ---------- | -------------------------------------------- |
| `$implicit` | `TValue`   | The cell value (use with `let-value`)        |
| `row`       | `TRow`     | The full row data object                     |
| `column`    | `unknown`  | The column configuration                     |
| `onCommit`  | `Function` | Callback to commit (optional with auto-wire) |
| `onCancel`  | `Function` | Callback to cancel (optional with auto-wire) |

> **Auto-wiring:** If your editor component emits a `commit` event with the new value, the adapter automatically calls the grid's commit function. Similarly for `cancel`. This means you can skip the explicit `onCommit`/`onCancel` bindings!

## Nested Directive Syntax (Alternative)

For more explicit control, you can use the nested directive syntax with `<ng-template>`:

### GridColumnView

```typescript
import { Grid, GridColumnView } from '@toolbox-web/grid-angular';

@Component({
  imports: [Grid, GridColumnView],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <tbw-grid [rows]="rows" [gridConfig]="config">
      <tbw-grid-column field="status">
        <tbw-grid-column-view>
          <ng-template let-value let-row="row">
            <span [class]="'badge badge--' + value">{{ value }}</span>
          </ng-template>
        </tbw-grid-column-view>
      </tbw-grid-column>
    </tbw-grid>
  `
})
```

### GridColumnEditor

```typescript
import { Grid, GridColumnView, GridColumnEditor } from '@toolbox-web/grid-angular';

@Component({
  imports: [Grid, GridColumnView, GridColumnEditor],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <tbw-grid [rows]="rows" [gridConfig]="config">
      <tbw-grid-column field="status" editable>
        <tbw-grid-column-view>
          <ng-template let-value>
            <span [class]="'badge badge--' + value">{{ value }}</span>
          </ng-template>
        </tbw-grid-column-view>
        <tbw-grid-column-editor>
          <ng-template let-value let-commit="commit" let-cancel="cancel">
            <select [value]="value" (change)="commit.emit($any($event.target).value)">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </ng-template>
        </tbw-grid-column-editor>
      </tbw-grid-column>
    </tbw-grid>
  `
})
```

## Grid-Level Events

The `Grid` directive provides convenient outputs for common grid events:

```typescript
import { Grid, CellCommitEvent, RowCommitEvent } from '@toolbox-web/grid-angular';

@Component({
  imports: [Grid],
  template: `
    <tbw-grid
      [rows]="rows"
      [gridConfig]="config"
      (cellCommit)="onCellCommit($event)"
      (rowCommit)="onRowCommit($event)"
    />
  `,
})
export class MyGridComponent {
  onCellCommit(event: CellCommitEvent<Employee>) {
    console.log('Cell edited:', event.field, event.oldValue, '→', event.newValue);
  }

  onRowCommit(event: RowCommitEvent<Employee>) {
    console.log('Row saved:', event.rowIndex, event.row);
  }
}
```

## Master-Detail Panels

Use `GridDetailView` for expandable row details:

```typescript
import { Grid, GridDetailView } from '@toolbox-web/grid-angular';
import { MasterDetailPlugin } from '@toolbox-web/grid/all';

@Component({
  imports: [Grid, GridDetailView, DetailPanelComponent],
  template: `
    <tbw-grid [rows]="rows" [gridConfig]="config">
      <tbw-grid-detail showExpandColumn animation="slide">
        <ng-template let-row>
          <app-detail-panel [employee]="row" />
        </ng-template>
      </tbw-grid-detail>
    </tbw-grid>
  `,
})
export class MyGridComponent {
  config = {
    plugins: [new MasterDetailPlugin()],
    // ... columns
  };
}
```

## Custom Tool Panels

Add custom sidebar panels with `GridToolPanel`:

```typescript
import { Grid, GridToolPanel } from '@toolbox-web/grid-angular';

@Component({
  imports: [Grid, GridToolPanel, QuickFiltersPanelComponent],
  template: `
    <tbw-grid [rows]="rows" [gridConfig]="config">
      <tbw-grid-tool-panel
        id="filters"
        title="Quick Filters"
        icon="🔍"
        tooltip="Filter the data"
        [order]="10"
      >
        <ng-template let-grid>
          <app-quick-filters [grid]="grid" />
        </ng-template>
      </tbw-grid-tool-panel>
    </tbw-grid>
  `,
})
```

## API Reference

### Exported Directives

| Directive          | Selector                 | Description                            |
| ------------------ | ------------------------ | -------------------------------------- |
| `Grid`             | `tbw-grid`               | Main directive, auto-registers adapter |
| `TbwRenderer`      | `*tbwRenderer`           | Structural directive for cell views    |
| `TbwEditor`        | `*tbwEditor`             | Structural directive for cell editors  |
| `GridColumnView`   | `tbw-grid-column-view`   | Nested directive for cell views        |
| `GridColumnEditor` | `tbw-grid-column-editor` | Nested directive for cell editors      |
| `GridDetailView`   | `tbw-grid-detail`        | Master-detail panel template           |
| `GridToolPanel`    | `tbw-grid-tool-panel`    | Custom sidebar panel                   |

### Exported Types

```typescript
import type {
  GridCellContext,
  GridEditorContext,
  GridDetailContext,
  GridToolPanelContext,
  CellCommitEvent,
  RowCommitEvent,
  StructuralCellContext,
  StructuralEditorContext,
} from '@toolbox-web/grid-angular';
```

### AngularGridAdapter

The adapter class is exported for advanced use cases:

```typescript
import { AngularGridAdapter } from '@toolbox-web/grid-angular';
```

In most cases, the `Grid` directive handles adapter registration automatically.

## Migration from TbwCellView/TbwCellEditor

If you were using the previous directive names, update your imports and templates:

```typescript
// Before
import { TbwCellView, TbwCellEditor } from '@toolbox-web/grid-angular';

// After
import { TbwRenderer, TbwEditor } from '@toolbox-web/grid-angular';
```

```html
<!-- Before -->
<app-badge *tbwCellView="let value" [value]="value" />
<app-editor *tbwCellEditor="let value" [value]="value" />

<!-- After -->
<app-badge *tbwRenderer="let value" [value]="value" />
<app-editor *tbwEditor="let value" [value]="value" />
```

> **Backwards Compatibility:** The old names (`TbwCellView`, `TbwCellEditor`) are still exported as aliases but are deprecated. They will be removed in a future major version.

## Requirements

- Angular 17+ (standalone components)
- `@toolbox-web/grid` >= 0.2.0

## Demo

See the full Angular demo at [`demos/employee-management/angular/`](../../demos/employee-management/angular/) which demonstrates:

- 15+ plugins with full configuration
- Custom editors (star rating, date picker, status select, bonus slider)
- Custom renderers (status badges, rating colors, top performer stars)
- Structural directives with auto-wiring
- Signal-based reactivity
- Shell integration (header, tool panels)
- Master-detail expandable rows

## Development

```bash
# Build the library
bun nx build grid-angular

# Run tests
bun nx test grid-angular

# Lint
bun nx lint grid-angular
```

## License

MIT
