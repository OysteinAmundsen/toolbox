---
domain: adapters
related: [grid-core, grid-features]
---

# Framework Adapters — Mental Model

## shared-architecture (all three follow same pattern)

- PATTERN: global singleton adapter registered at module load (React/Vue) or DI setup (Angular)
- FLOW: adapter registered → grid parses light DOM → user sets columns with framework components → processConfig() wraps components in bridge functions → grid calls renderer → bridge mounts framework component into cell container
- INVARIANT: adapter must be registered before grid parses light DOM
- INVARIANT: one adapter per app (singleton)

## adapter-interface (all implement)

```
processConfig(config) → config   // wrap framework components in render bridge functions
createComponentRenderer(component) → (ctx) => FrameworkNode
createComponentEditor(component) → (ctx) => FrameworkNode
releaseCell(element) → void      // cleanup when cell removed from DOM
```

## react-adapter

- OWNS: columnRegistries WeakMap, fieldRegistries Map (fallback), portal manager
- BRIDGE: React portal — `createPortal(component, container)` mounts React component into grid cell DOM
- FLOW: `<DataGrid columns={[{field:'status', renderer: StatusBadge}]}>` → processGridConfig wraps StatusBadge → grid calls renderer → PortalManager.render() mounts into cell container
- TENSION: WeakMap lookups fail on element recreation (framework re-renders create new DOM); field-name fallback lookup adds complexity
- KEY FILES: react-grid-adapter.ts, portal-bridge.ts, react-column-config.ts, use-grid.ts

## vue-adapter

