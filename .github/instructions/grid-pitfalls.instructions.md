---
applyTo: 'libs/grid/**'
---

# Grid Pitfalls

Counterintuitive behaviors and traps specific to the grid's DOM, rendering, and plugin system. **Check this list when something fails unexpectedly or "works but looks wrong."**

> Conventions and API guidance live in other instruction files. This file is strictly for gotchas.
> Architectural knowledge (how/why the system works, invariants, data flows, design rationale) belongs in `.github/knowledge/` files — not here. **A pitfall entry may include the minimum architectural context required to make the gotcha understandable** (e.g. naming the DOM container, hook, or scheduler phase involved), but it must not restate or duplicate the explanation that lives in a knowledge file. If a pitfall entry would otherwise need more than ~2 lines of background, link to the relevant `.github/knowledge/*.md` file instead of expanding the explanation here.

## Where related guidance lives

Many former pitfalls were promoted to canonical locations because they describe contracts, not gotchas. When you hit one of these symptoms, check there first:

| Symptom                                                                  | Where it lives now                                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Sort helper / indicator / `builtInSort` / `applySorts` / master-detail Set behavior | `grid-api.instructions.md` → "API & Plugin Conventions"                        |
| External focus container / overlay editor focus contract                 | `grid-api.instructions.md` → "Custom Editor / Overlay Focus Contract"          |
| User-string-to-`innerHTML` / `sanitizeHTML` rule                         | `grid-api.instructions.md` → "Security Contracts"                              |
| `requestRender()` vs `requestColumnsRender()` phase choice               | `grid-architecture.instructions.md` → "Centralized Render Scheduler"           |
| `background: currentColor` on `[data-icon]`                              | `css-conventions.instructions.md` → "Grid-Specific CSS Rules"                  |
| Column groups fragmentation, pinned-implicit-group split                 | `.github/knowledge/grid-core.md` → "column-groups"                             |
| Plugin hook ordering & `hookPriority`                                    | `.github/knowledge/grid-plugins.md` → "plugin-manager" INVARIANT               |
| Custom `renderRow` skipping column-level features                        | `.github/knowledge/grid-plugins.md` → "hook-system" INVARIANT                  |
| Scroll-driven DOM state surviving re-renders + virtualization            | `.github/knowledge/grid-core.md` → "scroll-driven-dom-state"                   |
| `emit` vs `broadcast` vs `emitPluginEvent` / direct plugin access / query/manifest pairing | `grid-api.instructions.md` → "Inter-Plugin Communication Conventions"          |

## Category Index

Use this index to jump to the relevant pitfalls when something fails. Each entry is numbered to match the list below.

| Category                          | Pitfalls |
| --------------------------------- | -------- |
| **DOM structure & containers**    | 1, 6     |
| **Touch & scroll**                | 2        |
| **Icons & CSS variables**         | 3        |
| **Custom rendering & cells**      | 4        |
| **Plugin hook ordering**          | 5        |
| **Virtualized DOM recycling**     | 7        |
| **Keyboard / clipboard / undo**   | 8, 9     |

