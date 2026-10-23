---
domain: adapters
related: [adapters-react, adapters-vue, adapters-angular, grid-core, grid-features, grid-plugins-shell]
---

# Framework Adapters — Shared Mental Model

> Per-framework specifics → adapters-react.md · adapters-vue.md · adapters-angular.md.
> Read order: § shared architecture → § bridge registries → per-framework file.

## shared architecture

- PATTERN: one singleton adapter per app — module load (React/Vue) or DI (Angular); MUST register BEFORE the grid parses light DOM.
- FLOW: light-DOM parse → `processConfig()` wraps components in bridge fns → renderer call → bridge mounts into the cell.
- INTERFACE: `processConfig`, `createComponentRenderer`, `createComponentEditor`, `releaseCell`, plus `CORE_CONSUMED_ADAPTER_METHODS`.
- DECIDED (#330): `beginBatch?()` / `endBatch?()` defer per-cell teardown across bulk `releaseCell` loops (`_clearRowPool`, `renderVisibleRows` pool-shrink, `renderInlineRow` pre-wipe). Calls NEST — outermost `endBatch` flushes. Vue/Angular no-op.
- INVARIANT (#518): `FrameworkAdapter.unmount(container)` MUST dispose every framework root CONTAINED in it, not just one keyed on it; core calls it on wrapper overlays (`.tbw-cell-loading-overlay`) before removal.
- DECIDED (#338/#340, reverted): adapter Context / `InjectionKey` / `InjectionToken` are plain module constants, MUST NOT route through `globalThis` (WHY: grid-core.md § shared-store). Micro-frontend `customElements.define` collision: #339.
- TENSION: WeakMap fallback (WeakMap → field name → factory; re-renders create new DOM); Portal/Teleport bridges own component lifecycle outside the framework tree.

## adapter conformance

- OWNS: `CORE_CONSUMED_ADAPTER_METHODS` in `libs/grid/src/lib/core/adapter-conformance.ts`, re-exported from `public.ts`.
- INVARIANT: each `<framework>-grid-adapter.conformance.spec.ts` fails when a listed method is missing (instance for React/Vue; prototype for Angular — ctor needs DI). New core-consumed hook → APPEND to `CORE_CONSUMED_ADAPTER_METHODS`.
- DECIDED: only the constant is exported (helpers broke the `index.js` budget); specs inline a 2-line filter.
- IDIOMS (registration · events · access): React module load · props `onCellClick` (`event-props.ts`) · `useGrid<TRow>()` hook; Vue module load · emits `@cell-click="handler"` · `useGrid<TRow>()` composable; Angular `provideGrid()` · outputs `(cellClick)="handler($event)"` · `injectGrid()`.

## adapter feature purity

- DECIDED (May 2026): adapter cores (`{react,vue,angular}-grid-adapter.ts`, `react-column-config.ts`) MUST NOT runtime-reference feature behaviour (type-only imports OK); wiring lives in `features/<name>.ts` (React/Vue) or `features/<name>/src/` (Angular).
- DECIDED (#356 phase 7): registry surface re-exported from each adapter's primary `index.ts`; SSOT: `.github/instructions/framework-adapters.instructions.md` ("Cross-adapter registry parity").
- INVARIANT: registries are additive-only (never remove/rename); mirror new ones in the same PR, same name + signature. Asserted by `*-grid-adapter.registry-parity.spec.ts` (Angular's also asserts React-only symbols are `undefined`).

## config-entry uniformity

- INVARIANT: a component/JSX/VNode renderer inside `gridConfig.features.<name>` MUST bridge IDENTICALLY to the per-feature prop/directive form.
- DECIDED: React/Vue bridge at the **feature factory** — `registerFeature(name, factory, { override: true })` wraps the vanilla factory. WHY: `grid.ts > #initializePlugins` → `resolveFeatures` → `createPluginsFromFeatures` → `createPluginFromFeature` → `getFeatureFactory(name)` is the SINGLE chokepoint for every `config.features` entry, from props (→ `plugins[]`) or `gridConfig.features` (`processGridConfig` / `mergedConfig` spread `features` untouched). Test: `features/grouping-columns.spec.tsx`.
- DECIDED (Jun 2026): Angular bridges at the **preprocessor** (`registerFeatureConfigPreprocessor`), NOT a factory override; MUST run on BOTH paths: `createFeaturePlugins` (directive) and `set gridConfig` → `processConfig` interceptor (`getFeatureConfigPreprocessor(name)` loop). SYMPTOM: `TypeError: Class constructor … cannot be invoked without 'new'` at afterRender. Tests: `angular-grid-adapter.spec.ts` "processGridConfig / processConfig".

## shell content wrappers (#352, #370)

- OWNS: React/Angular `Grid{Header,Toolbar}Content` (component/directive), Vue `TbwGrid{Header,Toolbar}Content`, wrapping `registerHeaderContent`/`registerToolbarContent`. Vue uses `<Teleport>` (slot child of `<TbwGrid>`); Angular uses `host.closest('tbw-grid')`, NOT `injectGrid()`.
- INVARIANT: render-callback cleanup is a **no-op**; `register*` MUST `await grid.ready?.()` then bail if unmounted meanwhile (React `unmounted` / Vue `cancelled` / Angular `destroyed`), else it leaks.
- INVARIANT (Angular): render MUST be idempotent (`createEmbeddedView` isn't; container id is reused across shell refreshes) — skip if `viewRef.rootNodes[0]` is still inside the container, else destroy the stale viewRef.
- DECIDED (#370, v3): wrappers call `grid.getPluginByName?.('shell')?.{register,unregister}{Header,Toolbar}Content`; grid-element delegates (`grid.register*Content`) REMOVED (TS2339). `import type { HeaderContentDefinition | ToolbarContentDefinition } from '@toolbox-web/grid/plugins/shell'` (NOT package root) activates `PluginNameMap` augmentation (typed, no cast). Files: `grid-react/src/lib/grid-{header,toolbar}-content.tsx`, `grid-vue/src/lib/TbwGrid{Header,Toolbar}Content.vue`, `grid-angular/src/lib/directives/grid-{header,toolbar}-content.directive.ts`; `*ShellContent*.spec.*` mock shell behind `getPluginByName('shell')`.
- DECIDED (v3 enablement): opt-in `features/shell` side-effect subpath per adapter (body `import '@toolbox-web/grid/features/shell'`) — React/Vue: `vite.config.mts` `build.lib.entry` + `src/features/index.ts`; Angular: `features/shell/{ng-package.json,src/index.ts}` (NO directive). All barrels get `_ShellAugmentation`. GOTCHA: global `shell` `FeatureConfig` key trips both React/Vue drift guards — `_AssertFeaturePropsCoverCore` needs `shell?: boolean | ShellConfig`; `_AssertBuiltinCoversCore` needs `'shell'` in `_KnownBuiltinGaps`. Specs: `features/shell{.spec.ts,/src/index.spec.ts}`.
- DECIDED (#260/#261/#262, v3): shell resolves ONLY from `features:{shell}` or `plugins:[ShellPlugin]` (no core auto-register); top-level `config.shell` alone does NOT enable it (`ShellPlugin.processConfig` merges it post-instantiation). Demos import `.../features/shell` + nest `features: { shell: {…} }`. RULED OUT: child-feature detector returning `{ shell: true }` — core drops unregistered feature names (TBW031).
- INVARIANT (v3 mirrors): adapter `PinnedRowsConfig` = `Omit<CorePinnedRowsConfig,'slots'> & { slots?: PinnedRowSlot[] }` (no `customPanels`); shell type aliases import from `@toolbox-web/grid/plugins/shell`; `features/reorder-rows` does not exist.
- GOTCHA (#430): `ToolPanelDefinition.title` is OPTIONAL (title-less single panel: no accordion header). React `GridToolPanelProps.title?`, Angular `GridToolPanel.title = input<string>()`, Vue `title?` (→ `''`).

## bridge registries (append-only, side-effect-populated)

- `registerEditorMountHook` / `notifyEditorMounted` — `editor-mount-hooks.ts` (all 3) ← `features/editing` (§ `before-edit-close`).
- `registerFilterPanelTypeDefaultBridge` — each adapter ← `features/filtering`: wraps user `filterPanelRenderer`.
- `registerDetailRendererBridge` / `registerResponsiveCardRendererBridge` — `{react,vue}-grid-adapter.ts` / Angular `internal/feature-bridges.ts` ← `features/master-detail`, `features/responsive`: template/component → renderer fn.
- `registerPostMountRefresh(name, fn)` / `notifyPostMount` — `post-mount-refresh-hooks.ts` (React + Vue) ← `features/master-detail`, `features/responsive`: re-kick plugins after children commit.
- `registerChildFeatureDetector(name, fn)` / `detectChildFeatures` — `child-feature-detector.ts` (**React only**) ← pre-registered at `data-grid.tsx` module load, NOT side-effect imports (so `<GridDetailPanel>` works without `features/master-detail`): scans children by `displayName` → partial `FeatureProps`.
- `registerFeaturePropKey(name)` / `getFeaturePropKeys` — `feature-prop-keys.ts` (React + Vue) ← built-ins self-register at load; extracted from `...rest`/declared props before `createPluginsFromFeatures`.
- `registerFeatureConfigPreprocessor(name, fn)` / `getFeatureConfigPreprocessor` — `internal/feature-extensions.ts` (**Angular only**) ← `features/{grouping-columns,grouping-rows,pinned-rows,master-detail,responsive,filtering}`: `TemplateRef`/`Component` in feature config → renderer fns; invoked by `Grid.createFeaturePlugins`.
- `registerTemplateBridge` (**Angular only**) — `internal/feature-extensions.ts` ← `features/master-detail`, `features/responsive`: wires `<tbw-grid-detail>` / `<tbw-grid-responsive-card>` in `ngAfterContentInit`.
- DECIDED (#356 phase 7): each adapter ships ONLY registries it invokes — React adds `registerChildFeatureDetector`; Vue omits it (slots carry templates, not feature signals); Angular lacks it plus `registerFeaturePropKey`/`registerPostMountRefresh` (per-feature `@Input()` directives, no `{...rest}`; `ngAfterContentInit` covers post-mount). RULED OUT: uncalled registries for parity (dead code).
- INVARIANT: features import the adapter's PRIMARY entry, never the reverse (build cycle).
- INVARIANT: specs exercising a bridge MUST side-effect-import `'../features/<name>'` first, else methods return `undefined`.
- DECIDED: `createToolPanelRenderer` stays on the adapter (core primitive: `shell.ts` calls it for `<tbw-grid-tool-panel>`), as do `createEditor`/`createRenderer`; `createFilterPanelRenderer` stays inline (generic wrap).
- DECIDED (#354): `pinned-rows` slot-renderer wrappers MUST cache the host per renderer. WHY: `PinnedRowsPlugin.renderPanelSlot` skips rebuilds by reference-checking outputs (`rowOutputsCache` WeakMap); a fresh host forces remount. React/Vue cache `{host, portalKey}` → `renderToContainer(host, node, key)` + `PinnedRowsPluginWithCleanup` overriding `detach()`; Angular caches `{hostElement, componentRef}` → `setInput() + detectChanges()`. Specs: `libs/grid-{react,vue}/src/features/pinned-rows.spec.{tsx,ts}`, `libs/grid-angular/features/pinned-rows/src/cached-panel-renderer.spec.ts`.
- DECIDED (#353): renderer-callback configs get adapter-typed wrappers `Omit<CoreConfig,'rendererProp'> & { rendererProp?: CoreConfig['rendererProp'] | FrameworkReturn }`, exported under the core name via a `Core*` alias (`React*`/`Vue*`/`Angular*` names REMOVED in 3.0). Types: `FilterConfig`, `ColumnGroupDefinition`, `GroupingColumnsConfig`, `GroupingRowsConfig`, `PanelRender`, `PanelSlot`, `PinnedRowSlot`, `PinnedRowsConfig`, `ZonedPanelRender`, `MasterDetailConfig`, `ResponsivePluginConfig` (React `lib/feature-props.ts`; Vue `VNode` mirror; Angular `| Type<unknown>`). RUNTIME: React/Vue `createPluginFromFeature` override (`*PluginWithCleanup`, `detach()` → `removeFromContainer(key)`); Angular preprocessor + `mountComponentRenderer`.
  - INVARIANT (specs): assert `plugin.userConfig`, NOT `plugin.config` (set only post-`attach()`, `base-plugin.ts`); Angular specs MUST `import '@angular/compiler';` before the feature module, else `@angular/forms` throws `JIT compilation failed for PlatformLocation`.

## event props (drift-safety pattern)

- OWNS: React `EventProps<TRow>` + `EVENT_PROP_MAP` (`libs/grid-react/src/lib/event-props.ts`, bidirectional `satisfies`); Vue `FORWARDED_EVENTS` (`as const satisfies readonly (keyof DataGridEventMap)[]`) + `defineEmits` (sole payload types; `TbwGrid.vue`, `_emitsCoverCore`); Angular `output<T>()` + `eventOutputMap` (`directives/grid.directive.ts`, `satisfies` + `_assertEventOutputMapCoversCore`).
- INVARIANT: a new `DataGridEventMap` entry wires ALL THREE; to skip one, widen that adapter's `_IntentionallyOmittedEvents`.
- INVARIANT: NEVER widen `satisfies` to silence it — drop the prop or add the missing `declare module '../../core/types'` augmentation; check emit sites (`grep "_emit("`) — plugins and registry diverge silently.
- INVARIANT (guard shape): drift guards MUST be VALUE assignments — `const _x: [Missing] extends [never] ? true : ['msg', Missing] = true;`. `declare private x: <conditional>` or a bare `type _Assert = …` is inert (adapters-angular.md).
- INVARIANT: missing core public exports fail the ANGULAR build only — `@toolbox-web/grid/all` sees just `libs/grid/src/public.ts`; re-export new event detail types there.
- GOTCHA (Vue enforcement): `nx build grid-vue` (`vite-plugin-dts`) PRINTS SFC errors (`error TS2322`) but exits 0 (Volar flags in-editor); blocking needs `vue-tsc` + a `typecheck` target (`tsc` can't parse `.vue`). React's `typecheck` blocks (`bunx tsc -p libs/grid-react/tsconfig.lib.json --noEmit`, in `build.dependsOn`); Angular's is blocked by ng-packagr.
- DECIDED: `EventProps` is flat — one entry per event, even `onUndo`/`onRedo` (RULED OUT: `onUndoRedo`, bound to non-emitted `'undo-redo'`). Hand-maintained interface + `satisfies`, NOT a mapped type (TypeDoc renders those as `unknown`).
- TENSION (Angular): `eventOutputMap` keys aren't statically tied to `output<T>()` fields; a forgotten entry is a silent runtime bug.
- GOTCHA (Angular `_intentionallyOmittedEvents`): the guard proves only union COVERAGE, not that each rationale holds — re-verify when auditing (Jul 2026: `tree-expand` + `tree-load-start/end/error` wrongly parked; `tree-load-*` now on `GridTreeDirective`, `grid-tree.directive.ts`).
- DECIDED (Jul 2026): Angular's split (grid-level events on `Grid`, rest on per-feature directives) is idiomatic, NOT a gap. React/Vue put all on the root except internal-only `mount-external-editor`, `mount-external-view`, `column-reorder-request`.

## `before-edit-close` blur bridge

- DECIDED: editor `before-edit-close` → native `.blur()` on the focused input/textarea/select (NOT a synthetic `FocusEvent`; React 17+ delegates via bubbling `focusout`). WHY: Tab/programmatic row exits rebuild cell DOM synchronously (`#exitRowEdit(currentRow,false)` → `beginBulkEdit(nextRow)`), so `onBlur={commit}` / `@blur` / `(blur)` never fire. Angular parallel: `BaseGridEditor.onBeforeEditClose()`.
- DECIDED (#249): covers slot/JSX `createEditor` AND config-path wrappers — React `wrapReactEditor`; Vue `createConfigVNodeEditor`/`createConfigComponentEditor`/`createTypeEditor`; Angular `createComponentEditor` + template `createEditor`. Grid resolved via `queueMicrotask`. Installed by `features/editing` in the `editor-mount-hooks.ts` notifier (`attachBeforeEditCloseFlush` → `runEditorMountHooks`).
- CLEANUP: React threads `unsub` through `mountedPortals` (`cleanupConfigRootsIn`); Vue/Angular keep an `editorMountTeardowns` Map (container/host-keyed), swept in `releaseCell` + `destroy()`.
- TESTS: `react-column-config.spec.ts > flushes the focused input on before-edit-close`; `vue-grid-adapter.spec.ts > … for config-based VNode editor`; `angular-grid-adapter.spec.ts > before-edit-close blur bridge`.

## `releaseCell` DOM-recycle invariant (#250)

- DECIDED: core MUST call `grid.__frameworkAdapter?.releaseCell?.(cell)` BEFORE any sync wipe (`innerHTML=''` / `replaceChildren()`) of a cell holding adapter renderer DOM, else the next commit throws `NotFoundError: removeChild`.
- COVERED: `editor-injection.ts` (open editor); `renderVisibleRows` pool-shrink (`core/internal/rows.ts`); `_clearRowPool` (`grid.ts`); all guarded by `cell.firstElementChild`.
- TENSION: `GroupingRowsPlugin.ts` and `pinned-rows.ts` have `rowEl.innerHTML=''` paths without `releaseCell` (rely on `PortalBoundary`).
- TESTS: `rows.spec.ts > releases cells when pool shrinks` + per-adapter coverage.

## a11y tree is core-only

- INVARIANT: adapters set no `role`/`aria-*`/`tabindex`; renderer content mounts INSIDE core's `role="gridcell"` behind a semantics-free `display:contents` wrapper (React `div.react-cell-renderer`, Vue `div.vue-cell-renderer`, Angular bare `span`) → can't break `aria-required-parent`/`-children`.
- DECIDED (Aug 2026): axe gate `e2e/tests/accessibility.spec.ts` = **vanilla demo only** (adapter demos = identical core DOM); no per-adapter axe suites. Sole adapter a11y behaviour: `registerExternalFocusContainer` (overlay editors, axe-invisible), gated by `use-grid-overlay.spec.{tsx,ts}` + `base-overlay-editor.spec.ts`.
- INVARIANT: `conformance-report.mdx` is a procurement doc — every coverage claim MUST name an asserting spec.

## feature-prop bridging (gh #356)

- FLOW: feature props (React `<DataGrid selection="range" editing="dblclick" />`, Vue `:selection="'range'"`, Angular `[selection]="'range'"`) → `createPluginsFromFeatures()` → factories → `gridConfig.plugins`.
- DECIDED: all three derive `FeatureName = Exclude<keyof FeatureConfig, '__brand'>` from core's augmentable interface (third-party features auto-join). Strict-additive: `feature-registry.spec.ts`.
- INVARIANT (augmentation barrels): a new core feature goes into ALL THREE types-only `internal/feature-augmentations.ts` barrels + the React/Vue subpath in the same PR. Angular: `import type {} from '@toolbox-web/grid/features/<name>'`, pulled by `feature-registry.ts` via a **bare** `import './internal/feature-augmentations'` (tsc keeps it for ng-packagr). React/Vue: `export type { _Augmentation as _<Name>Augmentation } from '@toolbox-web/grid/features/<name>'`, ALSO in every `libs/grid-{react,vue}/src/features/*.ts` from its CORE subpath (`features/grouping-*`, NOT the plugin) — vite-plugin-dts STRIPS bare imports from `.d.ts`. Verify: `bun nx run-many -t typedoc -p grid-react,grid-vue,grid-angular`.
- SYMPTOMS: `TS2345: … '"selection"' … type 'never'` (Angular build) · `TS2322: Type '"filtering"' is not assignable to type 'FeatureName'` (`nx typedoc` only) · `TS2353` in a dist consumer importing `features/<name>`.
- DECIDED: `feature-prop-keys.ts` stores `Set<FeatureName>` + a lazily rebuilt frozen snapshot (`getFeaturePropKeys()` runs every `<DataGrid>`/`<TbwGrid>` render). `_AssertBuiltinCoversCore` enforces `BUILTIN ⊇ keyof FeatureConfig` minus `_KnownBuiltinGaps`.
- DECIDED (Aug 2026, audit I1): a key typed on `FeatureProps` (or a `TbwGrid.vue` prop) but missing from `BUILTIN_FEATURE_PROP_KEYS` is a **silent runtime drop** (typedoc `FeatureProps.mdx` advertises it); fixed for `rowDragDrop` (Vue), `stickyRows`. RULED OUT: parking such keys in `_KnownBuiltinGaps` (reserved for never-extracted `shell`).
- INVARIANT: all three extract the SAME key set — `grid-react/src/lib/feature-prop-keys.parity.spec.ts` reads sources as **text** (`readFileSync`; adapter↔adapter imports ESLint-banned): React/Vue `BUILTIN_FEATURE_PROP_KEYS`, Angular `addPlugin('…')` in `grid.directive.ts` `createFeaturePlugins()`. Equality modulo `FRAMEWORK_SPECIFIC` (**empty everywhere**), no duplicates, matching `_KnownBuiltinGaps`.
- TESTS: `post-mount-refresh-hooks.spec.ts`, `child-feature-detector.spec.ts`, `feature-prop-keys.spec.ts`, `feature-registry.spec.ts` (superset assertion in all 3).

## three-way parity

- STATE (Jul 2026; prop keys Aug 2026): 25/25 feature subpaths byte-identical (React/Vue `src/features/*.ts`, Angular `features/*/`); 5/5 accessors identical modulo `useGridX`↔`injectGridX`; 50/50 events (Oct 2026, incl. `history-change` #563); prop keys React 24 = Vue 24.
- INVARIANT: a public export in one adapter is mirrored in the SAME PR; `index.ts` is canonical. `AllFeatureProps<TRow>` identical React/Vue.
- NON-GAPS (do not "fix"): `<DataGrid>` vs `<TbwGrid>`; render props vs slots vs directives; `useGrid()` vs `injectGrid()`; `GridElementContext` vs `GRID_ELEMENT_KEY`; `PortalManager` vs `TeleportManager`; Angular attribute-passthrough column directive; Angular `visibleColumns` Signal vs `getVisibleColumns()`; `pinned` absent from React AND Vue.
- DECIDED (#289): cell/editor context generics default `TRow = unknown`, `TValue = any` (Vue `CellSlotProps`/`EditorSlotProps`; both `GridCellContext`/`GridEditorContext`). WHY: row safety + single-generic `CellSlotProps<MyRow>`. Tests: `slot-types.spec.ts`, `context-types.spec.ts`.
- DECIDED (#438): nested dotted-path `field` inherited (adapter `ColumnConfig` `Omit`s only renderers); defaulted `TField extends string = ColumnFieldKey<TRow>` generic (`GridConfig<Deal, NestedPaths<Deal>>`). GOTCHA: core `ColumnConfig` (aliased `BaseColumnConfig`) has only **2** params — `extends Omit<BaseColumnConfig<TRow, TField>, …>`; `<TRow, any, TField>` → ng-packagr `TS2707`. `ColumnFieldKey`/`NestedPaths` re-exported from all three `index.ts`; context `field` is `string`. Tests: `nested-field-parity.spec.ts`.
- REMOVED (v3, #261/#262): `SSRProps`/`ssr` (React+Vue → `AllFeatureProps<TRow> = FeatureProps<TRow>`; no `ssr`/`featurePlugins` skip in `data-grid.tsx`); Vue `makeFlushFocusedInput` re-export from `vue-grid-adapter.ts`.
- DECIDED (2026-08, `BaseGridEditorCVA` stale-value fix): Angular-only. WHY: only Angular has a library-owned resolver (`displayValue = currentValue() ?? cvaValue()`) that can contradict `commitBoth()`; React/Vue editors own raw `value` + `commit()`. Cause: `EditingPlugin` skips `source: 'user'` → `value` stale in `mode: 'row'`. `use-grid-overlay.ts` mirrors only `BaseOverlayEditor` positioning/dismissal.

## parity audit (2026-08, pre-3.0 sweep)

- INVARIANT (column props): expose ONLY props core reads — `parseLightDomColumns()` (`core/internal/columns.ts`): `field, type, header, sortable, width, minWidth|min-width, order, resizable, options`; plugins add `editable`, `hidden`+`lock-visible`, `pinned`. Core `ColumnConfig` has NO `align`/`maxWidth`.
- INVARIANT (tool panel props): `id, title, icon, tooltip, order` only (`plugins/shell/shell.ts` ~l.492). Vue `label` = alias for `title`.
- INVARIANT (accessors): all 5 feature accessors expose `isReady` in all 3; `useGrid`/`injectGrid` expose `ready()`. SINGLE impl per adapter: `useGridIsReady(getGrid)` (`@internal`; React `lib/use-grid-is-ready.ts` + Vue mirror), used by `useGrid` + accessors; never re-inline. Angular tracks inline (signals, no hook boundary). Guard: `src/features/accessor-parity.spec.ts` (React+Vue).
- REMOVED (no-ops, zero reads in `libs/grid/src`, non-breaking): Vue `TbwGridColumn.align`/`maxWidth`, `TbwGridToolPanel.position`/`width`; React `GridColumn.format`/`multi`, `data-has-format`/`data-has-options` markers.
- DECIDED: Vue `useGrid().gridElement` → `element`; `gridElement` kept as `@deprecated` alias of the same `Ref`. Vue `getConfig()` → `Promise<GridConfig<TRow>|null>`; `getVisibleColumns()` reads EFFECTIVE config, not the `gridConfig` prop; Angular `injectGrid().getConfig()` `await`s. NOT renamed: `useGridOverlay({ gridElement })`, core `ToolPanelContext.gridElement`.
- INVARIANT: two-adapter helpers are MIRRORED per adapter, not promoted into core — `serializeColumnOptions` + `ColumnOptions` = verbatim twins in `libs/grid-{react,vue}/src/lib/column-options.ts` (like `makeFlushFocusedInput`). DECIDED (2026-09): promotion to `core/internal/columns.ts` + `public.ts` REVERTED. WHY: +70 B gzip on `index.js` near `maxGzip: 50 kB` / `warnGzip: 45 kB` (`vite.config.ts` ~l.492), no core caller. Drift tripwire: round-trip test of core's CSV grammar in each `column-options.spec.ts`.
- INVARIANT (`plugins` escape hatch: `<DataGrid plugins>`, `:plugins`, `[plugins]`): when set, feature props/directives are SKIPPED; merge `[...manual, ...feature, ...configPlugins]`. Gate on PROVIDED (`manualPlugins !== undefined` / `if (manualPlugins)`), NEVER `.length > 0` — `plugins={[]}` is a deliberate override; a length test leaves a stale set on `[X] → []` (Angular `grid.directive.ts`, PR #473). Write side falls back to `userConfig.plugins` only if input absent.
- `canUndo()`/`canRedo()`: identical **call** shape (Angular signals callable); refreshed ONLY on `history-change` (#563; peer floor `^3.10.1` guarantees the event exists).
- Header triad: React `headerRenderer`/`headerLabelRenderer` ↔ Vue `#header`/`#headerLabel` ↔ Angular `*tbwHeader`/`*tbwHeaderLabel` (`directives/grid-column-header.directive.ts`; two `Map<HTMLElement, TemplateRef>` registries; walk up to `TBW-GRID-COLUMN`/`TBW-GRID-TYPE`).
- React feature registry exports (= Vue/Angular): `registerFeature`, `getFeatureFactory`, `getRegisteredFeatures`, `isFeatureRegistered`, `clearFeatureRegistry`, `createPluginFromFeature`, `FeatureName`, `PluginFactory`.
- GOTCHAS: (a) accessors must optional-chain `grid.on?.()`/`unsub?.()`; spec stubs omit `on`. (b) `SelectionChangeDetail['mode']` is `SelectionMode | SelectionMode[]` — always `Array.isArray()`-branch. Framework-specific gotchas: `adapters-{react,vue,angular}.md`.
