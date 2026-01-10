# @toolbox-web/grid-angular

[![npm version](https://img.shields.io/npm/v/@toolbox-web/grid-angular.svg)](https://www.npmjs.com/package/@toolbox-web/grid-angular)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)

Angular adapter for `@toolbox-web/grid` data grid component. Provides directives for declarative template-driven cell renderers and editors.

## Features

- ✅ **Auto-adapter registration** - Just import `Grid` directive
- ✅ **Template-driven renderers** - Use `<ng-template>` for custom cell views
- ✅ **Template-driven editors** - Use `<ng-template>` for custom cell editors
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

## Directives

### Grid

The main directive that auto-registers the Angular adapter on `<tbw-grid>` elements.

```typescript
import { Grid } from '@toolbox-web/grid-angular';

@Component({
  imports: [Grid],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<tbw-grid [rows]="rows" [gridConfig]="config"></tbw-grid>`
})
```

### GridColumnView

Captures an `<ng-template>` for custom cell rendering.

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

**Template Context (`GridCellContext`):**

| Variable    | Type      | Description                           |
| ----------- | --------- | ------------------------------------- |
| `$implicit` | `TValue`  | The cell value (use with `let-value`) |
| `value`     | `TValue`  | The cell value (explicit binding)     |
| `row`       | `TRow`    | The full row data object              |
| `column`    | `unknown` | The column configuration              |

### GridColumnEditor

Captures an `<ng-template>` for custom cell editing.

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

**Template Context (`GridEditorContext`):**

| Variable    | Type                   | Description                           |
| ----------- | ---------------------- | ------------------------------------- |
| `$implicit` | `TValue`               | The cell value (use with `let-value`) |
| `value`     | `TValue`               | The cell value (explicit binding)     |
| `row`       | `TRow`                 | The full row data object              |
| `column`    | `unknown`              | The column configuration              |
| `commit`    | `EventEmitter<TValue>` | Emit to commit the new value          |
| `cancel`    | `EventEmitter<void>`   | Emit to cancel editing                |

## Using Angular Components in Templates

You can use full Angular components inside the templates:

```typescript
@Component({
  imports: [Grid, GridColumnView, StatusBadgeComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <tbw-grid [rows]="rows" [gridConfig]="config">
      <tbw-grid-column field="status">
        <tbw-grid-column-view>
          <ng-template let-value let-row="row">
            <app-status-badge [status]="value" [employee]="row" />
          </ng-template>
        </tbw-grid-column-view>
      </tbw-grid-column>
    </tbw-grid>
  `
})
```

## API Reference

### Exported Types

```typescript
import type { GridCellContext, GridEditorContext } from '@toolbox-web/grid-angular';
```

### AngularGridAdapter

The adapter class is exported for advanced use cases where you need manual control:

```typescript
import { AngularGridAdapter } from '@toolbox-web/grid-angular';
```

However, in most cases, just using the `Grid` directive handles adapter registration automatically.

## Requirements

- Angular 17+ (standalone components)
- `@toolbox-web/grid` >= 0.2.0

## Demo

See the full Angular demo at [`demos/employee-management/angular/`](../../demos/employee-management/angular/) which demonstrates:

- 15+ plugins with full configuration
- Custom editors (star rating, date picker, status select)
- Custom renderers (status badges, rating colors)
- Signal-based reactivity
- Shell integration (header, tool panels)

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
