# @toolbox-web/grid Roadmap

This document outlines planned features and improvements for the grid component, organized by priority based on expected user demand.

## Features

> [!NOTE] Priority Levels
>
> - 🔴 **P0 - Critical**: Highly requested features that significantly expand use cases
> - 🟠 **P1 - High**: Important features that improve usability and workflows
> - 🟡 **P2 - Medium**: Nice-to-have features that enhance the experience
> - 🟢 **P3 - Low**: Specialized features for specific use cases
> - ⚪ **P4 - Deferred**: Complex features requiring significant design work

**Core:**

- [x] - Column resizing
- [x] - Column State Events
- [x] - CSS theming
- [x] - External cell renderers
- [x] - Grid Shell / Tool Panels
- [x] - Inline cell editing
- [x] - Keyboard navigation
- [x] - Row virtualization
- [ ] - Column Spanning (colSpan) - ⚪ P4
- [ ] - Print Layout Mode - 🟡 P2
- [ ] - Row Animation - 🟢 P3
- [ ] - Row Spanning (rowSpan) - ⚪ P4
- [ ] - RTL Support - 🟡 P2

**Plugins:**

- [x] - Cell/Row/Range selection (`selection`)
- [x] - Clipboard copy/paste (`clipboard`)
- [x] - Column filtering (`filtering`)
- [x] - Column header grouping (`grouping-columns`)
- [x] - Column pinning (`pinned-columns`)
- [x] - Column reordering (`reorder`)
- [x] - Column virtualization (`column-virtualization`)
- [x] - Column visibility panel (`visibility`)
- [x] - Context menus (`context-menu`)
- [x] - Export - CSV, Excel, JSON (`export`)
- [x] - Footer aggregations / Pinned rows (`pinned-rows`)
- [x] - Master/Detail rows (`master-detail`)
- [x] - Pivot tables (`pivot`)
- [x] - Row grouping with aggregations (`grouping-rows`)
- [x] - Server-side data source (`server-side`)
- [x] - Single & multi-column sorting (`multi-sort`)
- [x] - Row pinning (`pinned-rows`)
- [x] - Tree data support (`tree`)
- [x] - Undo/Redo (`undo-redo`)
- [ ] - Cell Flashing - 🟢 P3
- [ ] - Column Menu - 🟡 P2
- [ ] - Conditional Formatting - 🟡 P2
- [ ] - CSV/Excel Import - 🟢 P3
- [ ] - Fill Handle (Excel-style) - 🟠 P1
- [ ] - Quick Filter / Global Search - 🟠 P1
- [ ] - Row Drag & Drop - 🟡 P2

---

## ✅ Recently Completed

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

### Quick Filter / Global Search [plugin]

A single search input that filters across all visible columns simultaneously. Lives in the Grid Shell header bar and delegates to the existing `filtering` plugin.

**Depends on**: Grid Shell / Tool Panels

**Use case**: Users expect to quickly find data without configuring per-column filters.

**Status**: Not started

---

### Fill Handle (Excel-style) [plugin]

Drag the corner of a cell to fill adjacent cells with values or patterns.

**Use case**: Data entry workflows, copying values, and auto-incrementing.

**Status**: Not started

---

## 🟡 P2 - Medium Priority

### Plugin Event Bus [core]

Formalized pub/sub system for plugin-to-plugin communication. Currently plugins query each other directly via `grid.getPlugin(PluginClass)`, which creates tight coupling.

**API**: Plugins emit/subscribe to typed events through a central bus:

```typescript
// In a plugin
this.emit('selection-cleared', { reason: 'filter-change' });
this.on('filter-change', (detail) => { ... });
```

**Use case**: Decouples plugins; allows third-party plugins to react to built-in plugin events without direct imports.

**Status**: Not started

---

### RTL Support [core]

Right-to-left text direction support for Arabic, Hebrew, and other RTL languages. Requires changes to CSS layout, sticky positioning, and scroll handling.

**Use case**: Applications targeting RTL language markets.

**Status**: Not started

---

### Print Layout Mode [core]

Optimized rendering for printing that shows all rows without virtualization. Requires ability to temporarily disable core virtualization.

**Use case**: Generating printable reports directly from the grid.

**Status**: Not started

---

### Conditional Formatting [plugin]

Apply styles to cells based on value conditions (e.g., highlight negative numbers).

**Use case**: Data visualization, alerts, and status indicators.

**Status**: Not started (possible via custom cell templates)

---

### Row Drag & Drop [plugin]

Reorder rows by dragging, including drag between grids.

**Use case**: Manual sorting, prioritization lists, kanban-style workflows.

**Status**: Not started

---

### Column Menu [plugin]

Dropdown menu on column headers for quick access to sort, filter, pin, and hide.

**Use case**: Discoverability of column features for new users.

**Status**: Not started

---

### Stricter Plugin API [core]

Replace direct grid access with a controlled `PluginAPI` interface. Currently `InternalGrid` exposes internals like `rowPool`, `__rowRenderEpoch`, `_columns` that plugins shouldn't touch.

**API**: Plugins receive a constrained API object instead of raw grid reference:

```typescript
interface PluginAPI {
  readonly rows: readonly T[];
  readonly columns: readonly ColumnConfig[];
  requestRender(): void;
  forceLayout(): Promise<void>;
  getPlugin<T>(PluginClass): T | undefined;
  dispatchEvent(event: Event): boolean;
  // No access to rowPool, render epochs, etc.
}
```

**Use case**: Clearer internal/external boundary; prevents plugins from depending on implementation details; enables safer refactoring of grid internals.

**Breaking change**: Yes — all plugins would need to update their grid access patterns. This is acceptable as the library is pre-release; no deprecation cycle required.

**Status**: Not started

---

## 🟢 P3 - Low Priority

### Row Animation [core]

Smooth CSS transitions when rows are added, removed, or reordered. Simple opt-in via CSS custom properties in core themes.

**Use case**: Visual feedback during data updates.

**Status**: Not started

---

### Cell Flashing [plugin]

Briefly highlight cells when their values change.

**Use case**: Real-time data feeds, stock tickers, monitoring dashboards.

**Status**: Not started

---

### CSV/Excel Import [plugin]

Import data from CSV or Excel files directly into the grid. Natural companion to the existing `export` plugin.

**Use case**: Data migration, bulk data entry, file-based workflows.

**Status**: Not started

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
