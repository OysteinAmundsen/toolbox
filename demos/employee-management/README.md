# Employee Management Demo

A comprehensive real-world demo showcasing `@toolbox-web/grid` capabilities in an enterprise employee management scenario. Available in three implementations: Vanilla TypeScript, Angular, and React.

## 📂 Project Structure

```
employee-management/
├── shared/                              # Shared code between demos
│   ├── types.ts                         # Data model interfaces
│   ├── data.ts                          # Data generators and constants
│   ├── styles.ts                        # Shadow DOM custom styles
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
│   │   ├── editors/                     # Editor components
│   │   ├── renderers/                   # Renderer components
│   │   └── tool-panels/                 # Tool panel components
│   └── README.md                        # Angular-specific docs
├── react/                               # React 19 demo
│   ├── src/                             # React application
│   │   ├── components/                  # React components
│   │   │   ├── editors/                 # Editor components
│   │   │   ├── renderers/               # Renderer components
│   │   │   └── tool-panels/             # Tool panel components
│   │   └── App.tsx                      # Main application
│   └── README.md                        # React-specific docs
├── employee-management.css              # Shared styles for Storybook
└── employee-management.stories.ts       # Storybook stories
```

### Shared Code (`shared/`)

All three demos share the same data model, generators, and shadow DOM styles:

| File                            | Description                                                        |
| ------------------------------- | ------------------------------------------------------------------ |
| [types.ts](./shared/types.ts)   | Data model interfaces (`Employee`, `Project`, `PerformanceReview`) |
| [data.ts](./shared/data.ts)     | Data generators and constants (`generateEmployees`, `DEPARTMENTS`) |
| [styles.ts](./shared/styles.ts) | Shadow DOM styles for custom editors/renderers                     |
| [index.ts](./shared/index.ts)   | Barrel exports                                                     |

## 🚀 Running the Demos

### Vanilla Demo

Pure TypeScript implementation with Vite. Shows the grid's native API without framework wrappers.

```bash
bun nx serve demo-vanilla
# or from demos/employee-management/vanilla:
bun run dev
```

### Angular Demo

Angular 21 implementation with signals, standalone components, and structural directives.

```bash
bun nx serve demo-angular
# or from demos/employee-management/angular:
bun run dev
```

### React Demo

React 19 implementation with hooks, inline renderers/editors, and declarative panels.

```bash
bun nx serve demo-react
# or from demos/employee-management/react:
bun run dev
```

## 🛠️ Framework Comparison

All three demos implement the same functionality, showcasing framework-specific patterns:

| Feature              | Vanilla                     | Angular                  | React                                              |
| -------------------- | --------------------------- | ------------------------ | -------------------------------------------------- |
| **Custom Renderers** | `renderer: (ctx) => html`   | `*tbwRenderer` directive | `renderer: (ctx) => JSX` or `GridColumn` children  |
| **Custom Editors**   | `editor: (ctx) => html`     | `*tbwEditor` directive   | `editor: (ctx) => JSX` or `GridColumn` editor prop |
| **Tool Panels**      | `registerToolPanel()`       | `<tbw-grid-tool-panel>`  | `<GridToolPanel>` component                        |
| **Master-Detail**    | `MasterDetailPlugin` config | `<tbw-grid-detail>`      | `<GridDetailPanel>` component                      |
| **Event Handling**   | `addEventListener()`        | `(cellCommit)` output    | `onCellEdit` prop or `useGridEvent` hook           |

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

## 💡 Usage Patterns by Framework

### Vanilla TypeScript

```typescript
import '@toolbox-web/grid';
import { SelectionPlugin, FilteringPlugin } from '@toolbox-web/grid/all';

const grid = document.createElement('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'status', renderer: (ctx) => `<span class="badge">${ctx.value}</span>` },
    { field: 'rating', editor: (ctx) => `<input type="range" value="${ctx.value}" />` },
  ],
  plugins: [new SelectionPlugin(), new FilteringPlugin()],
};
grid.rows = employees;
document.body.appendChild(grid);
```

### Angular

```typescript
import { Grid, TbwRenderer, TbwEditor } from '@toolbox-web/grid-angular';

@Component({
  imports: [Grid, TbwRenderer, TbwEditor],
  template: `
    <tbw-grid [rows]="employees" [gridConfig]="config">
      <tbw-grid-column field="status">
        <app-status-badge *tbwRenderer="let value" [value]="value" />
        <app-status-editor *tbwEditor="let value" [value]="value" />
      </tbw-grid-column>
    </tbw-grid>
  `,
})
export class GridComponent {}
```

### React

```tsx
import { DataGrid, type ReactGridConfig } from '@toolbox-web/grid-react';

function EmployeeGrid() {
  const config: ReactGridConfig<Employee> = {
    columns: [
      {
        field: 'status',
        renderer: (ctx) => <StatusBadge value={ctx.value} />,
        editor: (ctx) => <StatusEditor value={ctx.value} onCommit={ctx.commit} />,
      },
    ],
  };

  return <DataGrid rows={employees} gridConfig={config} />;
}
```

## 🎨 Styling Approach

All demos share styles in [employee-management.css](./employee-management.css) using BEM-style naming:

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

Custom styles are injected into the grid's shadow DOM via `customStyles` (React), `[customStyles]` (Angular), or `registerStyles()` (Vanilla).

## 🔗 View in Storybook

- [Live Demo](https://oysteinamundsen.github.io/toolbox/?path=/docs/grid-demos--docs)
- [All Features Story](https://oysteinamundsen.github.io/toolbox/?path=/story/demos-employee-management--all-features)
- [Grouped By Department](https://oysteinamundsen.github.io/toolbox/?path=/story/demos-employee-management--grouped-by-department)

## 📖 Learn More

- [Getting Started](../../libs/grid/docs/GettingStarted.mdx) – Set up your first grid
- [React Integration](../../libs/grid/docs/React.mdx) – React-specific patterns
- [Angular Integration](../../libs/grid/docs/Angular.mdx) – Angular-specific patterns
- [Plugins Overview](../../libs/grid/docs/Plugins.mdx) – Learn about individual plugins
- [Theming](../../libs/grid/docs/Theming.mdx) – Customize the visual appearance
- [API Reference](../../libs/grid/docs/API.mdx) – Full API documentation
