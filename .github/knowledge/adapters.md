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
