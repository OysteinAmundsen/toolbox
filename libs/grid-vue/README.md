# @toolbox-web/grid-vue

[![npm](https://img.shields.io/npm/v/@toolbox-web/grid-vue.svg)](https://www.npmjs.com/package/@toolbox-web/grid-vue)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-❤-ea4aaa?logo=github)](https://github.com/sponsors/OysteinAmundsen)

Vue 3 adapter for `@toolbox-web/grid` data grid component. Provides components and composables for declarative Vue integration with custom cell renderers and editors.

## Features

- ✅ **Full Vue 3 integration** - Use Vue components for cell renderers and editors
- ✅ **Composition API** - Built with `<script setup>` and TypeScript generics
- ✅ **Declarative feature props** - Enable plugins with simple props like `selection="range"`
- ✅ **Tree-shakeable features** - Only import the features you use
- ✅ **Slot-based customization** - `#cell` and `#editor` slots for custom rendering
- ✅ **Type-level defaults** - App-wide renderers/editors via `GridTypeProvider`
- ✅ **Icon configuration** - App-wide icon overrides via `GridProvider` or `GridIconProvider`
- ✅ **Composables** - `useGrid` for programmatic access
- ✅ **Master-detail** - `TbwGridDetailPanel` for expandable rows
- ✅ **Tool panels** - `TbwGridToolPanel` for custom sidebar content
- ✅ **Responsive cards** - `TbwGridResponsiveCard` for mobile layouts
- ✅ **Full type safety** - TypeScript generics support
- ✅ **Vue 3.4+** - Supports `defineModel` and improved generics

## Installation

```bash
# npm
npm install @toolbox-web/grid @toolbox-web/grid-vue

# yarn
yarn add @toolbox-web/grid @toolbox-web/grid-vue

# pnpm
pnpm add @toolbox-web/grid @toolbox-web/grid-vue

# bun
bun add @toolbox-web/grid @toolbox-web/grid-vue
```

## Quick Start

### 1. Register the Grid Component

In your application entry point, import the grid registration:

```typescript
// main.ts
import '@toolbox-web/grid';
```

### 2. Use in Components

```vue
<script setup lang="ts">
import { TbwGrid, TbwGridColumn } from '@toolbox-web/grid-vue';
import { ref } from 'vue';

interface Employee {
  id: number;
  name: string;
  department: string;
  salary: number;
}

const employees = ref<Employee[]>([
  { id: 1, name: 'Alice', department: 'Engineering', salary: 95000 },
  { id: 2, name: 'Bob', department: 'Marketing', salary: 75000 },
  { id: 3, name: 'Charlie', department: 'Sales', salary: 85000 },
]);
</script>

<template>
  <TbwGrid :rows="employees">
    <TbwGridColumn field="id" header="ID" :width="60" />
    <TbwGridColumn field="name" header="Name" :sortable="true" />
    <TbwGridColumn field="department" header="Department" :sortable="true" />
    <TbwGridColumn field="salary" header="Salary" type="number" />
  </TbwGrid>
</template>
```

## TbwGrid Props

| Prop           | Type                                       | Description                                    |
| -------------- | ------------------------------------------ | ---------------------------------------------- |
| `rows`         | `TRow[]`                                   | Row data to display                            |
| `columns`      | `ColumnConfig[]`                           | Column definitions                             |
| `gridConfig`   | `GridConfig`                               | Full configuration object                      |
| `fitMode`      | `'stretch' \| 'fit-columns' \| 'auto-fit'` | Column sizing mode                             |
| `sortable`     | `boolean`                                  | Grid-wide sorting toggle (default: `true`)     |
| `filterable`   | `boolean`                                  | Grid-wide filtering toggle (default: `true`)   |
| `selectable`   | `boolean`                                  | Grid-wide selection toggle (default: `true`)   |
| `loading`      | `boolean`                                  | Show loading overlay (default: `false`)        |
| `customStyles` | `string`                                   | CSS injected via `document.adoptedStyleSheets` |

## Enabling Features

Features are enabled using **declarative props** with **side-effect imports**. This gives you the best of both worlds: clean, intuitive templates and tree-shakeable bundles.

### How It Works

1. **Import the feature** - A side-effect import registers the feature factory
2. **Use the prop** - TbwGrid detects the prop and creates the plugin instance

```vue
<script setup lang="ts">
import { TbwGrid } from '@toolbox-web/grid-vue';

// 1. Import features you need (once, typically in main.ts or the component file)
import '@toolbox-web/grid-vue/features/selection';
import '@toolbox-web/grid-vue/features/multi-sort';
import '@toolbox-web/grid-vue/features/filtering';
</script>

<template>
  <!-- 2. Use declarative props - no manual plugin instantiation! -->
  <TbwGrid :rows="employees" :columns="columns" selection="range" multi-sort filtering />
</template>
```

### Why Side-Effect Imports?

- **Tree-shakeable** - Only the features you import are bundled
- **Synchronous** - No loading states, no HTTP requests, no spinners
- **Type-safe** - Full TypeScript support for feature props
- **Clean templates** - No `plugins: [new SelectionPlugin({ mode: 'range' })]` boilerplate

### Available Features

Import from `@toolbox-web/grid-vue/features/<name>`:

| Feature                 | Prop                    | Example                                                               |
| ----------------------- | ----------------------- | --------------------------------------------------------------------- |
| `selection`             | `selection`             | `selection="range"` or `:selection="{ mode: 'row', checkbox: true }"` |
| `multi-sort`            | `multi-sort`            | `multi-sort` or `:multi-sort="{ maxSortLevels: 3 }"`                  |
| `filtering`             | `filtering`             | `filtering` or `:filtering="{ debounceMs: 200 }"`                     |
| `editing`               | `editing`               | `editing="dblclick"` or `editing="click"`                             |
| `clipboard`             | `clipboard`             | `clipboard` (requires selection)                                      |
| `undoRedo`              | `undoRedo`              | `undoRedo` (requires editing — emits separate `@undo`/`@redo` events) |
| `context-menu`          | `context-menu`          | `context-menu`                                                        |
| `reorder`               | `reorder`               | `reorder` (column drag-to-reorder)                                    |
| `row-reorder`           | `row-reorder`           | `row-reorder` (row drag-to-reorder)                                   |
| `visibility`            | `visibility`            | `visibility` (column visibility panel)                                |
| `pinned-columns`        | `pinned-columns`        | `pinned-columns`                                                      |
| `pinned-rows`           | `pinned-rows`           | `pinned-rows`                                                         |
| `grouping-columns`      | `grouping-columns`      | `grouping-columns`                                                    |
| `grouping-rows`         | `grouping-rows`         | `:grouping-rows="{ groupBy: 'department' }"`                          |
| `tree`                  | `tree`                  | `:tree="{ childrenField: 'children' }"`                               |
| `column-virtualization` | `column-virtualization` | `column-virtualization`                                               |
| `export`                | `export`                | `export`                                                              |
| `print`                 | `print`                 | `print`                                                               |
| `responsive`            | `responsive`            | `responsive` (card layout on mobile)                                  |
| `master-detail`         | `master-detail`         | `master-detail` (use with `<TbwGridDetailPanel>`)                     |
| `pivot`                 | `pivot`                 | `:pivot="{ rowFields: [...], columnFields: [...] }"`                  |
| `server-side`           | `server-side`           | `:server-side="{ ... }"`                                              |

### Import All Features

For prototyping or when bundle size isn't critical, import all features at once:

```typescript
// Import all features (larger bundle)
import '@toolbox-web/grid-vue/features';
```

## Custom Cell Renderers

Use the `#cell` slot on `TbwGridColumn` for custom rendering. Type the column
with your row shape via the generic `<TbwGridColumn<Employee>>` syntax — slot
props (`row`, `value`) then narrow automatically with no per-template
annotation needed:

```vue
<script setup lang="ts">
import { TbwGrid, TbwGridColumn } from '@toolbox-web/grid-vue';
import StatusBadge from './StatusBadge.vue';
interface Employee {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}
</script>

<template>
  <TbwGrid<Employee> :rows="employees">
    <TbwGridColumn<Employee> field="name" header="Name" />
    <TbwGridColumn<Employee> field="status" header="Status">
      <template #cell="{ value, row }">
        <!-- row: Employee, value: any (per-column) -->
        <StatusBadge :status="value" :employee="row" />
      </template>
    </TbwGridColumn>
  </TbwGrid>
</template>
```

If you also know the value type, pass both generics:
`<TbwGridColumn<Employee, string>>` (or annotate the slot prop with
`CellSlotProps<Employee, string>`).

### Slot Props

The `#cell` slot receives:

| Prop       | Type     | Description          |
| ---------- | -------- | -------------------- |
| `value`    | `TValue` | Cell value           |
| `row`      | `TRow`   | Row data             |
| `column`   | `object` | Column configuration |
| `rowIndex` | `number` | Row index            |
| `colIndex` | `number` | Column index         |

> **Generic defaults:** `CellSlotProps<TRow = unknown, TValue = any>` and
> `TbwGridColumn<TRow = unknown, TValue = any>`. Specify `TRow` on the column
> (e.g. `<TbwGridColumn<Employee>>`) and slot props inherit it automatically;
> `TValue` defaults to `any` because the value shape is per-column and awkward
> to narrow inside template expressions.

## Custom Cell Editors

Use the `#editor` slot for inline editing. Same generic-typing pattern as
`#cell`:

```vue
<script setup lang="ts">
import { TbwGrid, TbwGridColumn } from '@toolbox-web/grid-vue';
import '@toolbox-web/grid-vue/features/editing';
</script>

<template>
  <TbwGrid<Employee> :rows="employees" editing="dblclick">
    <TbwGridColumn<Employee> field="status" header="Status" :editable="true">
      <template #editor="{ value, commit, cancel }">
        <!-- value: any, commit: (newValue: any) => void -->
        <select :value="value" @change="(e) => commit((e.target as HTMLSelectElement).value)">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </template>
    </TbwGridColumn>
  </TbwGrid>
</template>
```

### Editor Slot Props

| Prop     | Type                   | Description        |
| -------- | ---------------------- | ------------------ |
| `value`  | `TValue`               | Current cell value |
| `row`    | `TRow`                 | Row data           |
| `commit` | `(value: any) => void` | Save the new value |
| `cancel` | `() => void`           | Cancel editing     |

> **Generic defaults:** `EditorSlotProps<TRow = unknown, TValue = any>` — same
> rationale as `CellSlotProps` above. Specify `TRow` for row-shape safety;
> pass `TValue` when you know the column's value type.

## Events

Handle grid events using Vue's template syntax.

### Template Event Binding

```vue
<script setup lang="ts">
import { TbwGrid } from '@toolbox-web/grid-vue';
import type { CellClickDetail, SortChangeDetail } from '@toolbox-web/grid';

function onCellClick(e: CustomEvent<CellClickDetail>) {
  console.log(`Clicked ${e.detail.field} at row ${e.detail.rowIndex}`);
}

function onSortChange(e: CustomEvent<SortChangeDetail>) {
  console.log(`Sorted by ${e.detail.field} ${e.detail.direction}`);
}
</script>

<template>
  <TbwGrid :rows="rows" @cell-click="onCellClick" @sort-change="onSortChange">
    <TbwGridColumn field="name" header="Name" sortable />
  </TbwGrid>
</template>
```

### Available Events

| Event                  | Detail Type              | Description                       |
| ---------------------- | ------------------------ | --------------------------------- |
| `@cell-click`          | `CellClickDetail`        | Cell was clicked                  |
| `@row-click`           | `RowClickDetail`         | Row was clicked                   |
| `@cell-activate`       | `CellActivateDetail`     | Cell activated (cancelable)       |
| `@cell-change`         | `CellChangeDetail`       | Row updated via API               |
| `@cell-commit`         | `CellCommitDetail`       | Cell value committed (cancelable) |
| `@row-commit`          | `RowCommitDetail`        | Row edit completed (cancelable)   |
| `@changed-rows-reset`  | `ChangedRowsResetDetail` | Changed rows state was reset      |
| `@sort-change`         | `SortChangeDetail`       | Sort state changed                |
| `@filter-change`       | `FilterChangeDetail`     | Filter state changed              |
| `@column-resize`       | `ColumnResizeDetail`     | Column was resized                |
| `@column-move`         | `ColumnMoveDetail`       | Column was reordered              |
| `@column-visibility`   | `ColumnVisibilityDetail` | Column visibility toggled         |
| `@column-state-change` | `GridColumnState`        | Column visibility/order changed   |
| `@selection-change`    | `SelectionChangeDetail`  | Selection state changed           |
| `@row-move`            | `RowMoveDetail`          | Row was reordered                 |
| `@group-toggle`        | `GroupToggleDetail`      | Row group expanded/collapsed      |
| `@tree-expand`         | `TreeExpandDetail`       | Tree node expanded/collapsed      |
| `@detail-expand`       | `DetailExpandDetail`     | Master-detail row toggled         |
| `@responsive-change`   | `ResponsiveChangeDetail` | Responsive layout mode changed    |
| `@copy`                | `CopyDetail`             | Data copied to clipboard          |
| `@paste`               | `PasteDetail`            | Data pasted from clipboard        |
| `@undo`                | `UndoRedoDetail`         | Undo action performed             |
| `@redo`                | `UndoRedoDetail`         | Redo action performed             |
| `@export-complete`     | `ExportCompleteDetail`   | Export operation completed        |
| `@print-start`         | `PrintStartDetail`       | Print operation started           |
| `@print-complete`      | `PrintCompleteDetail`    | Print operation completed         |

## Using Plugins (Advanced)

For full control, pass plugin instances directly via `:grid-config`. Use `markRaw()` to prevent Vue from making plugin instances reactive:

```vue
<script setup lang="ts">
import { markRaw } from 'vue';
import { TbwGrid, TbwGridColumn } from '@toolbox-web/grid-vue';
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
import { FilteringPlugin } from '@toolbox-web/grid/plugins/filtering';

const gridConfig = {
  plugins: markRaw([new SelectionPlugin({ mode: 'range' }), new FilteringPlugin({ debounceMs: 200 })]),
};
</script>

<template>
  <TbwGrid :rows="rows" :grid-config="gridConfig">
    <TbwGridColumn field="name" header="Name" />
  </TbwGrid>
</template>
```

> **Important:** Always wrap plugin arrays with `markRaw()`. Vue's reactivity proxy breaks plugin internal state.

## Composables

### useGrid

Access grid methods and state programmatically:

```vue
<script setup lang="ts">
import { useGrid } from '@toolbox-web/grid-vue';

const {
  isReady,
  config,
  forceLayout,
  getConfig,
  ready,
  getPlugin,
  toggleGroup,
  registerStyles,
  unregisterStyles,
  getVisibleColumns,
} = useGrid();
</script>
```

| Property / Method         | Type                                         | Description                               |
| ------------------------- | -------------------------------------------- | ----------------------------------------- |
| `isReady`                 | `Ref<boolean>`                               | Reactive flag — `true` once grid is ready |
| `config`                  | `Ref<GridConfig \| null>`                    | Reactive effective grid configuration     |
| `gridElement`             | `Ref<DataGridElement \| null>`               | Raw grid element reference                |
| `ready()`                 | `() => Promise<void>`                        | Wait for grid to finish initializing      |
| `forceLayout()`           | `() => Promise<void>`                        | Force layout recalculation                |
| `getConfig()`             | `() => GridConfig \| undefined`              | Get effective configuration snapshot      |
| `getPlugin(pluginClass)`  | `<T>(cls: new (...) => T) => T \| undefined` | Get plugin by class                       |
| `getPluginByName(name)`   | `(name: string) => Plugin \| undefined`      | Get plugin by name                        |
| `toggleGroup(key)`        | `(key: string) => Promise<void>`             | Toggle group expansion                    |
| `registerStyles(id, css)` | `(id: string, css: string) => void`          | Register custom stylesheet                |
| `unregisterStyles(id)`    | `(id: string) => void`                       | Remove custom stylesheet                  |
| `getVisibleColumns()`     | `() => ColumnConfig[]`                       | Get non-hidden columns                    |

## Providers

### GridTypeProvider

Define app-wide type renderers:

```vue
<script setup lang="ts">
import { GridTypeProvider, type TypeDefaultsMap } from '@toolbox-web/grid-vue';
import { h } from 'vue';
import CurrencyCell from './CurrencyCell.vue';

const typeDefaults: TypeDefaultsMap = {
  currency: {
    renderer: (ctx) => h(CurrencyCell, { value: ctx.value }),
  },
  percentage: {
    renderer: (ctx) => h('span', `${(ctx.value * 100).toFixed(1)}%`),
  },
};
</script>

<template>
  <GridTypeProvider :defaults="typeDefaults">
    <App />
  </GridTypeProvider>
</template>
```

Then use in columns:

```vue
<TbwGridColumn field="salary" header="Salary" type="currency" />
```

### GridIconProvider

Override grid icons app-wide:

```vue
<script setup lang="ts">
import { GridIconProvider } from '@toolbox-web/grid-vue';

const icons = {
  sortAsc: '↑',
  sortDesc: '↓',
  expand: '+',
  collapse: '−',
  filter: '🔍',
};
</script>

<template>
  <GridIconProvider :icons="icons">
    <App />
  </GridIconProvider>
</template>
```

### GridProvider

Combined provider for both types and icons:

```vue
<script setup lang="ts">
import { GridProvider } from '@toolbox-web/grid-vue';
</script>

<template>
  <GridProvider :type-defaults="typeDefaults" :icons="icons">
    <App />
  </GridProvider>
</template>
```

## Master-Detail

Expandable row details:

```vue
<script setup lang="ts">
import { TbwGrid, TbwGridDetailPanel, type DetailPanelContext } from '@toolbox-web/grid-vue';
import '@toolbox-web/grid-vue/features/master-detail';
</script>

<template>
  <TbwGrid :rows="employees" master-detail>
    <TbwGridColumn field="name" header="Name" />
    <TbwGridColumn field="department" header="Department" />

    <TbwGridDetailPanel v-slot="{ row }: DetailPanelContext<Employee>">
      <div class="detail-content">
        <h4>{{ row.name }}</h4>
        <p>Department: {{ row.department }}</p>
        <p>Email: {{ row.email }}</p>
      </div>
    </TbwGridDetailPanel>
  </TbwGrid>
</template>
```

## Tool Panels

Custom sidebar panels:

```vue
<script setup lang="ts">
import { TbwGrid, TbwGridToolPanel, type ToolPanelContext } from '@toolbox-web/grid-vue';
</script>

<template>
  <TbwGrid :rows="employees">
    <TbwGridColumn field="name" header="Name" />

    <TbwGridToolPanel id="stats" title="Statistics" v-slot="{ rows }: ToolPanelContext<Employee>">
      <div class="stats-panel">
        <p>Total: {{ rows.length }}</p>
        <p>Avg Salary: {{ averageSalary(rows) }}</p>
      </div>
    </TbwGridToolPanel>
  </TbwGrid>
</template>
```

## Responsive Cards

Mobile-friendly card layout:

```vue
<script setup lang="ts">
import { TbwGrid, TbwGridResponsiveCard, type ResponsiveCardContext } from '@toolbox-web/grid-vue';
import '@toolbox-web/grid-vue/features/responsive';
</script>

<template>
  <TbwGrid :rows="employees" responsive>
    <TbwGridColumn field="name" header="Name" />
    <TbwGridColumn field="department" header="Department" />

    <TbwGridResponsiveCard v-slot="{ row }: ResponsiveCardContext<Employee>">
      <div class="employee-card">
        <h3>{{ row.name }}</h3>
        <p>{{ row.department }}</p>
      </div>
    </TbwGridResponsiveCard>
  </TbwGrid>
</template>
```

## TypeScript Support

Full generic support for row types:

```vue
<script setup lang="ts" generic="T extends Employee">
import { TbwGrid, TbwGridColumn } from '@toolbox-web/grid-vue';

interface Employee {
  id: number;
  name: string;
  salary: number;
}

const props = defineProps<{
  employees: T[];
}>();
</script>

<template>
  <TbwGrid :rows="props.employees">
    <TbwGridColumn field="name" header="Name" />
    <TbwGridColumn field="salary" header="Salary">
      <template #cell="{ value }"> ${{ value.toLocaleString() }} </template>
    </TbwGridColumn>
  </TbwGrid>
</template>
```

## API Reference

### Components

| Component               | Description                   |
| ----------------------- | ----------------------------- |
| `TbwGrid`               | Main grid wrapper component   |
| `TbwGridColumn`         | Declarative column definition |
| `TbwGridDetailPanel`    | Master-detail row content     |
| `TbwGridToolPanel`      | Custom sidebar panel          |
| `TbwGridToolButtons`    | Toolbar button container      |
| `TbwGridResponsiveCard` | Mobile card layout template   |
| `GridTypeProvider`      | App-wide type defaults        |
| `GridIconProvider`      | App-wide icon overrides       |
| `GridProvider`          | Combined type + icon provider |

### Composables

| Composable | Description         |
| ---------- | ------------------- |
| `useGrid`  | Access grid methods |

### Types

| Type                    | Description                          |
| ----------------------- | ------------------------------------ |
| `CellSlotProps`         | Props for `#cell` slot               |
| `EditorSlotProps`       | Props for `#editor` slot             |
| `DetailPanelContext`    | Props for detail panel slot          |
| `ToolPanelContext`      | Props for tool panel slot            |
| `ResponsiveCardContext` | Props for responsive card slot       |
| `GridConfig`            | Grid configuration type (primary)    |
| `ColumnConfig`          | Column configuration type (primary)  |
| `CellRenderer`          | Cell renderer type (primary)         |
| `CellEditor`            | Cell editor type (primary)           |
| `TypeDefault`           | Type default configuration (primary) |
| `TypeDefaultsMap`       | Type defaults registry type          |
| `VueGridConfig`         | Deprecated - use `GridConfig`        |
| `VueColumnConfig`       | Deprecated - use `ColumnConfig`      |
| `VueCellRenderer`       | Deprecated - use `CellRenderer`      |
| `VueCellEditor`         | Deprecated - use `CellEditor`        |
| `VueTypeDefault`        | Deprecated - use `TypeDefault`       |

## Requirements

- **Vue 3.4+** (uses `defineModel` and improved generics)
- **@toolbox-web/grid** (peer dependency)

## Demo

See the [Vue demo app](../../demos/employee-management/vue/) for a full-featured example using `@toolbox-web/grid-vue`.

```bash
bun nx serve demo-vue
```

## Building

```bash
bun nx build grid-vue
```

## Running Tests

```bash
bun nx test grid-vue
```

## License

MIT © [Øystein Amundsen](https://github.com/OysteinAmundsen)
