---
applyTo: '{libs/grid-angular,libs/grid-react,libs/grid-vue}/**'
---

# Framework Adapters (Angular, React, Vue)

Each adapter auto-registers a framework-specific `GridAdapter` on `<tbw-grid>` elements. See the `new-adapter-feature` skill for full API details, usage examples, and key files for each adapter.

- **Angular** (`@toolbox-web/grid-angular`) — Directives: `Grid`, `TbwRenderer`, `TbwEditor`; Base classes: `BaseGridEditor`, `BaseGridEditorCVA`, `BaseOverlayEditor`, `BaseFilterPanel`
- **React** (`@toolbox-web/grid-react`) — Components: `DataGrid`, `GridColumn`; Hooks: `useGrid`, `useGridEvent`
- **Vue** (`@toolbox-web/grid-vue`) — Components: `DataGrid`, `GridColumn`; Composables: `useGrid`, `useGridEvent`

## Key Files

- `libs/grid-angular/src/index.ts` - Angular adapter exports (Grid, TbwRenderer, TbwEditor directives, base classes)
- `libs/grid-angular/features/*/src/index.ts` - Per-plugin inject functions (injectGridSelection, injectGridFiltering, etc.)
- `libs/grid-angular/src/lib/base-overlay-editor.ts` - BaseOverlayEditor (floating overlay panel for custom editors)
- `libs/grid-angular/src/lib/base-grid-editor-cva.ts` - BaseGridEditorCVA (dual grid/form ControlValueAccessor)
- `libs/grid-angular/src/lib/base-filter-panel.ts` - BaseFilterPanel (custom filter panel base class)
- `libs/grid-react/src/index.ts` - React adapter exports (DataGrid, GridColumn, hooks)
- `libs/grid-react/src/features/*.ts` - Per-plugin hooks (useGridSelection, useGridFiltering, etc.)
- `libs/grid-vue/src/index.ts` - Vue adapter exports (DataGrid, GridColumn, composables)
- `libs/grid-vue/src/features/*.ts` - Per-plugin composables (useGridSelection, useGridFiltering, etc.)

## TypeDoc Generation

Adapter API docs are auto-generated via `bun nx typedoc grid-{angular,react,vue}`. Feature subpath entry points (e.g., `features/selection`) are included alongside the main `index.ts` entry point. When adding a new feature:

- Add it to `entryPoints` in the adapter's `typedoc.json`
- The `typedoc-mdx-shared.ts` flattens multi-module output automatically
- Angular inject functions are categorized as "Inject Functions"; React hooks go to "Hooks"; Vue composables go to "Composables"

## Common Pitfalls

- **Keep adapter proxy signatures in sync with core plugins** — When a core plugin method gains a new parameter (e.g., `options?: { silent?: boolean }`), update the `FilteringMethods`/`*Methods` interface AND the proxy closures in **all three** adapters. Forgetting one adapter silently drops the parameter for that framework's users.
- **New feature entry points must be added to TypeDoc** — Feature functions live in subpath entry points, not the main `index.ts`. If you add a new feature (e.g., `injectGridSorting`), add its file to `typedoc.json` `entryPoints` in all three adapters or it won't appear in the generated API docs.
- **`DataGridElement` built types omit plugin-injected methods** — Methods like `toggleGroup` are declared on the `PublicGrid` interface but not implemented on the `DataGridElement` class directly (they're added by plugins at runtime). When accessing these methods on a raw `DataGridElement` reference (e.g., selector-based discovery), cast through `any`; prefer the typed wrapper (`DataGridRef` in React) when available.
- **Selector support** — All inject functions (Angular), hooks (React), and composables (Vue) accept an optional `selector` parameter for targeting a specific grid in multi-grid components. Angular uses it in `querySelector`; React/Vue use it as DOM query fallback when the normal context/injection mechanism can't reach the target grid.
- **`grid.ready()` resolves before Angular applies `gridConfig`** — The web component's `ready()` promise resolves from `connectedCallback()`'s synchronous render. Angular's Grid directive applies `gridConfig` asynchronously via `effect()` + `queueMicrotask`, which means plugins (filtering, selection, etc.) are attached _after_ `ready()` has already resolved. Inject functions (`injectGridFiltering`, etc.) must check for the plugin's existence after `ready()` and defer `isReady` via `setTimeout(0)` if the plugin isn't found yet. This lets pending microtasks flush before signaling readiness.
