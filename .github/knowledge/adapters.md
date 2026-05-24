---
domain: adapters
related: [adapters-react, adapters-vue, adapters-angular, grid-core, grid-features]
---

# Framework Adapters — Shared Mental Model

> Per-framework specifics live in [adapters-react.md](adapters-react.md), [adapters-vue.md](adapters-vue.md), [adapters-angular.md](adapters-angular.md).
>
> **DECIDED entries are facts + one-line WHY. History (what we tried, in what order) belongs in git log, not here.** When updating: condense, do not append.

## shared-architecture

- PATTERN: global singleton adapter registered at module load (React/Vue) or DI setup (Angular)
- FLOW: adapter registered → grid parses light DOM → user sets columns with framework components → `processConfig()` wraps components in bridge fns → grid calls renderer → bridge mounts component into cell container
- INVARIANT: adapter MUST be registered before grid parses light DOM
- INVARIANT: one adapter per app (singleton)
- INTERFACE (all implement): `processConfig`, `createComponentRenderer`, `createComponentEditor`, `releaseCell`, plus 10 methods listed in `CORE_CONSUMED_ADAPTER_METHODS` (see adapter-conformance)
- DECIDED (#330): `FrameworkAdapter.beginBatch?()` / `endBatch?()` defer per-cell teardown across bulk `releaseCell` loops (`_clearRowPool`, `renderVisibleRows` pool-shrink, `renderInlineRow` pre-wipe). Calls nest — outermost `endBatch` flushes. Listed in `CORE_CONSUMED_ADAPTER_METHODS`. Vue/Angular implement as no-ops (already batched).
- DECIDED (#338 / #340 reverted): adapter Context / `InjectionKey` / `InjectionToken` are plain module constants — MUST NOT be routed through `globalThis`. Rationale in [grid-core.md](grid-core.md) § shared-store. Micro-frontend `customElements.define` collision belongs to #339.

## adapter-conformance

- OWNS: `CORE_CONSUMED_ADAPTER_METHODS` in `libs/grid/src/lib/core/adapter-conformance.ts`, re-exported from `public.ts`
- INVARIANT: every adapter ships `<framework>-grid-adapter.conformance.spec.ts` that fails when any listed method is missing on instance (React/Vue) or prototype (Angular — ctor needs DI)
- INVARIANT: when core adds a hook it depends on, append to `CORE_CONSUMED_ADAPTER_METHODS` so all adapter conformance specs go red
- DECIDED: only the constant is exported from `public.ts`; helper fns stay internal. WHY: exporting them pushed `index.js` over budget. Each spec inlines a 2-line filter; DRY isn't worth the bytes.

## adapter-feature-purity (May 2026)

- DECIDED: adapter cores (`{react,vue,angular}-grid-adapter.ts`, `react-column-config.ts`) MUST NOT runtime-reference feature behaviour (type-only imports OK). Runtime wiring lives in `features/<name>.ts` (React/Vue) or `features/<name>/src/` (Angular) secondary entries via registered bridges/hooks. Mirrors WC plugin discipline.

## shell-content-wrappers (#352)

- OWNS: React `Grid{Header,Toolbar}Content`, Vue `TbwGrid{Header,Toolbar}Content`, Angular `Grid{Header,Toolbar}Content` directives — wrap `registerHeaderContent`/`registerToolbarContent` (specs co-located). Vue uses built-in `<Teleport>` (slot child of `<TbwGrid>`); Angular uses `host.closest('tbw-grid')` (NOT `injectGrid()` — descendants).
- INVARIANT: render-callback cleanup is a **no-op** AND `register*` MUST `await grid.ready?.()` then guard unmount-during-await (React `unmounted` / Vue `cancelled` / Angular `destroyed`).
- INVARIANT (Angular extra): render MUST be idempotent (`createEmbeddedView` is not — skip when `viewRef.rootNodes[0]` still inside container, else destroy stale viewRef first). WHY: grid reuses SAME container by id across shell refreshes (`shell.ts` cleans → re-renders same node); real teardown destroys child state; await without flag leaks registration.

## bridge-registries (append-only, populated by side-effect imports)

| Registry                                                                | Module                                                                                   | Installed by                                                                              | Purpose                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registerEditorMountHook` / `notifyEditorMounted`                       | `editor-mount-hooks.ts` (each adapter)                                                   | `features/editing`                                                                        | `before-edit-close` → native `.blur()` on focused input                                                                                                                                                                   |
| `registerFilterPanelTypeDefaultBridge`                                  | each adapter                                                                             | `features/filtering`                                                                      | wraps user `filterPanelRenderer` in framework render path                                                                                                                                                                 |
| `registerDetailRendererBridge` / `registerResponsiveCardRendererBridge` | `react-grid-adapter.ts` / `vue-grid-adapter.ts` / `angular: internal/feature-bridges.ts` | `features/master-detail` / `features/responsive`                                          | turns user template/component into renderer fn; adapter method becomes thin delegate                                                                                                                                      |
| `registerPostMountRefresh(name, fn)` / `notifyPostMount`                | `post-mount-refresh-hooks.ts` (each adapter)                                             | `features/master-detail`, `features/responsive` (React/Vue)                               | feature-keyed kick fired after framework children commit so plugins created pre-children pick up renderers; Angular registry is parity-only / currently unused (`ngAfterContentInit` covers the equivalent wiring)        |
| `registerChildFeatureDetector(name, fn)` / `detectChildFeatures`        | `child-feature-detector.ts` (React + Vue)                                                | `data-grid.tsx` pre-registers built-ins at module load; third-party features may add more | scans React children / Vue slot VNodes by component `displayName` / `__name`, returns partial `FeatureProps` to auto-enable plugins. Angular skipped — per-feature attribute-selector directives already cover this idiom |
| `registerFeatureConfigPreprocessor(name, fn)` (Angular)                 | `internal/feature-extensions.ts`                                                         | `features/grouping-columns`, `grouping-rows`, `pinned-rows`                               | bridges Angular component classes embedded in feature config                                                                                                                                                              |
| `registerTemplateBridge` (Angular)                                      | `internal/feature-extensions.ts`                                                         | `features/master-detail`, `responsive`                                                    | wires `<tbw-grid-detail>`/`<tbw-grid-responsive-card>` templates in `ngAfterContentInit`                                                                                                                                  |

- INVARIANT: features import from the adapter's primary entry (registry hooks + types); adapter primary entry MUST NOT import from feature secondary entries (build cycle).
- INVARIANT: spec files exercising bridge behaviour MUST add side-effect imports of `'../features/<name>'` at the top, mirroring real consumers. Otherwise the bridge is null and methods return `undefined`.
- DECIDED: `createToolPanelRenderer` stays on adapter (CORE primitive — `shell.ts` parses `<tbw-grid-tool-panel>` and calls it). `createEditor`/`createRenderer` stay on adapter (per-cell primitives, not editing-feature-specific). `createFilterPanelRenderer` stays inline (generic node-to-container wrap; only filter-feature dep is type-only).
- DECIDED (#354): adapter `pinned-rows` slot-renderer wrappers MUST cache the host element per renderer across calls. WHY: `PinnedRowsPlugin.renderPanelSlot` (`libs/grid/src/lib/plugins/pinned-rows/pinned-rows.ts` L432-510) reference-checks renderer outputs in `rowOutputsCache` (WeakMap) to skip row rebuild; fresh host each call triggers React/Vue unmount-remount and Angular re-create. Pattern: React/Vue closure-cache `{host, portalKey}` → `renderToContainer(host, node, key)` for in-place update + `PinnedRowsPluginWithCleanup` subclass overrides `detach()` to `removeFromContainer`; Angular closure-caches `{hostElement, componentRef}` → `setInput(name, value) + detectChanges()`, relies on adapter `componentRefs[]` destroyed at `dispose()`. Specs: `libs/grid-{react,vue}/src/features/pinned-rows.spec.{tsx,ts}` (`expect(second).toBe(first)` + detach), `libs/grid-angular/features/pinned-rows/src/cached-panel-renderer.spec.ts` (pure helper, extracted from `index.ts` to avoid DI mocking).
- DECIDED (#353): feature configs that carry renderer callbacks expose adapter-typed wrappers so consumers can return framework-native nodes. Pattern: `Omit<CoreConfig, 'rendererProp'> & { rendererProp?: CoreConfig['rendererProp'] | FrameworkReturn }`. React: `ReactGroupingColumnsConfig`, `ReactGroupingRowsConfig`, `ReactColumnGroupDefinition` (`ReactNode`). Vue: parallel `Vue…Config` / `VueColumnGroupDefinition` (`VNode`). Angular: `Angular…Config` widens to `| Type<unknown>` (directive `input<…>()` accepts the union). Runtime bridging is already done by `createNodeBridge` (React/Vue) and `registerFeatureConfigPreprocessor` + `mountComponentRenderer` (Angular). Specs: `libs/grid-{react,vue}/src/features/grouping-{columns,rows}.spec.{tsx,ts}` assert `userConfig.<renderer>` is wrapped to an `HTMLElement`-returning function; Angular runtime path covered in `angular-grid-adapter.spec.ts`. INVARIANT: spec assertions read `plugin.userConfig`, NOT `plugin.config` — `config` is only populated post-`attach()` (see `base-plugin.ts` line 597).

## adapter-event-props (drift-safety pattern, cross-cutting)

- OWNS (React): `EventProps<TRow>` + `EVENT_PROP_MAP` in `libs/grid-react/src/lib/event-props.ts`. Guard: `} as const satisfies Readonly<Record<keyof EventProps, keyof DataGridEventMap<unknown>>>;` (bidirectional).
- OWNS (Angular): `output<T>()` + `eventOutputMap` in `directives/grid.directive.ts`. Guard: `} as const satisfies Readonly<Record<string, keyof DataGridEventMap<unknown>>>;` (value-side only). Forward-only complement: `_assertEventOutputMapCoversCore` Exclude-extends-never type. Widen `_intentionallyOmittedEvents` to consciously skip.
- INVARIANT: NEVER widen `satisfies` to silence a complaint. The complaint is the feature: either drop the prop OR add the missing `declare module '../../core/types'` augmentation.
- INVARIANT: when satisfies rejects an event, check emit sites (`grep '_emit(' / 'event-name'`) — plugins emit + registry can diverge silently.
- INVARIANT: adding a `DataGridEventMap` entry wires all three: React `EVENT_PROP_MAP` + `EventProps`, Vue `EVENT_MAP` + `defineEmits`, Angular `eventOutputMap` + `output<T>()`. Vue has NO drift guard yet.
- INVARIANT: missing core public exports surface as Angular build failure (not Vue/React). Angular `@toolbox-web/grid/all` deep-import only sees `libs/grid/src/public.ts` — new event detail types must be re-exported there.
- DECIDED: `EventProps` is flat (one entry per event, even paired `onUndo`/`onRedo`). Tried `onUndoRedo` — bound to non-emitted `'undo-redo'`.
- DECIDED: hand-maintained interface + `satisfies` (not mapped type — TypeDoc renders as `unknown`).
- TENSION (Angular): `eventOutputMap` keys not statically tied to `output<T>()` fields. Forgotten entry = silent runtime bug.

## event-handling — `before-edit-close` blur bridge

- DECIDED: editor `before-edit-close` → native `.blur()` on focused input/textarea/select. WHY: Tab + programmatic row exits rebuild cell DOM synchronously; `onBlur={commit}` / `@blur="commit"` / `(blur)="commit()"` would lose pending input. Native `.blur()` (NOT synthetic `FocusEvent`) — React 17+ delegates focus via bubbling `focusout`. Angular parallel: `BaseGridEditor.onBeforeEditClose()`.
- DECIDED (#249): bridge wires BOTH slot/JSX `createEditor` path AND config-path wrappers: React `wrapReactEditor`; Vue `createConfigVNodeEditor`/`createConfigComponentEditor`/`createTypeEditor`; Angular `createComponentEditor` + template `createEditor`. Tab from last cell → `#exitRowEdit(currentRow,false)` → `beginBulkEdit(nextRow)` synchronously — focused input never blurs naturally. Grid resolved lazily via `queueMicrotask`.
- CLEANUP: React threads `unsub` through `mountedPortals` (`cleanupConfigRootsIn`); Vue/Angular store in `editorMountTeardowns` Map (container/host-keyed), swept in `releaseCell` + `destroy()`.
- DECIDED (Tier 1): install moved out of adapter into `editor-mount-hooks.ts` notifier. `attachBeforeEditCloseFlush` → `runEditorMountHooks`. `features/editing` registers.
- TESTS: `react-column-config.spec.ts > flushes the focused input on before-edit-close`; `vue-grid-adapter.spec.ts > flushes the focused input on before-edit-close for config-based VNode editor`; `angular-grid-adapter.spec.ts > before-edit-close blur bridge`.

