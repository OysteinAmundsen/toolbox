---
name: new-adapter-feature
description: Add a new feature consistently across the Angular, React, and Vue adapter libraries for @toolbox-web/grid. Ensures feature parity and consistent patterns.
argument-hint: <feature-description>
---

# Add a Feature Across Framework Adapters

When adding a new grid feature that needs framework adapter support (Angular, React, Vue), follow this guide to ensure consistency and feature parity.

## Architecture Overview

| Library                     | Path                 | Pattern                                   |
| --------------------------- | -------------------- | ----------------------------------------- |
| `@toolbox-web/grid-angular` | `libs/grid-angular/` | Angular directives + `AngularGridAdapter` |
| `@toolbox-web/grid-react`   | `libs/grid-react/`   | React components + `ReactGridAdapter`     |
| `@toolbox-web/grid-vue`     | `libs/grid-vue/`     | Vue composables + `VueGridAdapter`        |

All adapters register a framework-specific `GridAdapter` that handles rendering cells/editors/panels using the framework's template system.

## Step 1: Understand the Core Feature

Before touching adapters, understand how the feature works in the vanilla grid:

1. Read the relevant core code in `libs/grid/src/lib/`
2. Check if the feature uses:
   - **Custom renderers** (cell, header, filter) → Adapters need to wrap framework components
   - **Events** → Adapters need to expose framework-idiomatic event binding
   - **Configuration** → Adapters may extend config types
   - **DOM manipulation** → Adapters might need lifecycle management

## Step 2: Angular Adapter (`libs/grid-angular/`)

### Exported API

- **`Grid`** directive — Auto-registers `AngularGridAdapter` on `<tbw-grid>` elements
- **`TbwRenderer`** — Structural directive (`*tbwRenderer`) for cell renderer templates
- **`TbwEditor`** — Structural directive (`*tbwEditor`) for cell editor templates with auto-wired commit/cancel
- **`GridColumnView`** / **`GridColumnEditor`** — Alternative nested element syntax with `<ng-template>`

### Usage Example

```typescript
import { Component } from '@angular/core';
import { Grid, TbwRenderer, TbwEditor } from '@toolbox-web/grid-angular';

@Component({
  imports: [Grid, TbwRenderer, TbwEditor],
  template: `
    <tbw-grid [rows]="data" [gridConfig]="config">
      <tbw-grid-column field="status">
        <app-status-badge *tbwRenderer="let value; row as row" [value]="value" [row]="row" />
        <app-status-select *tbwEditor="let value" [value]="value" />
      </tbw-grid-column>
    </tbw-grid>
  `
})
export class GridComponent { ... }
```

### Key Files

- `src/lib/grid.directive.ts` — Main `Grid` directive (auto-registers adapter)
- `src/lib/angular-grid-adapter.ts` — Adapter that renders Angular templates
- `src/lib/directives/` — Structural directives (`TbwRenderer`, `TbwEditor`, etc.)
- `src/index.ts` — Public exports

### Pattern

- Use **structural directives** (`*tbwXxx`) for template-driven features
- Use **`@Input()`/`@Output()`** for configuration
- Register new template types in the adapter's `renderCell`/`renderEditor` methods
- Export from `src/index.ts`

### Testing

- Co-located `*.spec.ts` files
- Use `Object.create(Class.prototype)` for testing class methods without DI
- Run: `bun nx test grid-angular`

## Step 3: React Adapter (`libs/grid-react/`)

### Exported API

**Components:** `DataGrid`, `GridColumn`, `GridDetailPanel`, `GridToolPanel`, `GridToolButtons`

**Hooks:** `useGrid` (programmatic access), `useGridEvent` (type-safe event subscription)

**Types:** `ReactGridConfig` (extends `GridConfig` with React renderers), `ReactColumnConfig`

### Usage Example

