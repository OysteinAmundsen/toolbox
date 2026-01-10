# Employee Management Demo

A comprehensive real-world demo showcasing `@toolbox-web/grid` capabilities in an enterprise employee management scenario.

## 📂 Project Structure

```
employee-management/
├── shared/                              # Shared code between demos
│   ├── types.ts                         # Data model interfaces
│   ├── data.ts                          # Data generators and constants
│   └── index.ts                         # Barrel exports
├── vanilla/                             # Pure TypeScript/Vite demo
│   ├── index.html                       # Entry point
│   ├── main.ts                          # Bootstrap and grid initialization
│   ├── editors.ts                       # Custom cell editors
│   ├── renderers.ts                     # View renderers
│   ├── tool-panels.ts                   # Shell tool panels
│   └── styles.css                       # Demo styles
├── angular/                             # Angular 21 demo
│   ├── src/app/                         # Angular application
│   └── README.md                        # Angular-specific docs
├── employee-management.css              # Shared styles for Storybook
└── employee-management.stories.ts       # Storybook stories
```

### Shared Code (`shared/`)

| File                          | Description                                                        |
| ----------------------------- | ------------------------------------------------------------------ |
| [types.ts](./shared/types.ts) | Data model interfaces (`Employee`, `Project`, `PerformanceReview`) |
| [data.ts](./shared/data.ts)   | Data generators and constants (`generateEmployees`, `DEPARTMENTS`) |
| [index.ts](./shared/index.ts) | Barrel exports                                                     |

### Vanilla Demo (`vanilla/`)

Pure TypeScript implementation with Vite. See [vanilla/README.md](./vanilla/README.md) for details.

```bash
cd demos/employee-management/vanilla
bun install
bun run dev
```

### Angular Demo (`angular/`)

Angular 21 implementation with signals and standalone components. See [angular/README.md](./angular/README.md) for details.

```bash
cd demos/employee-management/angular
bun install
bun run dev
```

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
