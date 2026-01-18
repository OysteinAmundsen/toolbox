# Employee Management Demo (React)

This demo showcases `@toolbox-web/grid-react` in a React 19 application with TypeScript.
It matches the visual design and functionality of the Angular demo.

## Features Demonstrated

- **DataGrid component** with full React props and TypeScript generics
- **GridColumn components** with render props for custom renderers (light DOM)
- **Editor prop** with React components for custom cell editors
- **Master-detail** with expandable rows using React components
- **Multiple plugins** (filtering, sorting, selection, export, etc.)
- **customStyles** injection for custom styling

## The React Way

This demo follows React idioms:

1. **Render Props Pattern** - Custom cell renderers use the render props pattern via `GridColumn` children
2. **Component-based Editors** - Custom editors are React components with props for commit/cancel
3. **Light DOM** - `GridColumn` elements are rendered in the light DOM, just like Angular's `tbw-grid-column`
4. **Shared Styles** - Uses `customStyles` prop to inject shared demo-styles.css into the grid

## Quick Start

```bash
# From repo root
bun nx serve demo-react

# Or with npm
npm run nx serve demo-react
```

The demo will be available at http://localhost:5174

## Project Structure

```
react/
├── src/
│   ├── App.tsx                    # Main app with DataGrid
│   ├── main.tsx                   # Entry point
│   └── components/
│       ├── renderers/             # Custom cell renderers
│       │   ├── StatusBadge.tsx
│       │   ├── RatingDisplay.tsx
│       │   ├── TopPerformerStar.tsx
│       │   └── DetailPanel.tsx
│       └── editors/               # Custom cell editors
│           ├── StarRatingEditor.tsx
│           ├── BonusSliderEditor.tsx
│           ├── StatusSelectEditor.tsx
│           └── DateEditor.tsx
├── index.html
├── package.json
├── project.json
├── tsconfig.json
└── vite.config.ts
```

## Key Concepts

### Custom Renderers (Render Props)

```tsx
import { DataGrid, GridColumn } from '@toolbox-web/grid-react';

<DataGrid rows={rows} gridConfig={config}>
  <GridColumn<Employee, string> field="status">{(ctx) => <StatusBadge value={ctx.value} />}</GridColumn>
</DataGrid>;
```

The `StatusBadge` component:

```tsx
function StatusBadge({ value }: { value: string }) {
  const badgeClass = `status-badge--${value.toLowerCase().replace(/\s+/g, '-')}`;
  return <span className={`status-badge ${badgeClass}`}>{value}</span>;
}
```

### Custom Editors (Component Props)

```tsx
<GridColumn<Employee, number>
  field="rating"
  editable
  editor={(ctx) => <StarRatingEditor value={ctx.value} onCommit={ctx.commit} onCancel={ctx.cancel} />}
>
  {(ctx) => <RatingDisplay value={ctx.value} />}
</GridColumn>
```

The `StarRatingEditor` component:

```tsx
function StarRatingEditor({ value, onCommit, onCancel }) {
  const [currentValue, setCurrentValue] = useState(value);

  return (
    <div
      className="star-rating-editor"
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(currentValue);
        if (e.key === 'Escape') onCancel();
      }}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          onClick={() => {
            setCurrentValue(star);
            onCommit(star);
          }}
        >
          {star <= currentValue ? '★' : '☆'}
        </span>
      ))}
    </div>
  );
}
```

### Custom Styling

```tsx
import { customStyles } from '@demo/shared/styles';

<DataGrid
  rows={rows}
  gridConfig={config}
  customStyles={customStyles}  // Injects CSS into grid
>
```

## Comparison with Angular Demo

| Feature            | Angular                          | React                         |
| ------------------ | -------------------------------- | ----------------------------- |
| Custom Renderers   | `<ng-template let-value>`        | Render props `{(ctx) => ...}` |
| Custom Editors     | `(commit)="commit.emit($event)"` | `onCommit={ctx.commit}`       |
| Light DOM Elements | `<tbw-grid-column>`              | `<GridColumn>`                |
| Custom Styles      | `[customStyles]`                 | `customStyles={}`             |
| Framework Adapter  | `AngularGridAdapter`             | `ReactGridAdapter`            |

Both demos share:

- Visual appearance (demo-styles.css)
- Grid configuration
- Plugin configuration
- Feature parity

## Related

- [Angular Demo](../angular/README.md)
- [Vanilla Demo](../vanilla/README.md)
- [@toolbox-web/grid-react](../../../libs/grid-react/README.md)
