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
- `libs/grid-angular/src/lib/base-overlay-editor.ts` - BaseOverlayEditor (floating overlay panel for custom editors)
- `libs/grid-angular/src/lib/base-grid-editor-cva.ts` - BaseGridEditorCVA (dual grid/form ControlValueAccessor)
- `libs/grid-angular/src/lib/base-filter-panel.ts` - BaseFilterPanel (custom filter panel base class)
- `libs/grid-react/src/index.ts` - React adapter exports (DataGrid, GridColumn, hooks)
- `libs/grid-vue/src/index.ts` - Vue adapter exports (DataGrid, GridColumn, composables)
