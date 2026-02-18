# @toolbox-web/grid Roadmap

This document outlines planned features and improvements for the grid component, organized by priority (lowest effort + highest value first).

## Features

> [!NOTE] Priority Levels
>
> - 🟠 **P1 - Do First**: Low effort, high value - quick wins
> - 🟡 **P2 - Next Up**: Medium effort, good value
> - 🟢 **P3 - Nice to Have**: Higher effort or niche use cases
> - ⚪ **P4 - Deferred**: Complex features requiring significant design work

**Core (Completed):**

- [x] Column resizing
- [x] Column State Events
- [x] Controlled Plugin API (protected accessors, `GridElementRef` interface)
- [x] CSS theming
- [x] External cell renderers
- [x] Grid Shell / Tool Panels
- [x] Inline cell editing
- [x] Keyboard navigation
- [x] Row Animation API ([#73](https://github.com/OysteinAmundsen/toolbox/issues/73))
- [x] Row virtualization

**Core (Planned):**

| Feature                   | Priority | Effort | Issue                                                       |
| ------------------------- | -------- | ------ | ----------------------------------------------------------- |
| Print Layout Mode         | � P1     | Medium | [#70](https://github.com/OysteinAmundsen/toolbox/issues/70) |
| RTL Support               | 🟡 P2    | Medium | [#71](https://github.com/OysteinAmundsen/toolbox/issues/71) |
| Dynamic Row Heights       | 🟢 P3    | High   | [#55](https://github.com/OysteinAmundsen/toolbox/issues/55) |
| Column Spanning (colSpan) | ⚪ P4    | High   | -                                                           |
| Row Spanning (rowSpan)    | ⚪ P4    | High   | -                                                           |

**Plugins (Completed):**

- [x] Cell/Row/Range selection (`selection`)
- [x] Clipboard copy/paste (`clipboard`)
- [x] Column filtering (`filtering`)
- [x] Column header grouping (`grouping-columns`)
- [x] Column pinning (`pinned-columns`)
- [x] Column reordering (`reorder`)
- [x] Column virtualization (`column-virtualization`)
- [x] Column visibility panel (`visibility`)
- [x] Context menus (`context-menu`)
- [x] Export - CSV, Excel, JSON (`export`)
- [x] Footer aggregations / Pinned rows (`pinned-rows`)
- [x] Master/Detail rows (`master-detail`)
- [x] Pivot tables (`pivot`)
- [x] Quick filter / Global search (`quick-filter`) - [#66](https://github.com/OysteinAmundsen/toolbox/issues/66)
- [x] Responsive card layout (`responsive`) - [#56](https://github.com/OysteinAmundsen/toolbox/issues/56)
- [x] Row drag & drop (`row-reorder`) - [#52](https://github.com/OysteinAmundsen/toolbox/issues/52)
- [x] Row grouping with aggregations (`grouping-rows`)
- [x] Server-side data source (`server-side`)
- [x] Single & multi-column sorting (`multi-sort`)
- [x] Row pinning (`pinned-rows`)
- [x] Tree data support (`tree`)
- [x] Undo/Redo (`undo-redo`)

**Plugins (Planned - sorted by priority):**

| Plugin                     | Priority | Effort | Value | Issue                                                       |
| -------------------------- | -------- | ------ | ----- | ----------------------------------------------------------- |
| Column Menu                | 🟡 P2    | Medium | High  | [#68](https://github.com/OysteinAmundsen/toolbox/issues/68) |
| Conditional Formatting     | 🟡 P2    | Medium | High  | [#69](https://github.com/OysteinAmundsen/toolbox/issues/69) |
| Real-time Data (WebSocket) | 🟢 P3    | Medium | Niche | [#79](https://github.com/OysteinAmundsen/toolbox/issues/79) |

**Framework Adapters:**

Framework adapters enable idiomatic integration with popular JavaScript frameworks, allowing framework components as cell renderers/editors, proper lifecycle management, and type-safe APIs.

| Package                     | Framework   | Priority | Effort | Status      | Issue |
| --------------------------- | ----------- | -------- | ------ | ----------- | ----- |
| `@toolbox-web/grid-angular` | Angular 17+ | ✅       | -      | Complete    | -     |
| `@toolbox-web/grid-react`   | React 18+   | ✅       | -      | Complete    | -     |
| `@toolbox-web/grid-vue`     | Vue 3       | ✅       | -      | Complete    | -     |
| `@toolbox-web/grid-svelte`  | Svelte 4/5  | 🟢 P3    | Medium | Not started | -     |
| `@toolbox-web/grid-solid`   | Solid       | 🟢 P3    | Medium | Not started | -     |

**Adapter Enhancements (Planned):**

| Feature                    | Adapter | Priority | Effort | Issue                                                       |
| -------------------------- | ------- | -------- | ------ | ----------------------------------------------------------- |
| Reactive Forms Integration | Angular | 🟡 P2    | Medium | [#80](https://github.com/OysteinAmundsen/toolbox/issues/80) |

> [!NOTE]
> The core grid works in all frameworks without adapters for basic usage. Adapters become valuable when you need:
>
> - Framework components as cell renderers/editors
> - Reactive bindings (Vue refs, Svelte stores, Solid signals)
> - Framework-idiomatic event handling
> - Proper component lifecycle with cell recycling (virtualization)

---

## ✅ Recently Completed

### Row Animation API [core] ✅

Visual feedback for row changes with configurable animations.

**API**:

- `animateRow(index, type)` - Animate a single row by index
- `animateRows(indices, type)` - Animate multiple rows at once
- `animateRowById(id, type)` - Animate a row by its ID
- Animation types: `'change'` (flash), `'insert'` (slide-in), `'remove'` (fade-out)
- `gridConfig.animation` for global animation settings (mode, style, duration)
- Respects `prefers-reduced-motion` media query
- EditingPlugin automatically triggers `'change'` animation on cell commit

**Status**: ✅ Complete - [#73](https://github.com/OysteinAmundsen/toolbox/issues/73)

---

### Column State Events [core] ✅

Emit events when column layout changes and provide API to restore state. Consumers control where/how to persist (localStorage, sessionStorage, cookies, database, etc.).

**API**:

- `column-state-change` event emitted on resize, reorder, visibility, sort, or pinning changes
- `getColumnState(): GridColumnState` method to retrieve current layout
- `columnState` property setter to restore layout on startup
- `resetColumnState()` method to clear all customizations
- Plugins can contribute their own state via `collectColumnState()` / `applyColumnState()` hooks

**Status**: ✅ Complete

---

### Grid Shell / Tool Panels [core] ✅

Extends `tbw-grid-root` to support optional shell features:

- **Shell header bar**: Optional row above column headers with title (left), custom content (center), toolbar buttons (right)
- **Tool panel sidebar**: Collapsible panel that plugins can register content into (left or right position)
- **Plugin integration**: Plugins register tool panels via `getToolPanels()` hook
- **Consumer extensibility**: API for custom tool panels and toolbar buttons
- **Light DOM configuration**: `<tbw-grid-header>`, `<tbw-grid-header-content>`, `<tbw-grid-tool-button>`

**Behavior**:

- If no title configured and no plugins register tool panels → renders exactly as before (no visible shell chrome)
- Shell header bar only appears if title, header content, or tool panels are configured
- Tool buttons only appear if plugins have registered panels or custom buttons are configured

**Status**: ✅ Complete

---

## 🟠 P1 - High Priority

### Print Layout Mode [core]

Optimized rendering for printing that shows all rows without virtualization. Requires ability to temporarily disable core virtualization.

**Use case**: Generating printable reports directly from the grid.

**Status**: Not started - [#70](https://github.com/OysteinAmundsen/toolbox/issues/70)

---

## 🟡 P2 - Medium Priority

### Angular Forms Integration [grid-angular]

Seamless integration with Angular Reactive Forms (FormArray) and future Signal Forms (Angular 21+).

**API**:

- `[formArray]` directive for Reactive Forms integration
- `[formModel]` directive for Signal Forms (Phase 2, after Angular 21 GA)
- Automatic row data extraction and cell commit → form update
- Validation CSS classes (`.form-invalid`, `.form-dirty`, `.form-touched`)
- Enhanced editor context with `FormControl` / `FieldTree` access

**Status**: Not started - [#80](https://github.com/OysteinAmundsen/toolbox/issues/80)

---

### Plugin Event Bus & Query System [core] ✅

Formalized pub/sub system for plugin-to-plugin communication, plus a query system for synchronous state retrieval.

**Two Systems**:

- **Event Bus (Change Streams)**: Plugins emit/subscribe to typed events via `emitPluginEvent()` / `onPluginEvent()`
- **Query System (Current State)**: Plugins declare queries in their manifest and respond via `handleQuery()`

**API**: Plugins emit/subscribe to typed events through the plugin manager:

```typescript
// In a plugin - emit to other plugins (not DOM)
this.emitPluginEvent('filter-change', { field: 'name', value: 'Alice' });

// Subscribe to plugin events
this.onPluginEvent('selection-cleared', (detail) => { ... });

// Query system - synchronous state retrieval
handleQuery(query: PluginQuery): unknown {
  if (query.type === 'canMoveColumn') return this.canMoveColumn(query.context);
}
```

**Use case**: Decouples plugins; allows third-party plugins to react to built-in plugin events without direct imports.

**Status**: ✅ Complete - [#83](https://github.com/OysteinAmundsen/toolbox/issues/83)

---

### RTL Support [core]

Right-to-left text direction support for Arabic, Hebrew, and other RTL languages. Requires changes to CSS layout, sticky positioning, and scroll handling.

**Use case**: Applications targeting RTL language markets.

**Status**: Not started - [#71](https://github.com/OysteinAmundsen/toolbox/issues/71)

---

## 🟢 P3 - Low Priority

### Real-time Data Support [plugin]

Extend ServerSidePlugin to support WebSocket and Server-Sent Events for live data streaming.

**API**:

- WebSocket adapter with reconnection and backoff
- SSE adapter for simpler use cases
- Partial row updates (update specific fields)
- Automatic row animation on updates
- Optimistic updates with server reconciliation

**Use case**: Stock tickers, live dashboards, collaborative editing.

**Status**: Not started - [#79](https://github.com/OysteinAmundsen/toolbox/issues/79)

---

### Dynamic Row Heights [core]

Support variable row heights via callback function, enabling content-based sizing.

**Use case**: Multi-line text, images, or complex cell content.

**Status**: Needs discussion - [#55](https://github.com/OysteinAmundsen/toolbox/issues/55)

---

## ⚪ P4 - Deferred

These features require significant design work to handle complex interactions with virtualization, plugins, and performance. Specs exist but implementation is deferred.

### Column Spanning (colSpan) [core]

Allow cells to span multiple columns horizontally. Deferred due to complexity around column reordering interactions, inline style performance concerns, and the fact that primary use cases (full-width headers, summary rows) are already solved by row grouping and pinned rows plugins.

**Use case**: Summary rows, section headers, grouped data displays.

**Status**: Deferred — needs design review

---

### Row Spanning (rowSpan) [core]

Allow cells to span multiple rows vertically. Deferred due to deep integration challenges with virtualization (spans above viewport must remain visible), absolute positioning complexity, and interactions with sorting/filtering/grouping.

**Use case**: Financial reports, timesheets, merged row cells.

**Status**: Deferred — needs design review

---

## Out of Scope

The following features are explicitly **not planned**:

### ❌ Integrated Charts

**Reason**: There are excellent charting libraries available (Chart.js, D3, ECharts, etc.) that will always do a better job than a grid component could. Instead, we support:

- **Selection plugin**: Select data ranges that consumers can pass to any charting library
- **Custom cell renderers**: Mount any charting library's components inside grid cells via external view mounting

---

## Contributing

Have a feature request? Open an issue with the `enhancement` label describing your use case.
