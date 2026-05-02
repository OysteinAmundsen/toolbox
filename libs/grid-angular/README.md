# @toolbox-web/grid-angular

[![npm](https://img.shields.io/npm/v/@toolbox-web/grid-angular.svg)](https://www.npmjs.com/package/@toolbox-web/grid-angular)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-❤-ea4aaa?logo=github)](https://github.com/sponsors/OysteinAmundsen)

Angular adapter for `@toolbox-web/grid` data grid component. Provides directives for declarative template-driven cell renderers and editors.

## Features

- ✅ **Auto-adapter registration** - Just import `Grid` directive
- ✅ **Structural directives** - Clean `*tbwRenderer` and `*tbwEditor` syntax
- ✅ **Template-driven renderers** - Use `<ng-template>` for custom cell views
- ✅ **Template-driven editors** - Use `<ng-template>` for custom cell editors
- ✅ **Component-class column config** - Specify component classes directly in `gridConfig.columns`
- ✅ **Type-level defaults** - App-wide renderers/editors via `provideGridTypeDefaults()`
- ✅ **Icon configuration** - App-wide icon overrides via `provideGridIcons()`
- ✅ **Reactive Forms integration** - Use `formControlName` and `formControl` bindings
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
import { Component } from '@angular/core';
import { Grid } from '@toolbox-web/grid-angular';

@Component({
  selector: 'app-my-grid',
  imports: [Grid],
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

## Enabling Features

`<tbw-grid>` supports three patterns for turning on plugins. Pick whichever fits the
component — they can be mixed.

| Pattern                                                   | Best for                                                                         | v2 status                                                                              |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `gridConfig.features` (object literal)                    | Configuration-driven apps that prefer a single setup object                      | ✅ Unchanged — fully supported                                                         |
| **Per-feature directive** (e.g. `GridFilteringDirective`) | Template-driven apps that want signal inputs/outputs **and** the smallest bundle | ✅ **Recommended** — the future-proof path                                             |
| Inputs/outputs on `Grid` (e.g. `[filtering]`)             | v1.x apps already on this style                                                  | ⚠️ **Deprecated** — bindings remain for v1.x compatibility but will be removed in v2.0 |

> Apps that only use `gridConfig` are **not affected** by the v2 cleanup — only consumers
> binding feature inputs directly on `<tbw-grid>` need to add the matching per-feature
> directive to their component's `imports` before v2.

### Recommended: Per-Feature Directives

Each feature ships its own attribute-selector directive (`GridFilteringDirective`,
`GridSelectionDirective`, …) from its secondary entry. Add the directive to the
component's `imports` and bind exactly the same `[input]` / `(output)` you used before:

```typescript
import { Component } from '@angular/core';
import { Grid } from '@toolbox-web/grid-angular';
import { GridFilteringDirective } from '@toolbox-web/grid-angular/features/filtering';
import { GridSelectionDirective } from '@toolbox-web/grid-angular/features/selection';
import { GridMultiSortDirective } from '@toolbox-web/grid-angular/features/multi-sort';

@Component({
  imports: [Grid, GridFilteringDirective, GridSelectionDirective, GridMultiSortDirective],
  template: `
    <tbw-grid
      [rows]="rows"
      [columns]="columns"
      [selection]="'range'"
      [multiSort]="true"
      [filtering]="true"
      style="height: 400px; display: block;">
    </tbw-grid>
  `,
})
```

**Why this is the preferred path:**

- **Tree-shakeable typed surface** — the feature's `input()` / `output()` definitions ship
  inside the feature's own bundle. Apps that don't import the directive don't pay for its
  compiled metadata in the core grid-angular bundle.
- **Compile-time safety** — Angular errors with `Can't bind to 'filtering' since it isn't
a known property of 'tbw-grid'` if you forget the directive (stronger than React/Vue,
  which silently drop unknown props, and stronger than the runtime guard on the WC core).
- **Same bindings, same demos** — the directive's selector matches the existing
  attributes (`tbw-grid[filtering], tbw-grid[filterChange]`), so migrating from the
  legacy style is a one-line `imports` addition per feature with **zero template
  changes**.

### Legacy: Inputs/Outputs on `Grid` (deprecated)

The v1.x style — declaring `[filtering]`, `(filterChange)`, etc. directly on the
`Grid` directive without importing a per-feature directive — still works for the entire
v1.x line and is mediated by a per-element claims registry so the two styles can coexist
on the same grid without duplicate plugins or double-emitted events. The bindings are
marked `@deprecated` in JSDoc; v2.0 will remove them, at which point a one-line directive
import per feature is the migration.

### How the side-effect import works

1. **Import the feature** — A side-effect import registers the feature factory with the
   core grid (`@toolbox-web/grid/features/<name>`).
2. **Bind the input** — The per-feature directive (or, in legacy code, the input on
   `Grid`) instantiates the plugin with the input value.

```typescript
// 1. Side-effect import — required for either pattern
import '@toolbox-web/grid-angular/features/selection';
import '@toolbox-web/grid-angular/features/multi-sort';
import '@toolbox-web/grid-angular/features/filtering';

// 2a. Recommended — per-feature directives in `imports`
import { GridSelectionDirective } from '@toolbox-web/grid-angular/features/selection';
import { GridMultiSortDirective } from '@toolbox-web/grid-angular/features/multi-sort';
import { GridFilteringDirective } from '@toolbox-web/grid-angular/features/filtering';

@Component({
  imports: [Grid, GridSelectionDirective, GridMultiSortDirective, GridFilteringDirective],
  template: `
    <tbw-grid
      [rows]="rows"
      [selection]="'range'"
      [multiSort]="true"
      [filtering]="true"
      style="height: 400px; display: block;">
    </tbw-grid>
  `,
})

// 2b. Legacy / deprecated — same bindings on Grid alone (works in v1.x)
@Component({
  imports: [Grid],
  template: `
    <tbw-grid
      [rows]="rows"
      [selection]="'range'"
      [multiSort]="true"
      [filtering]="true"
      style="height: 400px; display: block;">
    </tbw-grid>
  `,
})
```

### Why Side-Effect Imports?

- **Tree-shakeable** — Only the features you import are bundled
- **Synchronous** — No loading states, no HTTP requests, no spinners
- **Type-safe** — Full TypeScript support for feature inputs
- **Clean templates** — No `plugins: [new SelectionPlugin({ mode: 'range' })]` boilerplate

### Available Features

Import the **directive** from `@toolbox-web/grid-angular/features/<name>` and add it
alongside `Grid` in your component's `imports` (recommended). The same `[input]` /
`(output)` bindings on the `Grid` directive itself are still accepted in v1.x but are
`@deprecated`.

| Per-Feature Directive (recommended)                                                                                         | Input                             | Example                                                                    |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------- |
| [`GridSelectionDirective`](https://toolboxjs.com/grid/angular/api/directives/GridSelectionDirective/)                       | `[selection]`                     | `[selection]="'range'"` or `[selection]="{ mode: 'row', checkbox: true }"` |
| [`GridMultiSortDirective`](https://toolboxjs.com/grid/angular/api/directives/GridMultiSortDirective/)                       | `[multiSort]`                     | `[multiSort]="true"` or `[multiSort]="{ maxSortLevels: 3 }"`               |
| [`GridFilteringDirective`](https://toolboxjs.com/grid/angular/api/directives/GridFilteringDirective/)                       | `[filtering]`                     | `[filtering]="true"` or `[filtering]="{ debounceMs: 200 }"`                |
| [`GridEditingDirective`](https://toolboxjs.com/grid/angular/api/directives/GridEditingDirective/)                           | `[editing]`                       | `[editing]="true"` or `[editing]="'dblclick'"`                             |
| [`GridClipboardDirective`](https://toolboxjs.com/grid/angular/api/directives/GridClipboardDirective/)                       | `[clipboard]`                     | `[clipboard]="true"` (requires selection)                                  |
| [`GridUndoRedoDirective`](https://toolboxjs.com/grid/angular/api/directives/GridUndoRedoDirective/)                         | `[undoRedo]`                      | `[undoRedo]="true"` (requires editing)                                     |
| [`GridContextMenuDirective`](https://toolboxjs.com/grid/angular/api/directives/GridContextMenuDirective/)                   | `[contextMenu]`                   | `[contextMenu]="true"`                                                     |
| [`GridReorderColumnsDirective`](https://toolboxjs.com/grid/angular/api/directives/GridReorderColumnsDirective/)             | `[reorderColumns]`                | `[reorderColumns]="true"`                                                  |
| [`GridRowDragDropDirective`](https://toolboxjs.com/grid/angular/api/directives/GridRowDragDropDirective/)                   | `[rowDragDrop]` / `[reorderRows]` | `[rowDragDrop]="true"` (within and across grids)                           |
| [`GridVisibilityDirective`](https://toolboxjs.com/grid/angular/api/directives/GridVisibilityDirective/)                     | `[visibility]`                    | `[visibility]="true"` (column visibility panel)                            |
| [`GridPinnedColumnsDirective`](https://toolboxjs.com/grid/angular/api/directives/GridPinnedColumnsDirective/)               | `[pinnedColumns]`                 | `[pinnedColumns]="true"`                                                   |
| [`GridPinnedRowsDirective`](https://toolboxjs.com/grid/angular/api/directives/GridPinnedRowsDirective/)                     | `[pinnedRows]`                    | `[pinnedRows]="true"`                                                      |
| [`GridGroupingColumnsDirective`](https://toolboxjs.com/grid/angular/api/directives/GridGroupingColumnsDirective/)           | `[groupingColumns]`               | `[groupingColumns]="true"`                                                 |
| [`GridGroupingRowsDirective`](https://toolboxjs.com/grid/angular/api/directives/GridGroupingRowsDirective/)                 | `[groupingRows]`                  | `[groupingRows]="{ groupBy: 'department' }"`                               |
| [`GridTreeDirective`](https://toolboxjs.com/grid/angular/api/directives/GridTreeDirective/)                                 | `[tree]`                          | `[tree]="{ childrenField: 'children' }"`                                   |
| [`GridColumnVirtualizationDirective`](https://toolboxjs.com/grid/angular/api/directives/GridColumnVirtualizationDirective/) | `[columnVirtualization]`          | `[columnVirtualization]="true"`                                            |
| [`GridExportDirective`](https://toolboxjs.com/grid/angular/api/directives/GridExportDirective/)                             | `[export]`                        | `[export]="true"`                                                          |
| [`GridPrintDirective`](https://toolboxjs.com/grid/angular/api/directives/GridPrintDirective/)                               | `[print]`                         | `[print]="true"`                                                           |
| [`GridResponsiveDirective`](https://toolboxjs.com/grid/angular/api/directives/GridResponsiveDirective/)                     | `[responsive]`                    | `[responsive]="true"` (card layout on mobile)                              |
| [`GridMasterDetailDirective`](https://toolboxjs.com/grid/angular/api/directives/GridMasterDetailDirective/)                 | `[masterDetail]`                  | `[masterDetail]="true"` (use with `<tbw-grid-detail>`)                     |
| [`GridTooltipDirective`](https://toolboxjs.com/grid/angular/api/directives/GridTooltipDirective/)                           | `[tooltip]`                       | `[tooltip]="true"`                                                         |
| [`GridPivotDirective`](https://toolboxjs.com/grid/angular/api/directives/GridPivotDirective/)                               | `[pivot]`                         | `[pivot]="{ rowFields: [...], columnFields: [...] }"`                      |
| [`GridServerSideDirective`](https://toolboxjs.com/grid/angular/api/directives/GridServerSideDirective/)                     | `[serverSide]`                    | `[serverSide]="{ ... }"`                                                   |

### Import All Features

For prototyping or when bundle size isn't critical, import all features at once:

```typescript
// Import all features (larger bundle)
import '@toolbox-web/grid-angular/features';
```

### Full Example

```typescript
import '@toolbox-web/grid-angular/features/selection';
import '@toolbox-web/grid-angular/features/editing';
import '@toolbox-web/grid-angular/features/filtering';
import '@toolbox-web/grid-angular/features/multi-sort';
import '@toolbox-web/grid-angular/features/clipboard';

import { Component } from '@angular/core';
import { Grid } from '@toolbox-web/grid-angular';
import type { ColumnConfig } from '@toolbox-web/grid';

interface Employee {
  id: number;
  name: string;
  department: string;
  salary: number;
}

@Component({
  imports: [Grid],
  template: `
    <tbw-grid
      [rows]="employees"
      [columns]="columns"
      [selection]="'range'"
      [sorting]="'multi'"
      [editing]="'dblclick'"
      [filtering]="true"
      [clipboard]="true"
      style="height: 400px; display: block;"
    >
    </tbw-grid>
  `,
})
export class EmployeeGridComponent {
  employees: Employee[] = [
    { id: 1, name: 'Alice', department: 'Engineering', salary: 95000 },
    { id: 2, name: 'Bob', department: 'Marketing', salary: 75000 },
  ];

  columns: ColumnConfig<Employee>[] = [
    { field: 'id', header: 'ID', width: 60 },
    { field: 'name', header: 'Name', editable: true },
    { field: 'department', header: 'Department', editable: true },
    { field: 'salary', header: 'Salary', type: 'number' },
  ];
}
```

## Structural Directives (Recommended)

The cleanest way to define custom renderers and editors is with structural directives. These provide a concise syntax without the boilerplate of nested `<ng-template>` elements.

### TbwRenderer

Use `*tbwRenderer` to customize how cell values are displayed:

```typescript
import { Component } from '@angular/core';
import { Grid, TbwRenderer } from '@toolbox-web/grid-angular';

@Component({
  imports: [Grid, TbwRenderer, StatusBadgeComponent],
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
import { Component, output } from '@angular/core';
import { Grid, TbwRenderer } from '@toolbox-web/grid-angular';
import { TbwEditor } from '@toolbox-web/grid-angular/features/editing';

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

| Variable    | Type              | Description                                            |
| ----------- | ----------------- | ------------------------------------------------------ |
| `$implicit` | `TValue`          | The cell value (use with `let-value`)                  |
| `row`       | `TRow`            | The full row data object                               |
| `column`    | `unknown`         | The column configuration                               |
| `onCommit`  | `Function`        | Callback to commit (optional with auto-wire)           |
| `onCancel`  | `Function`        | Callback to cancel (optional with auto-wire)           |
| `control`   | `AbstractControl` | FormControl for cell (when using FormArray+FormGroups) |

> **Auto-wiring:** If your editor component emits a `commit` event with the new value, the adapter automatically calls the grid's commit function. Similarly for `cancel`. This means you can skip the explicit `onCommit`/`onCancel` bindings!

## Nested Directive Syntax (Alternative)

For more explicit control, you can use the nested directive syntax with `<ng-template>`:

### GridColumnView

```typescript
import { Grid, GridColumnView } from '@toolbox-web/grid-angular';

@Component({
  imports: [Grid, GridColumnView],
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
import { Grid, GridColumnView } from '@toolbox-web/grid-angular';
import { GridColumnEditor } from '@toolbox-web/grid-angular/features/editing';

@Component({
  imports: [Grid, GridColumnView, GridColumnEditor],
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
import { Grid } from '@toolbox-web/grid-angular';
import { GridDetailView } from '@toolbox-web/grid-angular/features/master-detail';
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

## Type-Level Defaults

Define app-wide renderers and editors for custom column types using `provideGridTypeDefaults()`:

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideGridTypeDefaults } from '@toolbox-web/grid-angular';
import { CountryBadgeComponent, CountryEditorComponent, CurrencyCellComponent } from './components';

export const appConfig: ApplicationConfig = {
  providers: [
    provideGridTypeDefaults({
      country: {
        renderer: CountryBadgeComponent,
        editor: CountryEditorComponent,
      },
      currency: {
        renderer: CurrencyCellComponent,
      },
    }),
  ],
};
```

Then any grid with columns using `type: 'country'` will automatically use the registered components:

```typescript
// my-grid.component.ts
import { Component } from '@angular/core';
import { Grid } from '@toolbox-web/grid-angular';
import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';
import type { GridConfig } from '@toolbox-web/grid';

@Component({
  imports: [Grid],
  template: `<tbw-grid [rows]="data" [gridConfig]="config" />`,
})
export class MyGridComponent {
  config: GridConfig = {
    columns: [
      { field: 'name', header: 'Name' },
      { field: 'country', type: 'country', editable: true }, // Uses registered components
      { field: 'salary', type: 'currency' },
    ],
    plugins: [new EditingPlugin()],
  };
}
```

**Services:**

| Service              | Description                                 |
| -------------------- | ------------------------------------------- |
| `GridTypeRegistry`   | Injectable service for dynamic registration |
| `GRID_TYPE_DEFAULTS` | Injection token for type defaults           |

## App-Wide Icon Configuration

Customize grid icons at the application level using `provideGridIcons()`:

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideGridIcons } from '@toolbox-web/grid-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideGridIcons({
      expand: '➕',
      collapse: '➖',
      sortAsc: '↑',
      sortDesc: '↓',
      filter: '<svg viewBox="0 0 16 16">...</svg>',
    }),
  ],
};
```

**Dynamic Icon Registration:**

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { GridIconRegistry } from '@toolbox-web/grid-angular';

@Component({ ... })
export class AppComponent implements OnInit {
  private iconRegistry = inject(GridIconRegistry);

  ngOnInit() {
    // Dynamically set icons
    this.iconRegistry.set('expand', '▶');
    this.iconRegistry.set('collapse', '▼');
  }
}
```

**Available Icons:**

| Icon           | Default | Description                          |
| -------------- | ------- | ------------------------------------ |
| `expand`       | `▶`     | Expand icon for trees/groups/details |
| `collapse`     | `▼`     | Collapse icon                        |
| `sortAsc`      | `▲`     | Sort ascending indicator             |
| `sortDesc`     | `▼`     | Sort descending indicator            |
| `sortNone`     | `⇅`     | Unsorted indicator                   |
| `filter`       | SVG     | Filter icon in headers               |
| `filterActive` | SVG     | Filter icon when active              |
| `submenuArrow` | `▶`     | Context menu submenu arrow           |
| `dragHandle`   | `⋮⋮`    | Drag handle for reordering           |
| `toolPanel`    | `☰`    | Tool panel toggle icon               |
| `print`        | `🖨️`    | Print button icon                    |

**Precedence (highest wins):**

1. `gridConfig.icons` - Per-grid overrides
2. `provideGridIcons()` - App-level defaults
3. Built-in defaults

## Component-Class Column Config

For maximum flexibility and type safety, you can specify Angular component classes directly in your `gridConfig.columns`. This approach gives you full control over the component lifecycle while keeping your grid configuration clean and concise.

### Component Interfaces

Your components should implement one of these interfaces:

**Renderer components:**

```typescript
import { Component, input } from '@angular/core';
import type { CellRenderer, ColumnConfig } from '@toolbox-web/grid-angular';

@Component({
  selector: 'app-status-badge',
  template: `<span [class]="'badge badge--' + value()">{{ value() }}</span>`,
  standalone: true,
})
export class StatusBadgeComponent implements CellRenderer<Employee, string> {
  value = input.required<string>();
  row = input.required<Employee>();
  column = input<ColumnConfig>(); // Optional
}
```

**Editor components:**

```typescript
import { Component, input, output } from '@angular/core';
import type { CellEditor, ColumnConfig } from '@toolbox-web/grid-angular';

@Component({
  selector: 'app-bonus-editor',
  template: `
    <input type="range" [min]="0" [max]="maxBonus()" [value]="value()" (input)="onInput($event)" />
    <button (click)="cancel.emit()">Cancel</button>
  `,
  standalone: true,
})
export class BonusEditorComponent implements CellEditor<Employee, number> {
  value = input.required<number>();
  row = input.required<Employee>();
  column = input<ColumnConfig>(); // Optional

  commit = output<number>();
  cancel = output<void>();

  // Computed property using row data
  maxBonus = computed(() => this.row().salary * 0.5);

  onInput(event: Event) {
    const newValue = Number((event.target as HTMLInputElement).value);
    this.commit.emit(newValue);
  }
}
```

### Using Components in Grid Config

Use `GridConfig` with the `gridConfig` input for type-safe component references:

```typescript
import { Component } from '@angular/core';
import { Grid, type GridConfig } from '@toolbox-web/grid-angular';
import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';
import { StatusBadgeComponent, BonusEditorComponent } from './components';

@Component({
  imports: [Grid],
  template: `<tbw-grid [gridConfig]="config" [rows]="employees" />`,
})
export class MyGridComponent {
  config: GridConfig<Employee> = {
    columns: [
      { field: 'name', header: 'Name' },
      { field: 'status', header: 'Status', renderer: StatusBadgeComponent },
      { field: 'bonus', header: 'Bonus', editable: true, editor: BonusEditorComponent },
    ],
    plugins: [new EditingPlugin()],
  };
}
```

The `gridConfig` input accepts `GridConfig` (Angular-augmented) which allows both component classes and vanilla JS functions. When component classes are detected, the directive automatically converts them to grid-compatible renderer functions.

### Interfaces Reference

| Interface      | Required Inputs    | Required Outputs   | Description        |
| -------------- | ------------------ | ------------------ | ------------------ |
| `CellRenderer` | `value()`, `row()` | -                  | Read-only renderer |
| `CellEditor`   | `value()`, `row()` | `commit`, `cancel` | Editable cell      |

Both interfaces also support an optional `column()` input for accessing the column configuration.

## Using Plugins (Advanced)

For full control (e.g., custom plugin subclasses or mixed feature+plugin setups), you can bypass feature props and import plugins directly:

```typescript
import { Component } from '@angular/core';
import { Grid } from '@toolbox-web/grid-angular';
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
import { FilteringPlugin } from '@toolbox-web/grid/plugins/filtering';

@Component({
  imports: [Grid],
  template: `<tbw-grid [rows]="rows" [gridConfig]="config" />`,
})
export class MyGridComponent {
  config = {
    columns: [...],
    plugins: [
      new SelectionPlugin({ mode: 'row' }),
      new FilteringPlugin({ debounceMs: 200 }),
    ],
  };
}
```

> **Tip:** Prefer feature props (see [Enabling Features](#enabling-features) above) for simpler code and tree-shaking.

Or import all plugins at once (larger bundle, but convenient):

```typescript
import { SelectionPlugin, FilteringPlugin } from '@toolbox-web/grid/all';
```

## Reactive Forms Integration

The grid can be used as an Angular form control with `formControlName` or `formControl` bindings. This enables seamless integration with Angular's Reactive Forms system.

### Basic Usage with FormControl

```typescript
import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Grid } from '@toolbox-web/grid-angular';
import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';
import type { GridConfig } from '@toolbox-web/grid';
import { GridFormArray } from '@toolbox-web/grid-angular/features/editing';

interface Employee {
  name: string;
  age: number;
}

@Component({
  imports: [Grid, GridFormArray, ReactiveFormsModule],
  template: `
    <tbw-grid [formControl]="employeesControl" [gridConfig]="config" style="height: 400px; display: block;" />

    <div>
      <p>Form value: {{ employeesControl.value | json }}</p>
      <p>Dirty: {{ employeesControl.dirty }}</p>
      <p>Touched: {{ employeesControl.touched }}</p>
    </div>
  `,
})
export class MyComponent {
  employeesControl = new FormControl<Employee[]>([
    { name: 'Alice', age: 30 },
    { name: 'Bob', age: 25 },
  ]);

  config: GridConfig<Employee> = {
    columns: [
      { field: 'name', header: 'Name', editable: true },
      { field: 'age', header: 'Age', editable: true, type: 'number' },
    ],
    plugins: [new EditingPlugin({ editOn: 'dblclick' })],
  };
}
```

### Usage with FormGroup

```typescript
import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Grid } from '@toolbox-web/grid-angular';
import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';
import { GridFormArray } from '@toolbox-web/grid-angular/features/editing';

@Component({
  imports: [Grid, GridFormArray, ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <tbw-grid formControlName="employees" [gridConfig]="config" style="height: 400px; display: block;" />
    </form>
  `,
})
export class MyComponent {
  form = new FormGroup({
    employees: new FormControl([
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ]),
  });

  config = {
    columns: [
      { field: 'name', header: 'Name', editable: true },
      { field: 'age', header: 'Age', editable: true },
    ],
    plugins: [new EditingPlugin()],
  };
}
```

### How It Works

- **Form → Grid**: When the form value changes (e.g., via `setValue()` or `patchValue()`), the grid rows are updated
- **Grid → Form**: When a cell is edited and committed, the form value is updated with the new row data
- **Touched state**: The form becomes touched when the user clicks on the grid
- **Dirty state**: The form becomes dirty when any cell is edited
- **Disabled state**: When the form control is disabled, the grid adds a `.form-disabled` CSS class

### Validation

You can add validators to validate the entire grid data:

```typescript
import { Validators } from '@angular/forms';

employeesControl = new FormControl<Employee[]>([], [
  Validators.required, // At least one row
  Validators.minLength(2), // At least 2 rows
  this.validateEmployees, // Custom validator
]);

validateEmployees(control: FormControl<Employee[]>) {
  const employees = control.value || [];
  const hasInvalidAge = employees.some((e) => e.age < 18);
  return hasInvalidAge ? { invalidAge: true } : null;
}
```

### CSS Classes

Angular's form system automatically adds these classes to the grid element:

- `.ng-valid` / `.ng-invalid` - Validation state
- `.ng-pristine` / `.ng-dirty` - Edit state
- `.ng-untouched` / `.ng-touched` - Touch state

Additionally, when the control is disabled:

- `.form-disabled` - Added by `GridFormArray`

You can style these states:

```css
tbw-grid.ng-invalid.ng-touched {
  border: 2px solid red;
}

tbw-grid.form-disabled {
  opacity: 0.6;
  pointer-events: none;
}
```

### Advanced: Cell-Level FormControls with FormArray

For fine-grained control over validation and form state at the cell level, use a `FormArray` of `FormGroup`s. This approach exposes the `FormControl` for each cell in the editor context, allowing custom editors to bind directly:

```typescript
import { Component, input, output } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Grid, TbwRenderer } from '@toolbox-web/grid-angular';
import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';
import { GridFormArray, TbwEditor } from '@toolbox-web/grid-angular/features/editing';

// Custom editor that uses the FormControl directly
@Component({
  selector: 'app-validated-input',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    @if (control()) {
      <input [formControl]="control()" [class.is-invalid]="control()!.invalid && control()!.touched" />
      @if (control()!.invalid && control()!.touched) {
        <small class="error">{{ getErrorMessage() }}</small>
      }
    }
  `,
  styles: `
    .is-invalid {
      border-color: red;
    }
    .error {
      color: red;
      font-size: 0.8em;
    }
  `,
})
export class ValidatedInputComponent {
  control = input<AbstractControl>();
  commit = output<string>();

  getErrorMessage(): string {
    const ctrl = this.control();
    if (ctrl?.hasError('required')) return 'Required';
    if (ctrl?.hasError('min')) return 'Too low';
    return 'Invalid';
  }
}

@Component({
  imports: [Grid, GridFormArray, TbwRenderer, TbwEditor, ReactiveFormsModule, ValidatedInputComponent],
  template: `
    <tbw-grid [formControl]="employeesArray" [gridConfig]="config">
      <tbw-grid-column field="age" editable>
        <span *tbwRenderer="let value">{{ value }}</span>
        <!-- The 'control' property gives you the FormControl for this cell -->
        <app-validated-input *tbwEditor="let value; control as ctrl" [control]="ctrl" />
      </tbw-grid-column>
    </tbw-grid>
  `,
})
export class MyComponent {
  // Use FormArray with FormGroups for cell-level control access
  employeesArray = new FormArray([
    new FormGroup({
      name: new FormControl('Alice', Validators.required),
      age: new FormControl(30, [Validators.required, Validators.min(18)]),
    }),
    new FormGroup({
      name: new FormControl('Bob', Validators.required),
      age: new FormControl(25, [Validators.required, Validators.min(18)]),
    }),
  ]);

  config = {
    columns: [
      { field: 'name', header: 'Name', editable: true },
      { field: 'age', header: 'Age', editable: true },
    ],
    plugins: [new EditingPlugin()],
  };
}
```

**Editor Context with FormControl:**

| Variable   | Type              | Description                                                        |
| ---------- | ----------------- | ------------------------------------------------------------------ |
| `value`    | `TValue`          | The cell value                                                     |
| `row`      | `TRow`            | The full row data                                                  |
| `control`  | `AbstractControl` | The FormControl for this cell (if using FormArray with FormGroups) |
| `onCommit` | `Function`        | Callback to commit the value                                       |
| `onCancel` | `Function`        | Callback to cancel editing                                         |

> **Note:** The `control` property is only available when:
>
> - The grid is bound to a `FormArray` (not a `FormControl<T[]>`)
> - The `FormArray` contains `FormGroup` controls (not raw `FormControl`s)
> - The `FormGroup` has a control for the column's field name

### Row-Level Validation

When using `FormArray` with `FormGroup`s, you can also access row-level validation state through the `FormArrayContext`. This is useful for styling entire rows based on their validation state or displaying row-level error summaries.

```typescript
import { type FormArrayContext, getFormArrayContext } from '@toolbox-web/grid-angular/features/editing';

// Get the context from a grid element
const context = getFormArrayContext(gridElement);

if (context?.hasFormGroups) {
  // Check if row 0 is valid
  const isValid = context.isRowValid(0); // true if all controls in row are valid

  // Check if row has been touched
  const isTouched = context.isRowTouched(0); // true if any control touched

  // Check if row is dirty
  const isDirty = context.isRowDirty(0); // true if any control changed

  // Get all errors for a row
  const errors = context.getRowErrors(0);
  // Returns: { name: { required: true }, age: { min: { min: 18, actual: 15 } } }
  // Or null if no errors

  // Get the FormGroup for a row (for advanced use cases)
  const formGroup = context.getRowFormGroup(0);
}
```

**FormArrayContext Row Validation Methods:**

| Method                 | Return Type                       | Description                                  |
| ---------------------- | --------------------------------- | -------------------------------------------- |
| `isRowValid(idx)`      | `boolean`                         | True if all controls in row are valid        |
| `isRowTouched(idx)`    | `boolean`                         | True if any control in row is touched        |
| `isRowDirty(idx)`      | `boolean`                         | True if any control in row is dirty          |
| `getRowErrors(idx)`    | `Record<string, unknown> \| null` | Aggregated errors from all controls, or null |
| `getRowFormGroup(idx)` | `FormGroup \| undefined`          | The FormGroup for the row                    |

## Base Classes for Custom Editors & Filters

The adapter provides base classes that eliminate boilerplate when building custom editors and filter panels.

| Base Class          | Extends          | Purpose                                                                                               |
| ------------------- | ---------------- | ----------------------------------------------------------------------------------------------------- |
| `BaseGridEditor`    | —                | Common inputs (`value`, `row`, `column`, `control`), outputs (`commit`, `cancel`), validation helpers |
| `BaseGridEditorCVA` | `BaseGridEditor` | Adds `ControlValueAccessor` for dual grid + standalone form use                                       |
| `BaseOverlayEditor` | `BaseGridEditor` | Floating overlay panel with CSS Anchor Positioning, focus gating, click-outside detection             |
| `BaseFilterPanel`   | —                | Ready-made `params` input for `FilteringPlugin`, with `applyAndClose()` / `clearAndClose()` helpers   |

### BaseOverlayEditor Example

```typescript
import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { BaseOverlayEditor } from '@toolbox-web/grid-angular/features/editing';

@Component({
  selector: 'app-date-editor',
  template: `
    <input
      #inlineInput
      readonly
      [value]="currentValue()"
      (click)="onInlineClick()"
      (keydown)="onInlineKeydown($event)"
    />
    <div #panel class="tbw-overlay-panel" style="width: 280px; padding: 12px;">
      <input type="date" [value]="currentValue()" (change)="selectAndClose($event.target.value)" />
      <button (click)="hideOverlay()">Cancel</button>
    </div>
  `,
})
export class DateEditorComponent extends BaseOverlayEditor<MyRow, string> implements AfterViewInit {
  @ViewChild('panel') panelRef!: ElementRef<HTMLElement>;
  @ViewChild('inlineInput') inputRef!: ElementRef<HTMLInputElement>;

  protected override overlayPosition = 'below' as const;

  ngAfterViewInit(): void {
    this.initOverlay(this.panelRef.nativeElement);
    if (this.isCellFocused()) this.showOverlay();
  }

  protected getInlineInput() {
    return this.inputRef?.nativeElement ?? null;
  }
  protected onOverlayOutsideClick() {
    this.hideOverlay();
  }

  selectAndClose(date: string): void {
    this.commitValue(date);
    this.hideOverlay();
  }
}
```

### BaseFilterPanel Example

```typescript
import { Component, ViewChild, ElementRef } from '@angular/core';
import { BaseFilterPanel } from '@toolbox-web/grid-angular/features/filtering';

@Component({
  selector: 'app-text-filter',
  template: `
    <input #input (keydown.enter)="applyAndClose()" />
    <button (click)="applyAndClose()">Apply</button>
    <button (click)="clearAndClose()">Clear</button>
  `,
})
export class TextFilterComponent extends BaseFilterPanel {
  @ViewChild('input') input!: ElementRef<HTMLInputElement>;

  applyFilter(): void {
    this.params().applyTextFilter('contains', this.input.nativeElement.value);
  }
}
```

> See the [full Base Classes documentation](https://toolboxjs.com/?path=/docs/grid-angular-base-classes--docs) for detailed API tables, all overlay positions, and CVA usage.

## API Reference

### Exported Directives

| Directive          | Selector                                             | Description                            |
| ------------------ | ---------------------------------------------------- | -------------------------------------- |
| `Grid`             | `tbw-grid`                                           | Main directive, auto-registers adapter |
| `GridFormArray`    | `tbw-grid[formControlName]`, `tbw-grid[formControl]` | Reactive Forms integration             |
| `TbwRenderer`      | `*tbwRenderer`                                       | Structural directive for cell views    |
| `TbwEditor`        | `*tbwEditor`                                         | Structural directive for cell editors  |
| `GridColumnView`   | `tbw-grid-column-view`                               | Nested directive for cell views        |
| `GridColumnEditor` | `tbw-grid-column-editor`                             | Nested directive for cell editors      |
| `GridDetailView`   | `tbw-grid-detail`                                    | Master-detail panel template           |
| `GridToolPanel`    | `tbw-grid-tool-panel`                                | Custom sidebar panel                   |

### Base Classes

| Class                             | Description                                                          |
| --------------------------------- | -------------------------------------------------------------------- |
| `BaseGridEditor<TRow, TValue>`    | Base class for inline cell editors with validation helpers           |
| `BaseGridEditorCVA<TRow, TValue>` | `BaseGridEditor` + `ControlValueAccessor` for dual grid/form editors |
| `BaseOverlayEditor<TRow, TValue>` | `BaseGridEditor` + floating overlay panel infrastructure             |
| `BaseFilterPanel`                 | Base class for custom filter panels with `params` input              |

### Type Registry

| Export                      | Description                                  |
| --------------------------- | -------------------------------------------- |
| `provideGridTypeDefaults()` | Provider factory for app-level type defaults |
| `GridTypeRegistry`          | Injectable service for dynamic registration  |
| `GRID_TYPE_DEFAULTS`        | Injection token for type defaults            |

### Icon Registry

| Export               | Description                                      |
| -------------------- | ------------------------------------------------ |
| `provideGridIcons()` | Provider factory for app-level icon overrides    |
| `GridIconRegistry`   | Injectable service for dynamic icon registration |
| `GRID_ICONS`         | Injection token for icon overrides               |

### Grid Directive Inputs

| Input           | Type               | Description                                       |
| --------------- | ------------------ | ------------------------------------------------- |
| `gridConfig`    | `GridConfig<TRow>` | Grid config with optional component class support |
| `angularConfig` | `GridConfig<TRow>` | **Deprecated** - use `gridConfig` instead         |
| `customStyles`  | `string`           | Custom CSS styles to inject into the grid         |

### Grid Directive Outputs

| Output              | Type                                       | Description                  |
| ------------------- | ------------------------------------------ | ---------------------------- |
| `cellCommit`        | `OutputEmitterRef<CellCommitEvent>`        | Cell value committed         |
| `rowCommit`         | `OutputEmitterRef<RowCommitEvent>`         | Row edit committed           |
| `sortChange`        | `OutputEmitterRef<SortChangeDetail>`       | Sort state changed           |
| `columnResize`      | `OutputEmitterRef<ColumnResizeDetail>`     | Column resized               |
| `cellClick`         | `OutputEmitterRef<CellClickDetail>`        | Cell clicked                 |
| `rowClick`          | `OutputEmitterRef<RowClickDetail>`         | Row clicked                  |
| `cellActivate`      | `OutputEmitterRef<CellActivateDetail>`     | Cell focus changed           |
| `cellChange`        | `OutputEmitterRef<CellChangeDetail>`       | Cell value changed           |
| `changedRowsReset`  | `OutputEmitterRef<ChangedRowsResetDetail>` | Changed rows cache cleared   |
| `filterChange`      | `OutputEmitterRef<FilterChangeDetail>`     | Filter state changed         |
| `columnMove`        | `OutputEmitterRef<ColumnMoveDetail>`       | Column moved                 |
| `columnVisibility`  | `OutputEmitterRef<ColumnVisibilityDetail>` | Column visibility changed    |
| `columnStateChange` | `OutputEmitterRef<GridColumnState>`        | Column state changed         |
| `selectionChange`   | `OutputEmitterRef<SelectionChangeDetail>`  | Selection changed            |
| `rowMove`           | `OutputEmitterRef<RowMoveDetail>`          | Row moved (drag & drop)      |
| `groupToggle`       | `OutputEmitterRef<GroupToggleDetail>`      | Group expanded/collapsed     |
| `treeExpand`        | `OutputEmitterRef<TreeExpandDetail>`       | Tree node expanded/collapsed |
| `detailExpand`      | `OutputEmitterRef<DetailExpandDetail>`     | Detail panel toggled         |
| `responsiveChange`  | `OutputEmitterRef<ResponsiveChangeDetail>` | Responsive mode changed      |
| `copy`              | `OutputEmitterRef<CopyDetail>`             | Data copied to clipboard     |
| `paste`             | `OutputEmitterRef<PasteDetail>`            | Data pasted from clipboard   |

### GridDetailView Inputs

| Input              | Type                         | Default   | Description                         |
| ------------------ | ---------------------------- | --------- | ----------------------------------- |
| `showExpandColumn` | `boolean`                    | `true`    | Show expand/collapse chevron column |
| `animation`        | `'slide' \| 'fade' \| false` | `'slide'` | Animation style for expand/collapse |

### GridToolPanel Inputs

| Input     | Type     | Default  | Description                       |
| --------- | -------- | -------- | --------------------------------- |
| `id`      | `string` | Required | Unique panel identifier           |
| `title`   | `string` | Required | Panel title in accordion header   |
| `icon`    | `string` | -        | Icon for the accordion header     |
| `tooltip` | `string` | -        | Tooltip text for header           |
| `order`   | `number` | `100`    | Panel sort order (lower = higher) |

### Exported Types

```typescript
import type {
  // Template contexts
  GridCellContext,
  GridToolPanelContext,
  StructuralCellContext,
  // Events
  CellCommitEvent,
  RowCommitEvent,
  // Primary config exports - use these
  GridConfig,
  ColumnConfig,
  CellRenderer,
  CellEditor,
  TypeDefault,
  // Deprecated aliases
  AngularGridConfig,
  AngularColumnConfig,
  AngularCellRenderer,
  AngularCellEditor,
  AngularTypeDefault,
} from '@toolbox-web/grid-angular';

// Reactive Forms types live with the editing feature
import type { FormArrayContext, OverlayPosition } from '@toolbox-web/grid-angular/features/editing';

// Type guard for component class detection
import { isComponentClass } from '@toolbox-web/grid-angular';

// Base classes for custom editors and filter panels
import {
  BaseGridEditor,
  BaseGridEditorCVA,
  BaseOverlayEditor,
  getFormArrayContext,
  type GridEditorContext,
  type StructuralEditorContext,
} from '@toolbox-web/grid-angular/features/editing';
import { type GridDetailContext } from '@toolbox-web/grid-angular/features/master-detail';
import { BaseFilterPanel } from '@toolbox-web/grid-angular/features/filtering';
```

### AngularGridAdapter

The adapter class is exported for advanced use cases:

```typescript
import { AngularGridAdapter } from '@toolbox-web/grid-angular';
```

In most cases, the `Grid` directive handles adapter registration automatically.

## Demo

See the full Angular demo at [`demos/employee-management/angular/`](../../demos/employee-management/angular/) which demonstrates:

- 15+ plugins with full configuration
- Custom editors (star rating, date picker, status select, bonus slider)
- Custom renderers (status badges, rating colors, top performer stars)
- Structural directives with auto-wiring
- Signal-based reactivity
- Shell integration (header, tool panels)
- Master-detail expandable rows

## Requirements

- Angular 17+ (standalone components)
- `@toolbox-web/grid` >= 0.2.0

## Development

```bash
# Build the library
bun nx build grid-angular

# Run tests
bun nx test grid-angular

# Lint
bun nx lint grid-angular
```

---

## Support This Project

This grid is built and maintained by a single developer in spare time. If it saves you time or money, consider sponsoring to keep development going:

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor_on_GitHub-ea4aaa?style=for-the-badge&logo=github)](https://github.com/sponsors/OysteinAmundsen)
[![Patreon](https://img.shields.io/badge/Support_on_Patreon-f96854?style=for-the-badge&logo=patreon)](https://www.patreon.com/c/OysteinAmundsen)

---

## License

MIT
