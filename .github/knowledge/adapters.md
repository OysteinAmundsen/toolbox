---
domain: adapters
related: [grid-core, grid-features]
---

# Framework Adapters — Mental Model

> **DECIDED entries are facts + one-line WHY. History (what we tried, in what order) belongs in git log, not here.** When updating: condense, do not append.

## shared-architecture

- PATTERN: global singleton adapter registered at module load (React/Vue) or DI setup (Angular)
- FLOW: adapter registered → grid parses light DOM → user sets columns with framework components → `processConfig()` wraps components in bridge fns → grid calls renderer → bridge mounts component into cell container
- INVARIANT: adapter must be registered before grid parses light DOM
- INVARIANT: one adapter per app (singleton)
- INTERFACE (all implement): `processConfig`, `createComponentRenderer`, `createComponentEditor`, `releaseCell`, plus 10 methods listed in `CORE_CONSUMED_ADAPTER_METHODS` (see adapter-conformance)
- DECIDED (#330): `FrameworkAdapter.beginBatch?()` / `endBatch?()` defer per-cell teardown across bulk `releaseCell` loops (`_clearRowPool`, `renderVisibleRows` pool-shrink, `renderInlineRow` pre-wipe). Calls nest — outermost `endBatch` flushes. Listed in `CORE_CONSUMED_ADAPTER_METHODS`. Vue/Angular implement as no-ops (already batched).
- DECIDED (#338 / #340 reverted): adapter Context / `InjectionKey` / `InjectionToken` are plain module constants — MUST NOT be routed through `globalThis`. Rationale in `grid-core.md` § shared-store. Micro-frontend `customElements.define` collision belongs to #339.

## adapter-conformance

- OWNS: `CORE_CONSUMED_ADAPTER_METHODS` in `libs/grid/src/lib/core/adapter-conformance.ts`, re-exported from `public.ts`
- INVARIANT: every adapter ships `<framework>-grid-adapter.conformance.spec.ts` that fails when any listed method is missing on instance (React/Vue) or prototype (Angular — ctor needs DI)
- INVARIANT: when core adds a hook it depends on, append to `CORE_CONSUMED_ADAPTER_METHODS` so all adapter conformance specs go red
- DECIDED: only the constant is exported from `public.ts`; helper fns stay internal. WHY: exporting them pushed `index.js` over budget. Each spec inlines a 2-line filter; DRY isn't worth the bytes.
- TENSION (Angular): spec MUST start with `import '@angular/compiler';` (adapter transitively imports `@angular/forms`, partially-compiled). Uses `GridAdapter.prototype` because ctor requires DI.

## react-adapter

- OWNS: `columnRegistries` WeakMap, `fieldRegistries` Map (fallback), portal manager
- BRIDGE: React portal — `createPortal(component, container)` mounts into cell DOM
- KEY FILES: `react-grid-adapter.ts`, `portal-bridge.ts`, `react-column-config.ts`, `use-grid.ts`, `portal-manager.tsx`, `data-grid.tsx`
- DECIDED (#256): `createNodeBridge<TCtx>(reactFn)` in `portal-bridge.ts` = canonical `(ctx) => ReactNode` → `HTMLElement | null` wrapper (`display:contents` + `renderToContainer`). Used by `features/{pinned-rows,grouping-columns,grouping-rows}.ts`. Non-nullable callers `?? document.createElement('div')`. `features/filtering.ts` stays inline (per-container key tracking shape mismatch).
- DECIDED: `createNodeBridge` MUST `instanceof Node` check the user-fn return and passthrough DOM nodes. WHY: vanilla pinned-row helpers (`rowCountPanel()`, `filteredCountPanel()`) return `(ctx) => HTMLElement`; without check, `PortalBoundary` throws "Objects are not valid as a React child". Same rule in Vue `teleport-bridge.ts`.
- DECIDED (Apr 2026, #250): `<tbw-grid>` inline `ref` in `data-grid.tsx` syncs ONCE via `initialSyncDoneRef = useRef(false)`. WHY: React detaches/reattaches refs each render (called with `null` then element); without gate, every parent re-render re-assigned `grid.gridConfig`, rebuilding `effectiveConfig.columns` and wiping runtime `col.hidden` etc. `if (!previous)` insufficient (detach leaves `previous===null`). Test: `data-grid.spec.tsx > does not re-assign gridConfig on parent re-render`.
- DECIDED (May 2026, employee-management): `detectChildComponentFeatures` (`data-grid.tsx`) auto-derives `responsive: true` / `masterDetail: {showExpandColumn, animation}` from `<GridResponsiveCard>` / `<GridDetailPanel>`. `mergedFeatureProps` MUST strip child-detected entries already keyed in `gridConfig.features` — bare-bones child config wins core's manual-wins dedup (`grid.ts` `#initializePlugins`) and drops the user's full config → TBW110.

## vue-adapter

- OWNS: `columnRegistries` WeakMap, `fieldRegistries` Map (fallback), teleport manager
- BRIDGE: Vue teleport mounts VNode into cell container
- COMPONENT DETECTION: `__name` (SFC) → `setup` (Composition) → `render` (Options) → plain function (Functional)
- KEY FILES: `vue-grid-adapter.ts`, `teleport-manager.ts`, `vue-column-config.ts`, `use-grid.ts`, `TbwGrid.vue`
- INVARIANT: `TbwGrid.vue` MUST mount `<TeleportManager>` and register via `setTeleportManager(gridEl, handle)` before any teleport-bridge call. Without it, `renderToContainer()` falls back to `createApp()` and silently severs `provide`/`inject`, Pinia, Router, i18n. The fallback path is reachable by adapter-internal renders (tool panels, master-detail) too, not just user cell renderers.
- INVARIANT: `TbwGrid.vue` MUST call `nextTick(() => { masterDetail.refreshDetailRenderer?.(); responsive.refreshCardRenderer?.(); refreshColumns(); refreshShellHeader(); })` in `onMounted`. Light-DOM children (`<TbwGridToolPanel>`, `<TbwGridResponsiveCard>`) mount AFTER the grid's first scan; without these calls they're silently ignored.
- DECIDED (#237): `createToolPanelRenderer` wrapper-detach (inner `<div class="vue-tool-panel">`); cleanup synchronously `wrapper.remove()` BEFORE async teleport-removal microtask. WHY: Vue 3.5 lacks `flushSync`; wrapper-detach makes downstream `container.innerHTML = ''` a no-op so Vue's deferred unmount runs without `NotFoundError`.
- DECIDED (#237): Vue reuses core `createPluginsFromFeatures` from `@toolbox-web/grid/features/registry`. No hand-rolled feature loops.
- DECIDED (#256): `createNodeBridge<TCtx>(vueFn)` in `teleport-bridge.ts` mirrors React. Same `?? createElement('div')` + Node-passthrough rules; `features/filtering.ts` inline.
- DECIDED: `TbwGrid.vue` MUST set `defineOptions({ inheritAttrs: false })` + `v-bind="$attrs"` on inner `<tbw-grid>`. WHY: fragment root (`<TeleportManager/>` + `<tbw-grid>`); without this, `class=` etc. trigger "Extraneous non-props attributes" warnings.
- DECIDED: `TbwGridToolPanel.vue` accepts BOTH `title` (canonical, maps to attribute `shell.ts > parseLightDomToolPanels` reads) and `label` (deprecated alias). Pre-fix Vue panels silently TBW070'd because only `label` was forwarded.
- DECIDED: `parseLightDomToolPanels` MUST NOT tear down adapter-rendered panel content on idempotent re-parses. RULE: re-parse of an adapter-bound panel only refreshes `render` closure + attributes; runs `panelCleanups` only on (a) first adapter attach (vanilla → adapter) or (b) header attr change (order/icon/tooltip). WHY: every `grid.gridConfig = …` routes through `#applyGridConfigUpdate` → `parseLightDomToolPanels` — unconditional cleanup destroyed local state + `scrollTop` of custom panels. Tracker: `ShellState.adapterBoundToolPanelIds`. Test: `shell.spec.ts` "does not tear down adapter-rendered panel content on idempotent re-parse".

## angular-adapter

- OWNS: `viewRefs`, `componentRefs`, per-cell editor tracking
- BRIDGE: `createEmbeddedView(template, ctx)` + `syncRootNodes(viewRef, container)`
- SYNC ROOT NODES: compares `viewRef.rootNodes` vs `container.childNodes`; replaces all if different (handles `@if`/`@for`)
- KEY FILES: `angular-grid-adapter.ts`, `angular-column-config.ts`, `inject-grid.ts`, `directives/grid.directive.ts`
- TENSION: two renderer syntaxes (`*tbwRenderer` structural directive vs `tbw-grid-column-view` nested directive) both supported
- TENSION: registration requires manual DI setup (not auto like React/Vue)
- DECIDED (#256): `mountComponentRenderer<TCtx>(componentClass, mapInputs, pool)` is the canonical primitive for mounting a standalone component into a cell/header/panel. Returns `{ hostElement, componentRef }`. All `createComponent*Renderer` methods are thin wrappers around it. Cell cache (WeakMap pool reuse) and editor wiring stay AROUND the primitive — they're per-callsite concerns.
- DECIDED (May 2026): `mountComponentRenderer` and `createTrackedEmbeddedView<TCtx>(template, context)` are public `@internal` (typedoc-excluded). WHY: feature secondary entries need them to mount user components without reaching into adapter privates. `setComponentInputs` stays private.

### Per-feature directives (deprecated `Grid` inputs/outputs migrating out)

- DECIDED (May 2026, `refactor/grid-angular-feature-directives`): each plugin's `[input]`/`(output)` lives in an attribute-selector directive `features/<name>/src/grid-<name>.directive.ts` (e.g. `selector: 'tbw-grid[filtering], tbw-grid[filterChange]'`). WHY: every `input()`/`output()` on `Grid` ships `ɵɵdefineDirective` metadata into core whether imported or not — sweep moved grid-angular core from 239 kB → 250.4 kB raw / 53.0 kB gz with per-feature 2-15 kB tree-shakeable bundles (filtering 14.3 kB, selection 11.5 kB, undo-redo 11.4 kB; pivot/tooltip ~2.2 kB).
- DECIDED: compile-time guarantee (`Can't bind to 'filtering' since it isn't a known property of 'tbw-grid'` when directive not imported) — STRONGER than React/Vue (silent drop) and WC core (runtime throw).
- RULED OUT: Angular `hostDirectives` (static metadata bakes into `Grid.ɵɵdefineDirective`, breaks tree-shake). Side-effect auto-registration (standalone compiler resolves statically from consumer's `imports`).
- DECIDED (hybrid co-existence): deprecated `Grid` inputs/outputs stay until v2. Mediation = `libs/grid-angular/src/lib/internal/feature-claims.ts` per-element claims (`WeakMap<HTMLElement, Map<name, configGetter>>` + `WeakMap<HTMLElement, Set<eventName>>`). Directive ctor: `registerFeatureClaim(grid, name, () => this.input())` + `claimEvent(grid, eventName)`. `Grid.createFeaturePlugins` reads `getFeatureClaim(...)?.()` first (falls back to deprecated input); `Grid.setupEventListeners` skips `isEventClaimed`. Reading getter inside effect transitively tracks the directive's signal — all directives at a node construct before any `effect()` (microtask). `ngOnDestroy` calls `unregister*`. Cost: +5.5 kB raw / +1.5 kB gz on core.
- DECIDED: feature directive bound alongside deprecated `Grid` input → **directive wins**. Both bindings fire; claim takes precedence. KNOWN ASYMMETRY: deprecated `(filterChange)` listeners go silent when `GridFilteringDirective` imported into same component (called out in directive JSDoc).
- TENSION: claims-registry helpers re-exported from package barrel (ng-packagr forbids relative secondary→primary). `@internal`, typedoc-excluded. Cannot tree-shake out of core for zero-feature-directive consumers.
- DECIDED (employee-management): `gridConfig.features` and per-feature directives compose. When directive matches via event-only binding (`<tbw-grid (filterChange)="..."/>` without `[filtering]`), `registerFeatureClaim` returns `undefined` → `Grid.createFeaturePlugins` skips → core's `createPluginsFromFeatures(gridConfig.features)` creates plugin → directive's `addEventListener('filter-change')` still fires.
- INVARIANT: features added AFTER the sweep with NO deprecated `Grid` input (e.g. `stickyRows`) MUST still appear as `addPlugin('<name>', undefined)` in `Grid.createFeaturePlugins`, else the directive sets a claim nobody reads. Also append to `FeatureName` union in `feature-registry.ts`.

| Directive (`Grid<Name>Directive`) | Selector inputs                                              | Owned events                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| selection                         | `[selection]`                                                | `selection-change`                                                                                                               |
| editing                           | `[editing]`                                                  | `cell-commit`, `cell-cancel`, `row-commit`, `changed-rows-reset`, `edit-open`, `before-edit-close`, `edit-close`, `dirty-change` |
| clipboard                         | `[clipboard]`                                                | `copy`, `paste`                                                                                                                  |
| contextMenu                       | `[contextMenu]`                                              | `context-menu-open`                                                                                                              |
| multiSort                         | `[multiSort]`                                                | — (`sort-change` stays on Grid; single-col sort emits without plugin)                                                            |
| reorderColumns                    | `[reorderColumns]`                                           | `column-move`                                                                                                                    |
| visibility                        | `[visibility]`                                               | `column-visibility` (`columnStateChange` stays on Grid — multi-source)                                                           |
| pinnedColumns                     | `[pinnedColumns]`                                            | —                                                                                                                                |
| groupingColumns                   | `[groupingColumns]`                                          | —                                                                                                                                |
| columnVirtualization              | `[columnVirtualization]`                                     | —                                                                                                                                |
| reorderRows                       | `[reorderRows]`                                              | — (alias of rowDragDrop; events owned there to avoid duplicate listeners)                                                        |
| rowDragDrop                       | `[rowDragDrop]`                                              | `row-move`, `row-drag-start`, `row-drag-end`, `row-drop`, `row-transfer`                                                         |
| groupingRows                      | `[groupingRows]`                                             | `group-toggle`, `group-expand`, `group-collapse`                                                                                 |
| pinnedRows                        | `[pinnedRows]`                                               | —                                                                                                                                |
| tree                              | `[tree]`                                                     | `tree-expand`                                                                                                                    |
| masterDetail                      | `[masterDetail]`                                             | `detail-expand`                                                                                                                  |
| responsive                        | `[responsive]`                                               | `responsive-change`                                                                                                              |
| undoRedo                          | `[undoRedo]`                                                 | `undo`, `redo`                                                                                                                   |
| export                            | `[export]` (TS field `exportFeature` with `alias: 'export'`) | `export-complete`                                                                                                                |
| print                             | `[print]`                                                    | `print-start`, `print-complete`                                                                                                  |
| pivot                             | `[pivot]`                                                    | —                                                                                                                                |
| serverSide                        | `[serverSide]`                                               | —                                                                                                                                |
| stickyRows                        | `[stickyRows]`                                               | —                                                                                                                                |
| tooltip                           | `[tooltip]`                                                  | —                                                                                                                                |

- STAYS ON `Grid`: `cellChange`, `dataChange` (non-editing paths also emit); `sort-change`, `columnStateChange` (multi-source aggregates).
- TENSION: `Grid.cellCommit`/`rowCommit` use wrapper interfaces in `grid.directive.ts` (stale: `changedRowIndices: Set<number>` vs core `changedRowIds: string[]`; missing `setInvalid`/`updateRow`). Runtime detail = core shape; wrapper = typed view. v2 drops wrappers.

## adapter-feature-purity (May 2026)

- DECIDED: adapter cores (`{react,vue,angular}-grid-adapter.ts`, `react-column-config.ts`) MUST NOT runtime-reference feature behaviour (type-only imports OK). Runtime wiring lives in `features/<name>.ts` (React/Vue) or `features/<name>/src/` (Angular) secondary entries via registered bridges/hooks. Mirrors WC plugin discipline.

### Bridge registries (append-only, populated by side-effect imports)

| Registry                                                                | Module                                                                                   | Installed by                                                | Purpose                                                                                  |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `registerEditorMountHook` / `notifyEditorMounted`                       | `editor-mount-hooks.ts` (each adapter)                                                   | `features/editing`                                          | `before-edit-close` → native `.blur()` on focused input                                  |
| `registerFilterPanelTypeDefaultBridge`                                  | each adapter                                                                             | `features/filtering`                                        | wraps user `filterPanelRenderer` in framework render path                                |
| `registerDetailRendererBridge` / `registerResponsiveCardRendererBridge` | `react-grid-adapter.ts` / `vue-grid-adapter.ts` / `angular: internal/feature-bridges.ts` | `features/master-detail` / `features/responsive`            | turns user template/component into renderer fn; adapter method becomes thin delegate     |
| `registerFeatureConfigPreprocessor(name, fn)` (Angular)                 | `internal/feature-extensions.ts`                                                         | `features/grouping-columns`, `grouping-rows`, `pinned-rows` | bridges Angular component classes embedded in feature config                             |
| `registerTemplateBridge` (Angular)                                      | `internal/feature-extensions.ts`                                                         | `features/master-detail`, `responsive`                      | wires `<tbw-grid-detail>`/`<tbw-grid-responsive-card>` templates in `ngAfterContentInit` |

- INVARIANT: features import from the adapter's primary entry (registry hooks + types); adapter primary entry MUST NOT import from feature secondary entries (build cycle).
- INVARIANT (Angular): feature secondary VALUE imports MUST go via `@toolbox-web/grid-angular` barrel, NOT relative `../../../src/lib/...`. ng-packagr fails `TS6059: File ... is not under 'rootDir'` (template-typecheck generates `.ngtypecheck.ts` outside secondary's rootDir). Type-only imports may use relative paths.
- INVARIANT: spec files exercising bridge behaviour MUST add side-effect imports of `'../features/<name>'` at the top, mirroring real consumers. Otherwise the bridge is null and methods return `undefined`.
- INVARIANT (Angular spec): `angular-grid-adapter.spec.ts` registers bridges/preprocessors inline in `beforeAll` from `./internal/feature-bridges` and `./internal/feature-extensions` — NOT via barrel-side-effect import (would define `tbw-grid` and trip ResizeObserver in jsdom).
- DECIDED: `createToolPanelRenderer` stays on adapter (CORE primitive — `shell.ts` parses `<tbw-grid-tool-panel>` and calls it). `createEditor`/`createRenderer` stay on adapter (per-cell primitives, not editing-feature-specific). `createFilterPanelRenderer` stays inline (generic node-to-container wrap; only filter-feature dep is type-only).
- DECIDED (May 2026, Vue header-slot parity): `FrameworkAdapter` exposes optional `createHeaderRenderer?(el)` / `createHeaderLabelRenderer?(el)` \u2192 `HeaderRenderer<TRow>` / `HeaderLabelRenderer<TRow>` or undefined. Wired in `parseLightDomColumns` (`columns.ts`) when adapter `canHandle(el)` AND defines at least one. `mergeColumns` rule: programmatic wins; DOM-found header renderers fill missing programmatic ones. Vue's `<TbwGridColumn>` SFC needed `#header`/`#headerLabel` for parity; React/Angular intentionally don't implement (`gridConfig` column object is their surface). `registerColumnHeaderRenderer` / `registerColumnHeaderLabelRenderer` mirror `renderer`/`editor` (WeakMap + field-name fallback). Slot path reuses existing `createConfigVNodeHeaderRenderer` / `createConfigVNodeHeaderLabelRenderer` (teleport + VNode). Tests: `columns.spec.ts > framework adapter header hooks`; `vue-grid-adapter.spec.ts > createHeaderRenderer / createHeaderLabelRenderer`.
- DECIDED (employee-management): Angular `registerTemplateBridge` callbacks (master-detail, responsive) MUST look up via `(grid as any).getPluginByName?.(name)`, NOT scan `gridConfig.plugins`. WHY: feature-resolver plugins (from `gridConfig.features.<name>`) live only in `PluginManager` — scanning `gridConfig.plugins.find(...)` emitted spurious "is not configured" warnings.
- TENSION: Angular feature-claim helpers MUST live in primary-entry barrel (ng-packagr secondary→primary). React/Vue ship as single package — relative `../lib/...` works.

## react-overlay-editors / vue-overlay-editors (`useGridOverlay`)

- OWNS: nothing — pure hook/composable. Delegates to `grid.registerExternalFocusContainer(panel)` / `unregisterExternalFocusContainer(panel)`.
- GRID RESOLUTION (in order): 1) explicit `gridElement` option, 2) `panelRef.current.closest('tbw-grid')`, 3) React `GridElementContext` / Vue `inject(GRID_ELEMENT_KEY)`.
- INVARIANT: portaled/teleported panels can't use path 2 — path 3 is safety net (both frameworks preserve context across portals).
- INVARIANT: hook is intentionally minimal — no synthetic Tab, Escape, outside-click. Consumers needing full Angular `BaseOverlayEditor` parity wire those themselves. ~0.1 kB gz (#251).
- DECIDED (#251): React/Vue ship no `BaseOverlayEditor` equivalent (no React class idiom; Vue favors composables). `ColumnEditorContext.grid` covers class-style editors calling `registerExternalFocusContainer` directly.
- DECIDED (#251): `EditingPlugin` ARIA-expanded fallback (see `grid-plugins.md`) means most combobox/autocomplete editors work WITHOUT the hook — provided trigger sets `aria-expanded="true"` + `aria-controls="<panel-id>"`. Use hook for non-combobox overlays (color pickers, menus).
- VUE QUIRK: accepts `MaybeRef<boolean>` for `open` + `MaybeRef<DataGridElement|null|undefined>` for `gridElement`. Watch dep-object pattern (`watch({open, panel, grid, ctx}, ..., {immediate: true, flush: 'post'})`) required — `unref(open)` inside getter must be reactivity-tracked.

## angular-overlay-editors (`BaseOverlayEditor`)

- OWNS: panel element (moved to `document.body` to escape grid overflow clipping), `_abortCtrl: AbortController` for all listeners.
- DISMISSAL (all call abstract `onOverlayOutsideClick()` — subclass decides commit/cancel): `pointerdown` outside panel+host; `tbw-scroll` CustomEvent on closest `<tbw-grid>`; cell losing `cell-focus` class via MutationObserver → `hideOverlay()` (cancel path).
- INVARIANT: all listeners share `_abortCtrl.signal` — `teardownOverlay()` aborts all at once.
- INVARIANT: handler guards on `_isOpen && _panel` (listener attached eagerly in `initOverlay()` before show).
- DECIDED (#234): scroll → dismiss (NOT reposition). WHY: matches click-outside semantics, consumes public `tbw-scroll`.
- TENSION: anchor positioning uses CSS Anchor (`anchor-name`) when supported, else `_positionWithJs()` (only on open).

## vue-teleport-manager (per-entry error boundary)

- OWNS: `teleports: ShallowRef<Map<string, TeleportEntry>>` keyed by stable id. Rendered: `<Teleport :to="entry.container" :key><TeleportEntryBoundary :entryKey>{{ vnode }}</TeleportEntryBoundary></Teleport>`.
- INVARIANT: `TeleportEntryBoundary.errorCaptured` MUST `return false`. Without it, one misbehaving cell renderer propagates to host `app.config.errorHandler`.
- INVARIANT: drop entry MUST replace `teleports.value` with new `Map` (ShallowRef only fires on identity change).
- DECIDED (#250/#251): mirrors React's `PortalBoundary`. ~30 LoC.

## adapter-event-props (drift-safety pattern)

- OWNS (React): `EventProps<TRow>` + `EVENT_PROP_MAP` in `libs/grid-react/src/lib/event-props.ts`. Guard: `} as const satisfies Readonly<Record<keyof EventProps, keyof DataGridEventMap<unknown>>>;` (bidirectional).
- OWNS (Angular): `output<T>()` + `eventOutputMap` in `directives/grid.directive.ts`. Guard: `} as const satisfies Readonly<Record<string, keyof DataGridEventMap<unknown>>>;` (value-side only). Forward-only complement: `_assertEventOutputMapCoversCore` Exclude-extends-never type. Widen `_intentionallyOmittedEvents` to consciously skip.
- INVARIANT: NEVER widen `satisfies` to silence a complaint. The complaint is the feature: either drop the prop OR add the missing `declare module '../../core/types'` augmentation.
- INVARIANT: when satisfies rejects an event, check emit sites (`grep '_emit(' / 'event-name'`) — plugins emit + registry can diverge silently.
- INVARIANT: adding a `DataGridEventMap` entry wires all three: React `EVENT_PROP_MAP` + `EventProps`, Vue `EVENT_MAP` + `defineEmits`, Angular `eventOutputMap` + `output<T>()`. Vue has NO drift guard yet.
- INVARIANT: missing core public exports surface as Angular build failure (not Vue/React). Angular `@toolbox-web/grid/all` deep-import only sees `libs/grid/src/public.ts` — new event detail types must be re-exported there.
- INVARIANT: Angular `ColumnConfig` (`angular-column-config.ts`) allows `Type<CellRenderer>` etc. Helpers typed against core `ColumnConfig` (`applyColumnDefaults`) need `any` cast at boundary (columns-sync effect); `processColumn` normalizes.
- DECIDED: `EventProps` is flat (one entry per event, even paired `onUndo`/`onRedo`). Tried `onUndoRedo` — bound to non-emitted `'undo-redo'`.
- DECIDED: hand-maintained interface + `satisfies` (not mapped type — TypeDoc renders as `unknown`).
- TENSION (Angular): `eventOutputMap` keys not statically tied to `output<T>()` fields. Forgotten entry = silent runtime bug.

## adapter-feature-props (forward-only drift guard, React)

- OWNS: `FeatureConfig` (in `@toolbox-web/grid/all`) is augmented by every side-effect feature import. Canonical core feature registry.
- OWNS (React): hand-maintained `FeatureProps<TRow>` in `libs/grid-react/src/lib/feature-props.ts`. EOF guard: `type _MissingReactProps = Exclude<keyof FeatureConfig, keyof FeatureProps>; type _AssertFeaturePropsCoverCore = [_MissingReactProps] extends [never] ? true : ['Missing React props for core features:', _MissingReactProps];`
- INVARIANT: forward-only by design. React props are intentionally richer (shorthand unions, React-node renderers, React-only options like `SSRProps.ssr`). Reverse direction not checked.
- DECIDED: Vue/Angular don't have this guard yet — same pattern would work. Angular FeatureProps deliberately not mirrored: Angular configures via individual signal inputs on `Grid` directive, not a unified prop interface.
- DECIDED: `SSRProps.ssr` is `@deprecated`. React adapter no longer uses dynamic imports (features = synchronous side-effect imports, SSR-safe by construction). Setting `ssr={true}` only skips React-side plugin instantiation; `<tbw-grid>` still needs custom-elements polyfill server-side regardless. To be removed in a future major. Mirror in Vue's `feature-props.ts`.

## adapter-internal-helpers

- `createPortalContainer(className)` (`react-column-config.ts`); `createTeleportContainer(className)` (`vue-grid-adapter.ts`); `makeFlushFocusedInput(container)` in both. NOT extracted to shared package — keeps each adapter tree-shakeable (same rationale as `column-shorthand.ts`).
- `FEATURE_KEYS` hoisted to module scope in React `data-grid.tsx` (was per-render 24-element alloc).
- INVARIANT (Vue): `createEditor` (slot-path) MUST resolve `gridEl` eagerly via `element.closest('tbw-grid')`, NOT via `attachBeforeEditCloseFlush`'s `queueMicrotask`. WHY: tests/user code dispatch `before-edit-close` synchronously during editor's first render — microtask installs listener too late. `createConfig*Editor` family MUST use microtask path (containers built before DOM attach). Both share `makeFlushFocusedInput`.

## three-way-parity (May 2026 audit)

- DECIDED: React/Vue/Angular aligned — 26 feature props, 28 grid events, hooks/composables, providers, tree-shake registration, bridges, registries.
  - Events Vue/Angular were missing: `cellCancel`, `editOpen`, `beforeEditClose`, `editClose`, `dirtyChange`, `dataChange`, `columnResizeReset`, `groupExpand`, `groupCollapse`, `contextMenuOpen`. Vue's `'undo-redo'` was a latent bug — split into `'undo'`/`'redo'`.
  - Angular: mirrored `column-shorthand.ts`; widened `columns` to `ColumnShorthand<any>[]` + added `columnDefaults` flowing through `normalizeColumns` → `applyColumnDefaults` → `adapter.processColumn`. Added `cardRowHeight` on `GridResponsiveCard`; `getPlugin<T>(cls)` + `getPluginByName(name)` on `injectGrid()`; `provideGrid({typeDefaults, icons})` in `grid-provider.ts` (environment-scoped DI vs Vue's component-scoped `<GridProvider>`); event-output drift guard.
  - React: added `applyColumnDefaults`. Vue: exposed `cardRowHeight`; re-introduced deprecated `SSRProps` for `AllFeatureProps<TRow>` parity; exported `GridCellContext`/`GridEditorContext` as aliases over `CellSlotProps`/`EditorSlotProps`; added `tool-panel-registry.spec.ts`. FeatureProps NOT mirrored to Angular (signal-inputs idiom).
- DECIDED (#289): cell/editor context generics use asymmetric defaults `TRow = unknown`, `TValue = any` (Vue `CellSlotProps`/`EditorSlotProps`/`GridCellContext`/`GridEditorContext`; React `GridCellContext`/`GridEditorContext`). WHY: `unknown` for row safety, `any` for `TValue` unblocks single-generic `CellSlotProps<MyRow>` (narrowing awkward in templates). Tests: `slot-types.spec.ts`, `context-types.spec.ts`.
- DECIDED (#289 follow-up): `TbwGridColumn.vue` is `<script setup lang="ts" generic="TRow = unknown, TValue = any">`. `defineSlots` declares typed `cell?` / `editor?`. Adapter callbacks still receive erased `CellRenderContext<unknown, unknown>` — bridged via fresh-object-literal `as CellSlotProps<TRow, TValue>` (object-literal assignability, NOT `as unknown as`).
- INVARIANT: public export added to one adapter → mirror in same PR. `index.ts` = canonical surface.
- INVARIANT: `AllFeatureProps<TRow>` shape identical React/Vue. If `SSRProps` truly removed, drop atomically.
- TENSION: idiomatic differences are NOT parity gaps (`<DataGrid>` vs `<TbwGrid>`, render props vs slots, `GridElementContext` vs `GRID_ELEMENT_KEY`, `PortalManager` vs `TeleportManager`).

## angular-adapter-testing

- INVARIANT: angular adapter project deliberately avoids `TestBed`. Bootstrapping platform-browser-dynamic adds 3-5s per spec file and is unnecessary for component-free logic.
- PATTERN: for `inject()`-constructed classes (e.g. `GridTypeRegistry`, `BaseOverlayEditor`), instantiate without ctor: `Object.create(MyClass.prototype)` and seed private fields.
- PATTERN: for `AngularGridAdapter`, mock `createComponent` from `@angular/core` and the seven template-registry getter modules (`./directives/grid-detail-view.directive`, `grid-responsive-card.directive`, `grid-tool-panel.directive`, `grid-column-view.directive`, `grid-column-editor.directive`, `structural-directives`, `./grid-type-registry`). Mocked `createComponent` MUST read its `hostElement` option onto `componentRef.location.nativeElement` so adapter's `cellEl.contains(ref.location.nativeElement)` cleanup checks succeed.
- PATTERN: for directives using `inject()` + `effect()` + `input()` field initialisers (e.g. `GridFormArray`), `vi.mock('@angular/core', …)` to replace the three primitives. See `testing-patterns.instructions.md` for the full real-class spec recipe.
- DECIDED (#237): when CI coverage is V8, only loaded files appear in denominator. Adding `import { GridAdapter }` to a conformance spec dropped angular-adapter from ~80% → ~33%. Restoration path is real unit tests using patterns above, NOT lower threshold or exclude. `grid.directive.ts` (1581 lines) is intentionally NOT exercised by unit tests — covered end-to-end by demo apps and Playwright; importing would double the V8-visible project size.

## ng-packagr-secondary-entry-rules

- INVARIANT: ng-packagr 21 forbids primary depending on secondary. Direction: secondary → primary only. Blocks "physically move directive into feature folder, then re-export from main barrel".
- INVARIANT: re-exporting a directive via relative path (`export { GridDetailView } from '../features/master-detail/src/...'`) emits the file into BOTH bundles — two directive classes / two registries; cross-bundle bridge breaks at runtime. NEVER use this.
- DECIDED: feature-specific directives that can't move yet (e.g. `GridDetailView`) use soft-deprecation: source stays in `src/lib/directives/`, main `index.ts` re-exports with `MOVE-IN-V2:` marker (NOT `@deprecated` — would warn correct-feature consumers); feature entry re-exports from `@toolbox-web/grid-angular` so canonical path works. Physical move queued for v2.0.0 (`build-and-deploy.md` v3 plan).

## tsconfig-path-mappings-and-typedoc

- INVARIANT: `tsconfig.base.json` mappings `@toolbox-web/grid-angular` → `dist/libs/grid-angular/index.d.ts` and `.../features/*` → `dist/libs/grid-angular/features/*.d.ts` are STALE — ng-packagr 21 emits to `dist/libs/grid-angular/types/...`. Broken since ng-packagr migration (`5a6f3fb4`); most consumers don't notice because they read sources via project references or `package.json#exports` overrides at runtime. Do NOT "fix" the global mapping without auditing every typecheck/typedoc/build target — multiple targets work _because_ the mapping resolves to nothing.
- DECIDED: `libs/grid-angular/tsconfig.typedoc.json` overrides `paths` to point at SOURCE (`./src/index.ts`, `./features/*/src/index.ts`) so typedoc never depends on built dist. Without this override, typedoc fails with 30+ TS2307 cascades. Mirror this pattern for any future "read source across primary/secondary boundary" tooling.
- INVARIANT: `libs/grid-react/src/lib/column-shorthand.ts` MUST import `ColumnConfig` from `./react-column-config`, NOT `@toolbox-web/grid`. React-shaped `ColumnConfig` widens `renderer` to `(ctx) => ReactNode`. If column-shorthand uses core type, `applyColumnDefaults(...)` triggers TS2345. Mirror in `grid-vue` (Vue-shaped) and `grid-angular` (TemplateRef-shaped) when those adapters add column-defaults support.

## adapter-conformance-quick-table

| Framework | Registration           | Event idiom                                                                | Programmatic access                         |
| --------- | ---------------------- | -------------------------------------------------------------------------- | ------------------------------------------- |
| React     | global at module load  | props `onCellClick={(d)=>...}` (event-props.ts maps to `addEventListener`) | `useGrid<TRow>()` hook                      |
| Vue       | global at module load  | emits `@cell-click="handler"` (props → `addEventListener`)                 | `useGrid<TRow>()` composable (Ref wrappers) |
| Angular   | DI via `provideGrid()` | outputs `(cellClick)="handler($event)"` (directive wires native → outputs) | `injectGrid()`                              |

## event-handling — `before-edit-close` blur bridge

- DECIDED: editor `before-edit-close` → native `.blur()` on focused input/textarea/select. WHY: Tab + programmatic row exits rebuild cell DOM synchronously; `onBlur={commit}` / `@blur="commit"` / `(blur)="commit()"` would lose pending input. Native `.blur()` (NOT synthetic `FocusEvent`) — React 17+ delegates focus via bubbling `focusout`. Angular parallel: `BaseGridEditor.onBeforeEditClose()`.
- DECIDED (#249): bridge wires BOTH slot/JSX `createEditor` path AND config-path wrappers: React `wrapReactEditor`; Vue `createConfigVNodeEditor`/`createConfigComponentEditor`/`createTypeEditor`; Angular `createComponentEditor` + template `createEditor`. Tab from last cell → `#exitRowEdit(currentRow,false)` → `beginBulkEdit(nextRow)` synchronously — focused input never blurs naturally. Grid resolved lazily via `queueMicrotask`.
- CLEANUP: React threads `unsub` through `mountedPortals` (`cleanupConfigRootsIn`); Vue/Angular store in `editorMountTeardowns` Map (container/host-keyed), swept in `releaseCell` + `destroy()`.
- DECIDED (Tier 1): install moved out of adapter into `editor-mount-hooks.ts` notifier (see registries). `attachBeforeEditCloseFlush` → `runEditorMountHooks`. `features/editing` registers.
- TESTS: `react-column-config.spec.ts > flushes the focused input on before-edit-close`; `vue-grid-adapter.spec.ts > flushes the focused input on before-edit-close for config-based VNode editor`; `angular-grid-adapter.spec.ts > before-edit-close blur bridge`.

## event-handling — releaseCell DOM-recycle invariant (#250)

- DECIDED: core MUST call `grid.__frameworkAdapter?.releaseCell?.(cell)` BEFORE any sync wipe (`innerHTML=''` / `replaceChildren()`) of a cell that may contain adapter-managed renderer DOM. Without it, the framework's tree references orphans and next commit throws `NotFoundError: removeChild`.
- COVERED PATHS: `editor-injection.ts` (open editor); `renderVisibleRows` pool-shrink (`core/internal/rows.ts`); `_clearRowPool` (`grid.ts`). All guarded by `cell.firstElementChild`.
- REACT: `releaseCell` resolves containers via `cellEl.querySelectorAll('.react-cell-renderer, .react-cell-editor')` + `containerToKey` reverse index → `removeFromContainer(key, {sync:true})` + `untrackPortal(key)` → `cleanupConfigRootsIn(cellEl)`. Defense in depth: `wrapReactRenderer` + `createRenderer` validate `cellEl.contains(cached.container)` before WeakMap reuse.
- DECIDED (#250 follow-up): `PortalManager` wraps each `createPortal` in `PortalBoundary` (class component, `componentDidCatch` drops entry + re-renders). WHY: React 18+/19 routes `flushSync`-commit exceptions to nearest descendant boundary, NOT back to caller — `try/catch` around `flushSync` cannot recover.
- DECIDED (#330): `PortalManager.{beginBatch,endBatch}` on handle; `portal-bridge.ts` re-exports `beginPortalBatch`/`endPortalBatch`; `GridAdapter.beginBatch/endBatch` delegate. While batched, `removePortal(key, sync=true)` deletes entry but SKIPS `flushSync` — caller detaches container before `endBatch()`; deferred render's `isConnected` filter prunes. Kills `flushSync was called from inside a lifecycle method` warning storm on grouping changes. INVARIANT: bulk-teardown sites MUST detach every container AFTER per-cell release and BEFORE `endBatch()`, else deferred unmount against wiped container reproduces original `removeChild NotFoundError`. Test: `portal-manager.spec.tsx > beginBatch / endBatch`.
- DECIDED (#332): `PortalManager` guards every deferred path with `unmountedRef` set in a `useLayoutEffect` cleanup (NOT `useEffect` — passive runs after commit, leaves window for queued `flushSync`). WHY: host React tree unmount (route change) leaves pending `queueMicrotask(scheduleFlush)` / rAF (`schedulePrune`) which re-enter `createPortal` against torn-down providers — context hooks throw per row × column. Cleanup sets `unmountedRef=true`, cancels rAF, clears `portalsRef`; methods become no-ops. Mount body re-arms `unmountedRef=false` for `<StrictMode>` double-invoke. NOT MIRRORED in Vue/Angular (Vue no `flushSync`; Angular embedded views tied to `ViewContainerRef`). Tests: `portal-manager.spec.tsx > host-tree unmount cleanup` (3 cases).
- ALSO: render-time filter skips portals with `container.isConnected === false`.
- TESTS: `react-column-config.spec.ts > evicts cache and creates fresh container...`; `react-grid-adapter.spec.ts > evicts stale cache... > also unmounts renderer portals inside the cell`; `rows.spec.ts > releases cells when pool shrinks`; `portal-manager.spec.ts > isolates a crashing portal (#250)`.
- KNOWN WEAKNESSES: `GroupingRowsPlugin.ts` and `pinned-rows.ts` have `rowEl.innerHTML=''` paths that do NOT call `releaseCell` first (rely on boundary).

## feature-prop-bridging

- All adapters expose feature props that auto-load plugins. React: `<DataGrid selection="range" editing="dblclick" />`. Vue: `<TbwGrid :selection="'range'" :editing="'dblclick'" />`. Angular: `<tbw-grid [selection]="'range'" [editing]="'dblclick'">`.
- MECHANISM: feature props → `createPluginsFromFeatures()` → factory creates plugins → added to `gridConfig.plugins`.

## cross-adapter-tensions

- REGISTRATION TIMING: React/Vue auto-register at module load (sync); Angular requires explicit DI setup
- WEAKMAP FALLBACK: dual lookup (WeakMap → field name → factory) needed because framework re-renders create new DOM elements
- PORTAL/TELEPORT OVERHEAD: mounting framework components into web component cells requires bridge layer managing lifecycle outside framework's component tree
