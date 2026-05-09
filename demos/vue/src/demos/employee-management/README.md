# Employee Management Demo - Vue 3

This is a Vue 3 demo application showcasing the `@toolbox-web/grid-vue` library with all major features enabled.

## Features Demonstrated

- **Selection** - Range selection with Ctrl/Shift support
- **Sorting** - Multi-column sort with Shift+click
- **Filtering** - Column header filters with debouncing
- **Editing** - Double-click to edit cells with custom editors
- **Master-Detail** - Expandable rows showing employee details
- **Clipboard** - Copy/paste support (Ctrl+C/V)
- **Context Menu** - Right-click menu for common actions
- **Column Reorder** - Drag column headers to reorder
- **Column Visibility** - Toggle column visibility via sidebar
- **Pinned Columns** - Sticky left/right columns
- **Grouped Headers** - Multi-level column grouping
- **Column Virtualization** - Efficient rendering of many columns
- **Export** - CSV and Excel export via toolbar
- **Responsive** - Card layout for narrow viewports
- **Undo/Redo** - Ctrl+Z/Y for cell edits
- **Pinned Rows** - Footer aggregation rows

## Running the Demo

```bash
# From repository root
bun nx serve demo-vue

# Or with dist builds (production mode)
bun nx serve:dist demo-vue
```

The demo runs on **http://localhost:4100/employee-management**

## Vue Adapter Patterns

### Feature Imports (Tree-Shakeable)

```typescript
// Only import features you use - each adds to your bundle
import '@toolbox-web/grid-vue/features/selection';
import '@toolbox-web/grid-vue/features/editing';
import '@toolbox-web/grid-vue/features/filtering';
```

### Feature Props (Declarative Configuration)

```vue
<TbwGrid
  :rows="employees"
  :gridConfig="gridConfig"
  selection="range"
  editing="dblclick"
  filtering
  :pinnedRows="pinnedRowsConfig"
/>
```

### Slot-Based Renderers

```vue
<TbwGridColumn field="status" header="Status">
  <template #cell="{ value }">
    <StatusBadge :value="value" />
  </template>
</TbwGridColumn>
```

### Slot-Based Editors

```vue
<TbwGridColumn field="rating" header="Rating" :editable="true">
  <template #editor="{ value, commit, cancel }">
    <StarRatingEditor :value="value" @commit="commit" @cancel="cancel" />
  </template>
</TbwGridColumn>
```

### useGrid Composable

```typescript
import { useGrid } from '@toolbox-web/grid-vue';

const { gridRef, exportToCsv, forceLayout } = useGrid<Employee>();
```

## Project Structure

```
demos/vue/src/demos/employee-management/
├── EmployeeManagement.vue       # Main component (control panel + TbwGrid)
├── grid-config.ts               # Column / plugin / pinned-row config
├── components/
│   ├── renderers/               # Custom cell renderers
│   │   ├── StatusBadge.vue
│   │   ├── RatingDisplay.vue
│   │   ├── TopPerformerStar.vue
│   │   ├── ResponsiveEmployeeCard.vue
│   │   └── DetailPanel.vue
│   ├── editors/                 # Custom cell editors
│   │   ├── StarRatingEditor.vue
│   │   ├── BonusSliderEditor.vue
│   │   ├── StatusSelectEditor.vue
│   │   └── DateEditor.vue
│   └── tool-panels/             # Sidebar tool panels
│       ├── AnalyticsPanel.vue
│       └── QuickFiltersPanel.vue
└── README.md                    # This file
```

The shell that hosts this demo lives at [`demos/vue/`](../../..) — see its README for the router setup.

## Visual Equality Testing

This demo is designed to be visually identical to the vanilla, React, and Angular demos for E2E cross-framework testing. The CI pipeline runs Playwright tests that compare screenshots across all framework demos.

See `e2e/tests/cross-framework-visual.spec.ts` for the visual regression tests.