```tsx
import { DataGrid, type ReactGridConfig } from '@toolbox-web/grid-react';
import { SelectionPlugin } from '@toolbox-web/grid/all';

const config: ReactGridConfig<Employee> = {
  columns: [
    { field: 'name', header: 'Name' },
    {
      field: 'status',
      renderer: (ctx) => <StatusBadge value={ctx.value} />,
      editor: (ctx) => <StatusSelect value={ctx.value} onCommit={ctx.commit} />,
    },
  ],
  plugins: [new SelectionPlugin({ mode: 'row' })],
};

function App() {
  return <DataGrid rows={employees} gridConfig={config} />;
}
```

### Key Files

- `src/lib/DataGrid.tsx` — Main `DataGrid` component
- `src/lib/react-grid-adapter.ts` — Adapter that renders React elements
- `src/lib/GridColumn.tsx` — Declarative column with render props
- `src/lib/hooks/` — `useGrid`, `useGridEvent`
- `src/index.ts` — Public exports

### Pattern

- Use **render props** or **React component types** in config
- Extend `ReactGridConfig` / `ReactColumnConfig` for new renderable slots
- Add hooks for new event subscriptions if needed
- Export from `src/index.ts`

### Testing

- Use `@testing-library/react` with `render()`
- Mock grid element for hook tests
- Run: `bun nx test grid-react`

## Step 4: Vue Adapter (`libs/grid-vue/`)

### Exported API

**Components:** `DataGrid`, `GridColumn`, `GridDetailPanel`, `GridToolPanel`, `GridToolButtons`

**Composables:** `useGrid` (programmatic access), `useGridEvent` (event subscription)

**Types:** `VueGridConfig` (extends `GridConfig` with Vue slot renderers), `VueColumnConfig`

### Usage Example

```vue
<script setup lang="ts">
import { DataGrid, GridColumn } from '@toolbox-web/grid-vue';
import { SelectionPlugin } from '@toolbox-web/grid/all';
import StatusBadge from './StatusBadge.vue';

const config = {
  plugins: [new SelectionPlugin({ mode: 'row' })],
};
</script>

<template>
  <DataGrid :rows="employees" :gridConfig="config">
    <GridColumn field="status" header="Status">
      <template #renderer="{ value, row }">
        <StatusBadge :value="value" :row="row" />
      </template>
    </GridColumn>
  </DataGrid>
</template>
```

### Key Files

- `src/lib/DataGrid.vue` — Main `DataGrid` component
- `src/lib/vue-grid-adapter.ts` — Adapter that renders Vue slots
- `src/lib/composables.ts` — `useGrid`, `useGridEvent`
- `src/lib/registry files` — WeakMap-based registries for panels, cards, etc.
- `src/index.ts` — Public exports

### Pattern

- Use **slots** and **registry pattern** (WeakMap keyed on grid element) for renderables
- Add composables for new grid interactions
- Extend `VueGridConfig` / `VueColumnConfig` for new features
- Export from `src/index.ts`

### Testing

- Use `@vue/test-utils` with `mount()`
- Test composables via `defineComponent` wrappers
- Run: `bun nx test grid-vue`

## Step 5: Verify Feature Parity

After implementing across all adapters:

1. **Types align**: Config extensions should have equivalent properties
2. **Behavior matches**: Same user interactions produce same results
3. **Tests cover**: Each adapter has tests for the new feature
4. **Docs updated**: README files and any MDX docs reflect new feature
5. **Exports added**: New public types/components exported from barrel files

## Step 6: Run All Tests

```bash
bun run test
```

Ensure all 4 projects pass (grid, grid-angular, grid-react, grid-vue).

## Checklist

- [ ] Core grid feature working in vanilla mode
- [ ] Angular adapter updated with directive/template support
- [ ] React adapter updated with component/hook support
- [ ] Vue adapter updated with composable/slot support
- [ ] Tests added for each adapter
- [ ] Public exports updated in each `index.ts`
- [ ] TypeScript types consistent across adapters
- [ ] All tests passing
