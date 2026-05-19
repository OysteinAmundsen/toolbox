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
- `libs/grid-react/src/lib/portal-manager.tsx` - PortalManager component for context-preserving cell rendering via React portals; includes microtask batching and rAF prune pass for disconnected containers
- `libs/grid-react/src/lib/portal-bridge.ts` - Grid-scoped bridge connecting non-React adapter code to per-grid PortalManagers; supports multiple DataGrid instances
- `libs/grid-react/src/features/*.ts` - Per-plugin hooks (useGridSelection, useGridFiltering, etc.)
- `libs/grid-vue/src/index.ts` - Vue adapter exports (DataGrid, GridColumn, composables)
- `libs/grid-vue/src/lib/teleport-manager.ts` - TeleportManager component for context-preserving cell rendering via Vue Teleport; includes microtask batching and rAF prune pass for disconnected containers
- `libs/grid-vue/src/lib/teleport-bridge.ts` - Grid-scoped bridge connecting non-Vue adapter code to per-grid TeleportManagers; supports multiple TbwGrid instances
- `libs/grid-vue/src/features/*.ts` - Per-plugin composables (useGridSelection, useGridFiltering, etc.)

## TypeDoc Generation

Adapter API docs are auto-generated via `bun nx typedoc grid-{angular,react,vue}`. Feature subpath entry points (e.g., `features/selection`) are included alongside the main `index.ts` entry point. When adding a new feature:

- Add it to `entryPoints` in the adapter's `typedoc.json`
- The `typedoc-mdx-shared.ts` flattens multi-module output automatically
- Angular inject functions are categorized as "Inject Functions"; React hooks go to "Hooks"; Vue composables go to "Composables"

## Common Pitfalls

### Cross-cutting (apply to all three adapters)

- **Keep adapter proxy signatures in sync with core plugins** — When a core plugin method gains a new parameter (e.g., `options?: { silent?: boolean }`), update the `FilteringMethods`/`*Methods` interface AND the proxy closures in **all three** adapters. Forgetting one adapter silently drops the parameter for that framework's users.
- **New feature entry points must be added to TypeDoc** — Feature functions live in subpath entry points, not the main `index.ts`. If you add a new feature (e.g., `injectGridSorting`), add its file to `typedoc.json` `entryPoints` in all three adapters or it won't appear in the generated API docs.
- **`DataGridElement` built types omit plugin-injected methods** — Methods like `toggleGroup` are declared on the `PublicGrid` interface but not implemented on the `DataGridElement` class directly (they're added by plugins at runtime). When accessing these methods on a raw `DataGridElement` reference (e.g., selector-based discovery), cast through `any`; prefer the typed wrapper (`DataGridRef` in React) when available.
- **Selector support** — All inject functions (Angular), hooks (React), and composables (Vue) accept an optional `selector` parameter for targeting a specific grid in multi-grid components. The selector is resolved differently per framework:
  - **Angular** — always passed to `document.querySelector(selector)` to locate the target `<tbw-grid>`.
  - **React** — used as a `document.querySelector` **fallback** only when the hook cannot resolve the grid through React context (i.e. it is not called inside a `<DataGrid>` subtree).
  - **Vue** — used as a `document.querySelector` **fallback** only when the composable cannot resolve the grid through Vue's `provide`/`inject` chain (i.e. it is not called inside a `<DataGrid>` subtree).
- **Never add new-but-deprecated API** — If a feature-specific hook/composable/inject function already exists (e.g., `useGridSelection`, `useGridExport`), do NOT add deprecated convenience wrappers for the same functionality in the base `useGrid`/`injectGrid` return object. Adding API that is born deprecated violates consumer trust and bloats the surface area.
- **Light DOM, not Shadow DOM** — The grid uses `document.adoptedStyleSheets` for custom styles, NOT Shadow DOM. JSDoc for `registerStyles`/`unregisterStyles`/`customStyles` must reference `document.adoptedStyleSheets`, never "shadow DOM".

### Angular-specific

- **`grid.ready()` resolves before Angular applies `gridConfig`** — The web component's `ready()` promise resolves from `connectedCallback()`'s synchronous render. Angular's Grid directive applies `gridConfig` asynchronously via `effect()` + `queueMicrotask`, which means plugins (filtering, selection, etc.) are attached _after_ `ready()` has already resolved. Inject functions (`injectGridFiltering`, etc.) must check for the plugin's existence after `ready()` and defer `isReady` via `setTimeout(0)` if the plugin isn't found yet. This lets pending microtasks flush before signaling readiness.

### React-specific

- **React adapter uses portals, not createRoot** — The React adapter renders cell content via `createPortal()` through per-grid `PortalManager` components mounted inside each `DataGrid` tree. This preserves the full React context chain (Router, Theme, i18n, Redux, etc.). The `portal-bridge.ts` module maintains a `Map<HTMLElement, PortalManagerHandle>` keyed by grid element, supporting multiple DataGrid instances on the same page. When PortalManager is unavailable, the bridge falls back to `createRoot` (which creates isolated trees without context). Never use `createRoot` directly in new React adapter code — always go through `renderToContainer`/`removeFromContainer` from `portal-bridge.ts`.

### Vue-specific

- **Vue adapter uses Teleport, not createApp** — The Vue adapter renders cell content via `<Teleport>` through per-grid `TeleportManager` components mounted inside each `TbwGrid` tree. This preserves the full Vue context chain (provide/inject, Pinia, Router, global plugins). The `teleport-bridge.ts` module maintains a `Map<HTMLElement, TeleportManagerHandle>` keyed by grid element, supporting multiple TbwGrid instances on the same page. When TeleportManager is unavailable, the bridge falls back to `createApp` (which creates isolated trees without context). Never use `createApp` directly in new Vue adapter code — always go through `renderToContainer`/`removeFromContainer` from `teleport-bridge.ts`.
