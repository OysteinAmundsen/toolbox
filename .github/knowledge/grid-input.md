---
domain: grid-input
related: [grid-core, grid-render-pipeline, grid-plugins-catalog-ui, grid-features]
---

# Grid Input & Pointer — Mental Model

`libs/grid/src/lib/core/internal/`. Pointer modality detection, drag capture/promotion, and the coarse long-press arbitration policy. Touch-input epic **#302**.

- Keyboard nav / focus / a11y → grid-core.md § focus & a11y.
- Wheel + faux-scrollbar plumbing (`touch-scroll.ts#setupWheelScrollListeners`) → grid-render-pipeline.md § virtualization-manager.
- Consumer plugins (Selection, ContextMenu, reorder/DnD) → grid-plugins-catalog-ui.md.

Read order for "my gesture doesn't fire on touch": long-press priority policy (is another handler claiming it?) → pointer-drag promotion FLOW → pointer-modality.

## pointer-modality (`core/internal/pointer-modality.ts`)

- OWNS: `PointerModality` (`'fine' | 'coarse'`), `getPrimaryPointer()`, `onPointerModalityChange(cb)`. **NOT exported from `public.ts`** — internal. `@since 3.5.0`; infra for touch-input epic #302 (#307). Tests: `pointer-modality.spec.ts`.
- INVARIANT: one lazily-created shared `MediaQueryList` for `(pointer: coarse)` — a single OS listener regardless of subscriber count; unsubscribe idempotent (`removed` flag). SSR / happy-dom safe: guard `typeof globalThis.matchMedia !== 'function'` → `'fine'`, and fall back to legacy `addListener`.
- RULE: plugins and features MUST use this module, not `matchMedia` directly.

## pointer-drag (`core/internal/pointer-drag.ts`)

- OWNS: `startPointerDrag(startEvent, captureTarget, handlers, options?) => cancelFn`, `PointerDragHandlers` (`onMove`, `onEnd`, `onPromote?`, `onCancel?`), `PointerDragOptions` (`threshold?`, `longPressDuration?`, `longPressSlop?` default 8). **NOT in `public.ts`** — internal. `@since 3.5.0`; #303 created it (not #228), generic for #228 DnD reuse.
- INVARIANT: `setPointerCapture` ONLY — no `document`/`window` `pointermove`/`pointerup`; sole exception is a capture-phase `document` `keydown` for Escape-to-abort. Capture survives virtualization re-renders that would detach the drag source.
- INVARIANT: capture is claimed at **promotion**, never on `pointerdown` — a captured pointer retargets `mouseup`/`click`/`dblclick` to the capture element, killing every `closest()`-based click feature (broke dblclick-to-edit in #303). Capture failure at promotion → `cancel()`.
- INVARIANT: `captureTarget` must be a stable element (the resize _handle_, not the header cell); `ResizeController.start` takes a 4th param `captureTarget?: Element`. Re-entrancy guarded by a module-level `WeakMap<Element, Set<number>>` of active pointerIds. `touch-action: none` is set on the target only inside `onPromote` (never on `pointerdown`, else swipe-to-scroll is swallowed), restored in `onEnd`/`onCancel`.
- INVARIANT: `buildCellMouseEvent` falls back to `document.elementFromPoint` whenever the resolved target has no `[data-col]` ancestor — not merely when outside `renderRoot`, since capture retargets moves to `renderRoot` itself and every move then reports the anchor cell.
- FLOW (promotion): no threshold/long-press → synchronous; `threshold > 0` → first move past distance; `longPressDuration > 0` → timer, and an earlier move beyond `longPressSlop` **cancels the drag** (it was a scroll). `onPromote` fires at all three sites.
- DECIDED (#303, Jul 2026): fine-vs-coarse uses per-event `e.pointerType` (`touch`/`pen` → coarse, `mouse` → fine), not `getPrimaryPointer()`. WHY: hybrid devices (Surface) report `(pointer: coarse)` while a mouse is in use; `getPrimaryPointer()` is only the fallback for synthetic events lacking `pointerType`.
- Consumers: `resize.ts` (column resize), `plugins/shell/shell.ts` (tool-panel splitter), `event-delegation.ts` (cell-range paint, `LONG_PRESS_MS = 400` coarse, `DRAG_THRESHOLD_PX = 3` fine — the threshold keeps plain clicks from capturing). Tests: `pointer-drag.spec.ts` (24), `resize.spec.ts` (8); happy-dom does not route pointer capture, so specs MUST stub `setPointerCapture`/`hasPointerCapture`/`releasePointerCapture` on the capture target and dispatch pointer events **directly on it**.

## long-press priority policy (#307 / touch-input epic #302)

- DECIDED (#307, Jul 2026; implemented #303/#304/#306): coarse long-press order — (1) **header → column header menu** (blocked on #270; falls through to context menu); (2) **row + `SelectionPlugin` `mode: 'row'` → selection mode** (#304); (3) **cell + `SelectionPlugin` `mode: 'cell'|'range'` → range paint** (#303); (4) **otherwise → `ContextMenuPlugin`** (#306). Every future long-press handler MUST honour it — see `apps/docs/src/content/docs/grid/guides/touch-input.mdx` and the `ContextMenuPlugin` JSDoc.
- DECIDED (#306): the fallback is **passive, not a polyfill** — browsers already synthesise `contextmenu` from long-press, so `ContextMenuPlugin` needs no touch code. `handlePointerDown`'s `onPromote` calls `suppressNextContextMenu(renderRoot)` **only when `dispatchDown()` returned true** (a plugin claimed the press), so the default is correct without per-plugin opt-in. `core/internal/event-delegation.ts`.
- INVARIANT: `suppressNextContextMenu` is one-shot and time-boxed (`CONTEXT_MENU_SUPPRESS_MS = 700` vs browser synthesis ~500 ms), registered on `document` **capture phase** so it precedes `ContextMenuPlugin`'s listener (on `.tbw-grid-root`), and removes itself on first event _or_ timeout. It MUST NOT latch — a later right-click must still open the menu. 5 tests in `event-delegation.spec.ts` → `describe('long-press → contextmenu priority (#306)')`; real-browser timing only in `e2e/tests/touch-input.spec.ts` (unrun; happy-dom never synthesises `contextmenu` from touch).
