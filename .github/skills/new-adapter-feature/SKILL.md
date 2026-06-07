---
name: new-adapter-feature
description: Add a new feature OR backport a bugfix consistently across the Angular, React, and Vue adapter libraries for @toolbox-web/grid. Use whenever you touch one adapter, to confirm the other two need the same change and to keep full parity.
argument-hint: <feature-or-fix-description>
---

# Add a Feature or Fix Across Framework Adapters

When adding a new grid feature **or fixing a bug** in any framework adapter (Angular, React, Vue), follow this guide to keep the three adapters at full parity and consistent in patterns.

## When to Use This Skill

Use this skill whenever you add a feature **or fix a bug** in _any_ adapter. The adapters are one product with three façades, so a change to one is presumed to belong in all three.

> **Parity is the default, not an afterthought.** Before you treat adapter work as done, you MUST investigate whether the same feature/fix is missing in the other two adapters and apply the equivalent change there. Shipping to only one adapter is allowed ONLY when the change is genuinely framework-specific — it touches functionality that exists _solely_ in that framework (e.g. Angular Forms / `ControlValueAccessor`, React-portal context internals, Vue Teleport internals). A bug in shared behaviour (events, config merge, feature-prop bridging, cell cleanup / leaks, type parity) is never framework-specific — fix it in all three.

## Guiding Principles

- **Adapters facilitate, they do not add capabilities.** An adapter exists only to let users pass framework components where the grid expects an `HTMLElement`, plus idiomatic event/config ergonomics. New _grid behaviour_ belongs in core or a plugin, not an adapter.
- **Respect the core ↔ feature boundary.** Like the core grid, core knows nothing about plugins/features. Adapter cores (`*-grid-adapter.ts`, `react-column-config.ts`) must NOT runtime-reference feature behaviour (type-only imports are fine); feature wiring lives in `features/<name>` secondary entries via registered bridges/hooks.
- **Identical API and usage across frameworks.** Differences must be idiomatic (slots vs render props vs directives, `<DataGrid>` vs `<TbwGrid>`), never capability or API-name gaps. Keep DX-only extras minimal and symmetric across all three.

## Architecture Overview

| Library                     | Path                 | Pattern                                   |
| --------------------------- | -------------------- | ----------------------------------------- |
| `@toolbox-web/grid-angular` | `libs/grid-angular/` | Angular directives + `AngularGridAdapter` |
| `@toolbox-web/grid-react`   | `libs/grid-react/`   | React components + `ReactGridAdapter`     |
| `@toolbox-web/grid-vue`     | `libs/grid-vue/`     | Vue composables + `VueGridAdapter`        |

All adapters register a framework-specific `GridAdapter` that handles rendering cells/editors/panels using the framework's template system.

## How to Use This Skill

This skill covers three frameworks. To keep the work tractable, treat each framework section as an **independent sub-task** that you complete end-to-end before starting the next:

1. Complete **Step 1** (core understanding) once — it is shared input for all three adapters.
2. Then for each of Step 2 (Angular), Step 3 (React), and Step 4 (Vue), do the **full sub-task** in order: read the section's _Key Files_, apply the _Pattern_, write _Testing_, and stop. Do **not** interleave changes across adapters — finish one adapter, run its tests, commit mentally, then start the next.
3. Finally, do **Step 5** (parity check), **Step 6** (full test run), and the **Checklist** — these are cross-adapter and run only once.

The ordering between Angular, React, and Vue does not matter; pick whichever is most familiar first. The Checklist at the end is the single source of truth for completion.

## Step 1: Understand the Core Feature (or the Bug)

Before touching adapters, understand the behaviour in the vanilla grid:

- **New feature** — Read the relevant core code in `libs/grid/src/lib/` and identify which renderer/bridge surfaces it touches.
- **Bugfix** — Reproduce the bug in the adapter you were pointed at, then determine whether the root cause is _shared_ (event forwarding, config merge, feature-prop bridging, cell cleanup, type parity) or _genuinely framework-specific_. If shared, the fix belongs in all three adapters; treat the other two as in-scope from the start.

1. Read the relevant core code in `libs/grid/src/lib/`
2. Check if the feature uses any of the items in the table below. **You only need to handle the renderer subtypes the feature actually uses** (e.g. a sorting feature with no custom UI may use no renderers at all; a filter feature may only need a filter renderer). Implement support in each adapter for exactly the subtypes the core feature surfaces — do not add wrappers for renderer kinds the feature does not use.

   | Surface used by core feature     | What each adapter must add                       |
   | -------------------------------- | ------------------------------------------------ |
   | **Custom cell renderer**         | Wrap framework component for the cell body       |
   | **Custom header renderer**       | Wrap framework component for the column header   |
   | **Custom filter renderer**       | Wrap framework component for the filter UI       |
   | **Events**                       | Expose framework-idiomatic event binding         |
   | **Configuration**                | Extend the framework's grid/column config types  |
   | **DOM manipulation / lifecycle** | Add lifecycle management (mount/unmount/cleanup) |

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

## Step 5: Verify Feature / Fix Parity

After implementing across all adapters:

1. **All three handled**: The feature/fix landed in grid-angular, grid-react, AND grid-vue — or you can name the specific framework-only functionality (e.g. Angular Forms) that justifies a single-adapter change
2. **Types align**: Config extensions should have equivalent properties and identical canonical names (no framework prefix)
3. **Behavior matches**: Same user interactions produce same results across frameworks
4. **Boundary respected**: No new feature behaviour leaked into adapter cores (`*-grid-adapter.ts`); feature wiring stays in `features/<name>` secondary entries
5. **Tests cover**: Each adapter has tests for the new feature/fix
6. **Docs updated**: README files and any MDX docs reflect the change
7. **Exports added**: New public types/components exported from barrel files

## Step 6: Run All Tests

```bash
bun run test
```

Ensure all 4 projects pass (grid, grid-angular, grid-react, grid-vue).

## Checklist

- [ ] Core grid feature working in vanilla mode (or root cause of the bug understood)
- [ ] Determined whether the change is shared or genuinely framework-specific
- [ ] Angular adapter updated with directive/template support (or fix applied)
- [ ] React adapter updated with component/hook support (or fix applied)
- [ ] Vue adapter updated with composable/slot support (or fix applied)
- [ ] If a single adapter was skipped, the framework-only justification is documented in the PR
- [ ] No feature behaviour leaked into adapter cores (core ↔ feature boundary respected)
- [ ] Tests added for each adapter
- [ ] Public exports updated in each `index.ts`
- [ ] TypeScript types consistent across adapters (same canonical names, no framework prefix)
- [ ] All tests passing