1. **Plugin container access — `children[0]` is unreliable** — Use `this.gridElement.querySelector('.tbw-grid-root')` to find the grid's root container. Light DOM children (e.g. `<tbw-grid-column>`) are re-appended before `.tbw-grid-root`, making `children[0]` unpredictable.
2. **Touch scroll boundaries require `window.scrollBy`** — The grid sets `touch-action: none` on `.rows-viewport` and `.faux-vscroll`. Because this is evaluated at gesture start and cannot be changed mid-gesture, you **cannot** release scroll control back to the browser. Propagate surplus delta to the page via `window.scrollBy()`.
3. **Context menu CSS custom properties are not inherited** — `.tbw-context-menu` is appended to `document.body`, outside the `tbw-grid` element. CSS custom properties set on `tbw-grid` are NOT inherited. The `ContextMenuPlugin.copyGridStyles()` method bridges this gap by copying computed values as inline styles. When adding new icon or theme variables that the context menu uses, add them to `CSS_VARS_TO_COPY`.
4. **Cell `> *` overflow rule clips plugin wrapper elements** — Core CSS sets `.cell > * { overflow: hidden; text-overflow: ellipsis }` for text truncation. Plugin wrappers injected as cell children (e.g. `.tree-cell-wrapper`) inherit this clipping — icons and indentation get cut off, especially in narrow sticky columns. Override with `overflow: visible` on the specific wrapper element.
5. **`processColumns` wraps accumulate on repeated calls** — `processColumns` runs on every COLUMNS+ phase render. If a plugin wraps a column's `viewRenderer` (e.g. Tree wrapping with indent/toggle), it must cache the original unwrapped renderer and always wrap from that — otherwise each call nests another wrapper layer, causing duplicate icons/indentation.
6. **`.header` is nested — don't use it as an `insertBefore` reference inside `.tbw-scroll-area`** — The grid's sticky `.header` lives at `.tbw-scroll-area > .rows-body-wrapper > .rows-body > .header`, NOT as a direct child of `.tbw-scroll-area`. A plugin that does `scrollArea.insertBefore(myWrapper, header.nextSibling)` throws `NotFoundError` because the reference node isn't a child of the container. To inject a wrapper at the top of the scroll area, use `scrollArea.insertBefore(myWrapper, scrollArea.firstChild)` (the sticky header still sits visually at the top because `position: sticky` is scoped to `.rows-body`). PinnedRowsPlugin's top-slot rendering hit this; tests didn't catch it because the spec mock placed `.header` directly under `.tbw-scroll-area`.
7. **Conditional row attributes in `afterRender` must clear on the negative branch** — Virtualization recycles `.data-grid-row` DOM elements as the visible window changes (and as `flattenedRows` grows after expand/collapse). A plugin that does `if (cond) rowEl.setAttribute('aria-expanded', …)` without an `else rowEl.removeAttribute(…)` will leak stale attributes onto rows that reuse a previously-true element. TreePlugin hit this with `aria-expanded` (issue #282) — leaf child rows inherited `aria-expanded="true"` from a previously-expanded parent that occupied the same DOM slot. Same trap applies to any per-row `aria-*`, `data-*`, or class toggled in `afterRender` / `afterCellRender`.
8. **Grid-level `paste`/`keydown` handlers must skip editable targets** — A plugin that calls `event.preventDefault()` on every paste/keydown reaching the `tbw-grid` element will swallow keystrokes the user intended for an active editor input. Paste events bubble from the editor `<input>` (injected by EditingPlugin) up to the grid; if `ClipboardPlugin` (or any future plugin) calls `preventDefault()` unconditionally, Ctrl+V into a cell editor inserts nothing. Guard the handler with `target.closest('input, textarea, select, [contenteditable]')` and early-return — let the browser deliver the event natively. Same applies to any cross-plugin keyboard interception when EditingPlugin is loaded.
9. **For `Ctrl+Z` / `Ctrl+Y` on editable targets, defer to native browser history first** — Inputs/textareas/contenteditable elements have their own per-element undo stack. Unconditionally calling `preventDefault()` on Ctrl+Z robs the user of the ability to undo their typing or paste inside an open editor. Pattern (see `UndoRedoPlugin.#deferToNativeHistory`): when target is editable, install a one-shot capture-phase `beforeinput` listener watching for `inputType === 'historyUndo'`/`'historyRedo'` and queue a microtask. If the listener fires, the browser handled it — do nothing. If not, the native history is depleted; run the grid's own undo/redo. Return `true` from `onKeyDown` to stop other plugins, but DO NOT call `preventDefault()` — the browser default action must be allowed to fire so it can dispatch (or not dispatch) the `beforeinput`. `<select>` is excluded from "editable" because it has no undo history.