## event-handling — `releaseCell` DOM-recycle invariant (#250)

- DECIDED: core MUST call `grid.__frameworkAdapter?.releaseCell?.(cell)` BEFORE any sync wipe (`innerHTML=''` / `replaceChildren()`) of a cell that may contain adapter-managed renderer DOM. Without it framework's tree references orphans and next commit throws `NotFoundError: removeChild`.
- COVERED PATHS: `editor-injection.ts` (open editor); `renderVisibleRows` pool-shrink (`core/internal/rows.ts`); `_clearRowPool` (`grid.ts`). All guarded by `cell.firstElementChild`.
- KNOWN WEAKNESSES: `GroupingRowsPlugin.ts` and `pinned-rows.ts` have `rowEl.innerHTML=''` paths that do NOT call `releaseCell` first (rely on PortalBoundary / equivalent).
- TESTS: `rows.spec.ts > releases cells when pool shrinks`; per-adapter spec coverage in `adapters-react.md` / `adapters-vue.md` / `adapters-angular.md`.

## feature-prop-bridging

- All adapters expose feature props that auto-load plugins. React: `<DataGrid selection="range" editing="dblclick" />`. Vue: `<TbwGrid :selection="'range'" :editing="'dblclick'" />`. Angular: `<tbw-grid [selection]="'range'" [editing]="'dblclick'">`.
- MECHANISM: feature props → `createPluginsFromFeatures()` → factory creates plugins → added to `gridConfig.plugins`.
- DECIDED (gh #356 phase 1): React/Vue `FeatureName = Exclude<keyof FeatureConfig, '__brand'>` (derived from core's augmentable interface — third-party features auto-join; `__brand` sentinel filtered out). Angular keeps a hand-listed union: ng-packagr partial compilation cannot see `@toolbox-web/grid/features/*` augmentations because the Angular adapter does not side-effect-import them (React/Vue do, via `src/features/*.ts` per-feature helpers). Strict-additive enforced by `feature-registry.spec.ts` in all three adapters. See [adapters-angular.md](adapters-angular.md) for the deferred fix.
- DECIDED (gh #356 phase 2): per-feature `registerPostMountRefresh(name, fn)` registry replaces hard-coded plugin refresh calls in `data-grid.tsx` / `TbwGrid.vue`. WHY: shell can't grow per-feature knowledge for every future "refresh after children commit" need. Map-keyed (re-register replaces — HMR-friendly). React/Vue migrated; Angular registry parity-only (no callers; `ngAfterContentInit` covers it). Tests: `post-mount-refresh-hooks.spec.ts` in each adapter.
- DECIDED (gh #356 phase 3): `registerChildFeatureDetector(displayName, fn)` registry replaces the inline `displayName === 'GridDetailPanel' | 'GridResponsiveCard'` scan in `data-grid.tsx`. Built-in detectors are PRE-REGISTERED at `data-grid.tsx` module load (NOT via feature side-effect imports) — preserves existing behaviour for users who render `<GridDetailPanel>` without importing `features/master-detail` (gh #356 §7 #4: no changed default behaviour). Third-party features add their own via the registry. Vue ships the same registry surface for API parity but `<TbwGrid>` does not yet invoke it (deferred to v3 `:features=` decoupling, #262). Angular skipped — per-feature attribute-selector directives are already the idiomatic auto-enable path. Tests: `child-feature-detector.spec.ts` in React + Vue.

## three-way-parity (May 2026 audit)

- DECIDED: React/Vue/Angular aligned — 26 feature props, 28 grid events, hooks/composables, providers, tree-shake registration, bridges, registries.
- DECIDED (#289): cell/editor context generics use asymmetric defaults `TRow = unknown`, `TValue = any` (Vue `CellSlotProps`/`EditorSlotProps`/`GridCellContext`/`GridEditorContext`; React `GridCellContext`/`GridEditorContext`). WHY: `unknown` for row safety, `any` for `TValue` unblocks single-generic `CellSlotProps<MyRow>` (narrowing awkward in templates). Tests: `slot-types.spec.ts`, `context-types.spec.ts`.
- INVARIANT: public export added to one adapter → mirror in same PR. `index.ts` = canonical surface.
- INVARIANT: `AllFeatureProps<TRow>` shape identical React/Vue. If `SSRProps` truly removed, drop atomically.
- TENSION: idiomatic differences are NOT parity gaps (`<DataGrid>` vs `<TbwGrid>`, render props vs slots, `GridElementContext` vs `GRID_ELEMENT_KEY`, `PortalManager` vs `TeleportManager`).
- HISTORICAL GAPS (now closed): Vue/Angular were missing `cellCancel`, `editOpen`, `beforeEditClose`, `editClose`, `dirtyChange`, `dataChange`, `columnResizeReset`, `groupExpand`, `groupCollapse`, `contextMenuOpen`. Vue's `'undo-redo'` was latent bug — split into `'undo'`/`'redo'`. Angular gained `column-shorthand.ts` mirror, `cardRowHeight` on `GridResponsiveCard`, `getPlugin<T>(cls)` + `getPluginByName(name)` on `injectGrid()`, `provideGrid({typeDefaults, icons})`, event-output drift guard.

## cross-adapter-tensions

- REGISTRATION TIMING: React/Vue auto-register at module load (sync); Angular requires explicit DI setup
- WEAKMAP FALLBACK: dual lookup (WeakMap → field name → factory) needed because framework re-renders create new DOM elements
- PORTAL/TELEPORT OVERHEAD: mounting framework components into web component cells requires bridge layer managing lifecycle outside framework's component tree

## adapter-conformance-quick-table

| Framework | Registration           | Event idiom                                                                | Programmatic access                         |
| --------- | ---------------------- | -------------------------------------------------------------------------- | ------------------------------------------- |
| React     | global at module load  | props `onCellClick={(d)=>...}` (event-props.ts maps to `addEventListener`) | `useGrid<TRow>()` hook                      |
| Vue       | global at module load  | emits `@cell-click="handler"` (props → `addEventListener`)                 | `useGrid<TRow>()` composable (Ref wrappers) |
| Angular   | DI via `provideGrid()` | outputs `(cellClick)="handler($event)"` (directive wires native → outputs) | `injectGrid()`                              |