- OWNS: columnRegistries WeakMap, fieldRegistries Map (fallback), teleport manager
- BRIDGE: Vue teleport — mounts VNode into grid cell container
- FLOW: `<TbwGrid :columns="[{field:'status', renderer: StatusBadge}]">` → processGridConfig wraps → teleport bridge → VNode rendered
- COMPONENT DETECTION: checks `__name` (SFC), `setup` function (Composition), `render` function (Options), or plain function (Functional)
- KEY FILES: vue-grid-adapter.ts, teleport-manager.ts, vue-column-config.ts, use-grid.ts, TbwGrid.vue
- INVARIANT: TbwGrid.vue MUST mount a `<TeleportManager>` and register it via `setTeleportManager(gridEl, handle)` before any teleport-bridge call. Without registration, `renderToContainer()` falls back to `createApp()` and silently severs `provide`/`inject`, Pinia, Router, i18n contexts. The fallback path is reachable when adapters render directly (e.g. tool panels, master-detail) — not just user-supplied cell renderers.
- INVARIANT: TbwGrid.vue MUST call `nextTick(() => { masterDetail.refreshDetailRenderer?.(); responsive.refreshCardRenderer?.(); refreshColumns(); refreshShellHeader(); })` in `onMounted`. Light-DOM children declared in the parent template (e.g. `<TbwGridToolPanel>`, `<TbwGridResponsiveCard>`) mount AFTER the grid's first scan; without these calls the framework children are silently ignored.
- DECIDED (Nov 2025, #237): `createToolPanelRenderer` uses a "wrapper-detach" pattern instead of a `sync` flag on teleport-bridge. The renderer creates an inner `<div class="vue-tool-panel">`, teleports VNodes into it, and on cleanup synchronously calls `wrapper.remove()` (detaches from container) BEFORE scheduling the async teleport-removal microtask. Rationale: Vue 3.5 has no `flushSync` equivalent (unlike React's `react-dom/flushSync`), so we cannot synchronously force teleport unmount. Detaching the wrapper makes the shell's downstream `container.innerHTML = ''` (accordion-collapse path in `shell.ts:830` and `shell-controller.ts:187`) a no-op, while Vue's deferred unmount still finds its children attached to the (now-orphaned) wrapper and unmounts cleanly without `NotFoundError`. The wrapper is GC'd after Vue completes. Localizes the fix without polluting `teleport-bridge.ts` / `teleport-manager.ts` with an opt-in flag that would have to be plumbed through every callsite.
- DECIDED (Nov 2025, #237 follow-up): Vue reuses core `createPluginsFromFeatures` from `@toolbox-web/grid/features/registry` — same source of truth as React's `use-sync-plugins`. Gets plugin dependency validation + dep-ordered instantiation for free. Do NOT reintroduce hand-rolled feature-plugin loops in the Vue adapter; new features get picked up automatically once registered.
- DECIDED (Nov 2025, #237 follow-up): `columns` prop accepts `ColumnShorthand<TRow>[]` (string | number | `ColumnConfig`) and a sibling `columnDefaults: Partial<ColumnConfig<TRow>>` prop merges before individual column props. Shorthand helpers live in `libs/grid-vue/src/lib/column-shorthand.ts` and mirror React's; the extra `applyColumnDefaults` helper handles the per-column merge.

## adapter-conformance (cross-adapter)

- OWNS: `CORE_CONSUMED_ADAPTER_METHODS` (grid core, `libs/grid/src/lib/core/adapter-conformance.ts`) — canonical list of 10 `FrameworkAdapter` methods that the grid core invokes. Re-exported from `public.ts`.
- INVARIANT: every adapter package has `<framework>-grid-adapter.conformance.spec.ts` that iterates `CORE_CONSUMED_ADAPTER_METHODS` and fails when any entry resolves to a non-function on the adapter instance (Vue/React) or prototype (Angular — ctor needs DI).
- INVARIANT: when adding a new hook the grid core depends on, append to `CORE_CONSUMED_ADAPTER_METHODS` so every adapter's conformance spec goes red until it's implemented (or explicitly documented as intentionally omitted).
- DECIDED (Nov 2025, #237 follow-up): only the `CORE_CONSUMED_ADAPTER_METHODS` constant is exported from `public.ts`. The helper functions `assertAdapterConformance`/`reportAdapterConformance` stay internal — exporting them pushed `index.js` over the (then 45 kB) gzipped budget. Even with the budget raised to 50 kB hard / 45 kB warn (Apr 2026), the same logic applies: each adapter spec inlines the 2-line filter; DRY is not worth the bundle cost.
- TENSION (Angular): spec MUST start with `import '@angular/compiler';` because the adapter transitively imports `@angular/forms` (partially-compiled, needs JIT at test time). Angular spec uses `GridAdapter.prototype` instead of `new GridAdapter()` because the constructor requires `EnvironmentInjector` / `ApplicationRef` / `ViewContainerRef`.
- FOUND (Nov 2025): this conformance test surfaced that React AND Angular were both missing `parseResponsiveCardElement` — fixed by adding a 1-line delegation to `createResponsiveCardRenderer` via `closest('tbw-grid')`.

## angular-adapter

- OWNS: viewRefs (embedded views), componentRefs, per-cell editor tracking
- BRIDGE: Angular embedded views — `createEmbeddedView(template, ctx)` + `syncRootNodes(viewRef, container)`
- FLOW: `<tbw-grid-column field="status"><app-badge *tbwRenderer="let value" /></tbw-grid-column>` → directive registers template → adapter creates embedded view → syncRootNodes appends to cell
- SYNC ROOT NODES: compares viewRef.rootNodes vs container.childNodes; replaces all if different (handles @if/@for control flow blocks)
- TENSION: two syntaxes (\*tbwRenderer structural directive vs tbw-grid-column-view nested directive) both supported
- TENSION: registration requires manual setup in AppComponent (not automatic like React/Vue)
- KEY FILES: angular-grid-adapter.ts, angular-column-config.ts, inject-grid.ts

## event-handling

| Framework | Pattern                                  | Mechanism                                          |
| --------- | ---------------------------------------- | -------------------------------------------------- |
| React     | props: `onCellClick={(d) => ...}`        | event-props.ts maps prop → native addEventListener |
| Vue       | emits: `@cell-click="handler"`           | props → native addEventListener                    |
| Angular   | outputs: `(cellClick)="handler($event)"` | directive wires native events to Angular outputs   |

- DECIDED: editor `before-edit-close` → native `.blur()` on focused input. React adapter (`react-grid-adapter.ts`) and Vue adapter (`vue-grid-adapter.ts`) both attach a `before-edit-close` listener on the host `<tbw-grid>` from `createEditor`, and on fire call `focused.blur()` if the active element is an input/textarea/select inside the editor container. WHY: Tab and programmatic row exits rebuild the cell DOM synchronously, so editors written with `onBlur={commit}` / `@blur="commit"` would otherwise lose pending input. Native `.blur()` is required (not `dispatchEvent(new FocusEvent('blur'))`) because React 17+ delegates focus events at the root by listening to the bubbling `focusout`, not the non-bubbling `blur` — `.blur()` dispatches both. Angular's `BaseGridEditor.onBeforeEditClose()` hook is the parallel pattern (subclasses override to call `commitValue()`). Cleanup: per-container teardown in `releaseCell` + bulk teardown in `dispose()`/`cleanup()`.
- DECIDED (Apr 2026, follow-up to PR #249): The `before-edit-close` → `.blur()` bridge MUST also be wired into the **config-path** editor wrappers, not only the slot/JSX `createEditor` path. Specifically: React `wrapReactEditor` (in `react-column-config.ts`), Vue `createConfigVNodeEditor` + `createConfigComponentEditor` + `createTypeEditor` (via shared `attachBeforeEditCloseFlush` helper), and Angular `createComponentEditor` + the template path `createEditor` (via shared `attachBeforeEditCloseFlush` helper). WHY: Tab from the last editable cell of a row triggers `EditingPlugin.preventDefault()` + `#exitRowEdit(currentRow, false)` → `beginBulkEdit(nextRow)` synchronously — the focused input never blurs naturally, so editors written with `onBlur={commit}` / `@blur="commit"` / `(blur)="commit()"` silently discard pending input. The grid element is resolved lazily via `queueMicrotask` because the editor container is appended to the cell _after_ the wrapper returns. Cleanup: React threads an `unsub` field through `mountedPortals` entries (called in `cleanupConfigRootsIn`); Vue/Angular store unsubs in an `editorBeforeCloseUnsubs` Map keyed by container/host, swept in `releaseCell` (cell-scoped) and `destroy()` (bulk). Tests: `react-column-config.spec.ts > flushes the focused input on before-edit-close`, `vue-grid-adapter.spec.ts > flushes the focused input on before-edit-close for config-based VNode editor`, `angular-grid-adapter.spec.ts > before-edit-close blur bridge` (template + component + releaseCell).
- DECIDED (issue #250 — React renderer+editor `removeChild` crash): The grid core MUST call `grid.__frameworkAdapter?.releaseCell?.(cell)` BEFORE any synchronous wipe (`innerHTML = ''` / `replaceChildren()`) of a cell that may contain adapter-managed renderer DOM. `editor-injection.ts` does this when opening an editor. WHY: a `cell.innerHTML = ''` removes React-mounted `.react-cell-renderer` nodes without notifying React; the fiber tree still references the orphan DOM, and the next React commit (e.g. user `setRows` from `onCellCommit`) throws `NotFoundError: Failed to execute 'removeChild' on 'Node'`. The React adapter's `releaseCell` resolves the cell's portal containers via `cellEl.querySelectorAll('.react-cell-renderer, .react-cell-editor')` + a `containerToKey` reverse index (O(cell descendants), not O(total portals)), calling `removeFromContainer(key, { sync: true })` + `untrackPortal(key)`, then `cleanupConfigRootsIn(cellEl)` (which uses the same DOM-scoped lookup against a `Map<HTMLElement, MountedEntry>` keyed by container). DEFENSE IN DEPTH: both `wrapReactRenderer` (in `react-column-config.ts`) and `createRenderer` (in `react-grid-adapter.ts`) validate `cellEl.contains(cached.container)` before reusing a `cellCache` WeakMap entry; if detached, they sync-tear-down the stale React root and create a fresh container. Tests: `react-column-config.spec.ts > evicts cache and creates fresh container...`, `react-grid-adapter.spec.ts > evicts stale cache...` and `> also unmounts renderer portals inside the cell`.
- DECIDED (issue #250 follow-up — row-recycle path): The `releaseCell` invariant ALSO covers the two grid-core paths that detach cell DOM **without** opening an editor: (1) the pool-shrink branch in `renderVisibleRows` (`libs/grid/src/lib/core/internal/rows.ts`) calls `releaseCell` for each cell of any pool element that's about to be `el.remove()`-d; (2) `_clearRowPool` (`libs/grid/src/lib/core/grid.ts`) walks every row's children and calls `releaseCell` before `_bodyEl.innerHTML = ''`. Both are guarded by `cell.firstElementChild` so default-rendered cells skip the call. WHY: when a consumer's `onCellCommit` calls `setRows` with a row whose `getRowId` returns a different value (e.g. swapping a temporary negative id for a server-assigned positive one), `renderVisibleRows`'s recycle path may shrink the pool, and config-driven viewport changes (column add/remove, light-DOM re-parse) call `_clearRowPool` — both detach renderer-portal containers without going through `editor-injection.ts`. Without the per-cell `releaseCell`, the React adapter's `portalsRef` still tracks those containers; the next-frame `schedulePrune` rAF in `portal-manager.tsx` finds them disconnected and `flushSync(forceRender)` throws `removeChild`. Tests: `rows.spec.ts > releases cells when pool shrinks`. SECONDARY DEFENSE: `portal-manager.tsx`'s `schedulePrune` wraps `flushSync(forceRender)` in `try/catch` and falls back to a non-sync `forceRender` so any future invariant slip is degraded to a tiny memory blip rather than a crash.

## feature-prop-bridging (all three)

- All adapters expose feature props that auto-load plugins
- React: `<DataGrid selection="range" editing="dblclick" />`
- Vue: `<TbwGrid :selection="'range'" :editing="'dblclick'" />`
- Angular: `<tbw-grid [selection]="'range'" [editing]="'dblclick'">`
- MECHANISM: feature props passed to createPluginsFromFeatures() → factory creates plugins → added to gridConfig.plugins

## programmatic-access

| Framework | API                          | Returns                                           |
| --------- | ---------------------------- | ------------------------------------------------- |
| React     | `useGrid<TRow>()` hook       | ref, isReady, element, getConfig(), forceLayout() |
| Vue       | `useGrid<TRow>()` composable | same (with Ref wrappers)                          |
| Angular   | `injectGrid()` function      | same interface                                    |

## cross-adapter-tensions

- REGISTRATION TIMING: React/Vue auto-register at module load (synchronous); Angular requires explicit DI setup
- WEAKMAP FALLBACK: dual lookup (WeakMap → field name → factory) needed because framework re-renders can create new DOM elements
- PORTAL/TELEPORT OVERHEAD: mounting framework components into web component cells requires bridge layer that manages lifecycle outside framework's component tree

## angular-overlay-editors (BaseOverlayEditor)

- OWNS: panel element (moved to `document.body` to escape grid overflow clipping), `_abortCtrl: AbortController` for all document-level / grid-level listener cleanup
- DISMISSAL SIGNALS (all call abstract `onOverlayOutsideClick()`, subclass decides commit vs cancel):
  - `pointerdown` on document outside panel + host
  - `tbw-scroll` CustomEvent on the closest `<tbw-grid>` ancestor (dogfoods the public event)
  - Focus observer: cell losing `cell-focus` class via MutationObserver → `hideOverlay()` (different path — cancel, not commit)
- INVARIANT: all listeners share the same `_abortCtrl.signal` so `teardownOverlay()` releases everything in one abort
- INVARIANT: handler must guard on `_isOpen && _panel` — listener is attached eagerly in `initOverlay()` before the panel is shown
- FLOW: `initOverlay(panel)` → AbortController created → pointerdown listener on document → `tbw-scroll` listener on grid host → panel moved to body → registerExternalFocusContainer(panel)
- TENSION: anchor positioning uses CSS Anchor (`anchor-name`) when supported, else `_positionWithJs()` — JS fallback only runs on open, so scroll-while-open without dismissal would float the panel at a stale position. Scroll-dismissal sidesteps needing a live reposition loop.
- DECIDED (Apr 2026, #234 follow-up): scroll → dismiss (call `onOverlayOutsideClick()`), not scroll → reposition. Rationale: (a) same semantics as click-outside preserves subclass commit/cancel contracts, (b) avoids coupling overlay to grid scroll cadence, (c) consumes the public `tbw-scroll` API — no shadow-DOM reach-arounds, validates the API dogfood-style.

## angular-adapter-testing

- INVARIANT: the angular adapter project deliberately avoids `TestBed`. Bootstrapping the platform-browser-dynamic compiler in unit tests adds 3-5s per spec file and is unnecessary for component-free logic. Spec files document this with a comment near the imports.
- PATTERN: for classes constructed via `inject()` (e.g. `GridTypeRegistry`, `BaseOverlayEditor`), instantiate without running the constructor: `Object.create(MyClass.prototype)` and manually seed the few private fields the constructor would initialise.
- PATTERN: for the `AngularGridAdapter` itself, mock just `createComponent` from `@angular/core` and the seven template-registry getter modules (`./directives/grid-detail-view.directive`, `./directives/grid-responsive-card.directive`, `./directives/grid-tool-panel.directive`, `./directives/grid-column-view.directive`, `./directives/grid-column-editor.directive`, `./directives/structural-directives`, `./grid-type-registry`). The mocked `createComponent` MUST read its `hostElement` option onto `componentRef.location.nativeElement` so the adapter's `cellEl.contains(ref.location.nativeElement)` cleanup checks succeed.
- PATTERN: for directives that use `inject()` + `effect()` + `input()` field initialisers (e.g. `GridFormArray`), `vi.mock('@angular/core', …)` to replace the three primitives with stubs: `inject` dispatches via a per-test resolver, `effect` is a no-op (post-init behaviour is exercised through `grid.on(…)` callbacks captured via `vi.fn().mockImplementation`), `input`/`input.required` returns a getter with a `__setValue` setter so tests can drive signal values. Then `new MyDirective()` works without an Angular injection context.
- DECIDED (Nov 2025, #237 follow-up): when CI coverage is computed by V8, only loaded files appear in the denominator. PR #237's `angular-grid-adapter.conformance.spec.ts` added an `import { GridAdapter }` that pulled the adapter + every directive into the report and dropped the project from ~80% to ~33%. Restoration path is to write real unit tests using the patterns above, NOT to lower the threshold or exclude files. `grid.directive.ts` (the public `<tbw-grid>` directive) is intentionally NOT exercised by unit tests — it is a thin Angular wrapper covered end-to-end by the demo apps and Playwright; importing it would double the project size visible to V8.
