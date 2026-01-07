# Employee Management Demo

A comprehensive real-world demo showcasing `@toolbox-web/grid` capabilities in an enterprise employee management scenario.

## 📂 File Structure

| File                                                               | Description                                                          |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| [types.ts](./types.ts)                                             | Data model interfaces (`Employee`, `Project`, `PerformanceReview`)   |
| [data.ts](./data.ts)                                               | Data generators and constants (`generateEmployees`, `DEPARTMENTS`)   |
| [editors.ts](./editors.ts)                                         | Custom cell editors (star rating, bonus slider, status select, date) |
| [renderers.ts](./renderers.ts)                                     | View renderers (status badges, rating display, master-detail)        |
| [employee-management.css](./employee-management.css)               | All demo styles (editors, panels, analytics)                         |
| [employee-management.stories.ts](./employee-management.stories.ts) | Storybook stories with grid configuration                            |

## 🚀 Features Demonstrated

### Plugins Used (15+)

- **SelectionPlugin** – Range selection with Shift+Click
- **MultiSortPlugin** – Multi-column sorting
- **FilteringPlugin** – Column filters with debounce
- **ClipboardPlugin** – Copy/paste support
- **ContextMenuPlugin** – Right-click actions
- **ReorderPlugin** – Drag-and-drop column reorder
- **GroupingColumnsPlugin** – Visual column groups
- **PinnedColumnsPlugin** – Sticky columns
- **ColumnVirtualizationPlugin** – Efficient horizontal scrolling
- **VisibilityPlugin** – Show/hide columns
- **MasterDetailPlugin** – Expandable row details
- **GroupingRowsPlugin** – Row grouping by department
- **UndoRedoPlugin** – Edit history with Ctrl+Z/Y
- **ExportPlugin** – CSV/Excel export
- **PinnedRowsPlugin** – Footer aggregations

### Custom Editors

- **Star Rating** – Click-to-rate 1-5 stars
- **Bonus Slider** – Range input $0-$50,000
- **Status Select** – Dropdown with color-coded options
- **Date Picker** – Native date input

### Custom Renderers

- **Status Badge** – Color-coded status indicators
- **Rating Display** – Color gradient based on score
- **Top Performer** – Star icon for high performers
- **Detail Panel** – Projects + performance reviews

### Shell Integration

- **Header Stats** – Live selection count
- **Quick Filters Panel** – Department, level, status, rating filters
- **Analytics Panel** – Payroll stats, department distribution

## 💡 Usage Pattern

This demo demonstrates how real-world applications should integrate `@toolbox-web/grid`:

```typescript
import '../src/index';  // Register <tbw-grid> component
import {
  SelectionPlugin,
  FilteringPlugin,
  ExportPlugin,
  // ... other plugins
} from '../src/all';

// Create grid
const grid = document.createElement('tbw-grid');
grid.style.cssText = 'height: 600px; display: block;';

// Configure with plugins
grid.gridConfig = {
  columns: [...],
  columnGroups: [...],
  plugins: [
    new SelectionPlugin({ mode: 'range' }),
    new FilteringPlugin({ debounceMs: 200 }),
    new ExportPlugin(),
    // ...
  ],
};

// Set data
grid.rows = generateEmployees(200);

// Register shell components
grid.registerHeaderContent({ ... });
grid.registerToolPanel({ ... });
```

## 🎨 Styling Approach

All styles are in [employee-management.css](./employee-management.css) using BEM-style naming:

```css
/* Editors */
.star-rating-editor { ... }
.star-rating-editor__star { ... }
.star-rating-editor__star--filled { ... }

/* Renderers */
.status-badge { ... }
.status-badge--active { ... }

/* Tool panels */
.filter-section { ... }
.stat-card { ... }
```

## 🔗 View in Storybook

- [Live Demo](https://oysteinamundsen.github.io/toolbox/?path=/docs/grid-demos--docs)
- [All Features Story](https://oysteinamundsen.github.io/toolbox/?path=/story/demos-employee-management--all-features)
- [Grouped By Department](https://oysteinamundsen.github.io/toolbox/?path=/story/demos-employee-management--grouped-by-department)

## 📖 Learn More

- [Getting Started](../docs/GettingStarted.mdx) – Set up your first grid
- [Plugins Overview](../docs/Plugins.mdx) – Learn about individual plugins
- [Theming](../docs/Theming.mdx) – Customize the visual appearance
- [API Reference](../docs/API.mdx) – Full API documentation
