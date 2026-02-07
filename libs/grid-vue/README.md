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
- ✅ **Composables** - `useGrid` and `useGridEvent` for programmatic access
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
| `undo-redo`             | `undo-redo`             | `undo-redo` (requires editing)                                        |
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

Use the `#cell` slot on `TbwGridColumn` for custom rendering:

```vue
<script setup lang="ts">
import { TbwGrid, TbwGridColumn, type CellSlotProps } from '@toolbox-web/grid-vue';
import StatusBadge from './StatusBadge.vue';
</script>

<template>
  <TbwGrid :rows="employees">
    <TbwGridColumn field="name" header="Name" />
    <TbwGridColumn field="status" header="Status">
      <template #cell="{ value, row }: CellSlotProps<Employee, string>">
        <StatusBadge :status="value" :employee="row" />
      </template>
    </TbwGridColumn>
  </TbwGrid>
</template>
```

### Slot Props

The `#cell` slot receives:

| Prop       | Type     | Description          |
| ---------- | -------- | -------------------- |
| `value`    | `TValue` | Cell value           |
| `row`      | `TRow`   | Row data             |
| `column`   | `object` | Column configuration |
| `rowIndex` | `number` | Row index            |
| `colIndex` | `number` | Column index         |

## Custom Cell Editors

Use the `#editor` slot for inline editing:

```vue
<script setup lang="ts">
import { TbwGrid, TbwGridColumn, type EditorSlotProps } from '@toolbox-web/grid-vue';
import '@toolbox-web/grid-vue/features/editing';
</script>

<template>
  <TbwGrid :rows="employees" editing="dblclick">
    <TbwGridColumn field="status" header="Status" :editable="true">
      <template #editor="{ value, commit, cancel }: EditorSlotProps<Employee, string>">
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

## Composables

### useGrid

Access grid methods programmatically:

```vue
<script setup lang="ts">
import { useGrid } from '@toolbox-web/grid-vue';

const { forceLayout, getConfig, ready, getPlugin } = useGrid();

async function handleResize() {
  await forceLayout();
}

async function logConfig() {
  await ready();
  console.log(getConfig());
}
</script>
```

### useGridEvent

Subscribe to grid events with automatic cleanup:

```vue
<script setup lang="ts">
import { useGridEvent } from '@toolbox-web/grid-vue';

useGridEvent('cell-commit', (event) => {
  console.log('Cell committed:', event.detail);
});

useGridEvent('selection-change', (event) => {
  console.log('Selection:', event.detail.selectedRows);
});
</script>
```

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

    <TbwGridToolPanel id="stats" label="Statistics" v-slot="{ rows }: ToolPanelContext<Employee>">
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

| Composable     | Description              |
| -------------- | ------------------------ |
| `useGrid`      | Access grid methods      |
| `useGridEvent` | Subscribe to grid events |

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
