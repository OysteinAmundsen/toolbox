# Employee Management Demo - Angular Implementation

This is an **Angular 21** implementation of the Employee Management demo, showcasing the `@toolbox-web/grid` component in a modern Angular application using standalone components and signals.

## Features

This demo demonstrates the exact same functionality as the vanilla demo, but implemented "the Angular way":

- ✅ **Standalone Components** - No NgModule, using `bootstrapApplication`
- ✅ **Signal APIs** - `input()`, `output()`, `viewChild()` (Angular 21)
- ✅ **Simple Imperative Setup** - Following the official grid documentation pattern
- ✅ **Pure Functions** - Editors and renderers as plain functions, not services
- ✅ **TypeScript Types** - Full type safety with shared types from `../shared`
- ✅ **Vite + Analog** - Fast development with Vite and @analogjs/vite-plugin-angular
- ✅ **Web Component Integration** - Angular directives register `<tbw-grid>` automatically, no `CUSTOM_ELEMENTS_SCHEMA` needed

### Grid Features Demonstrated

- 15+ plugins (selection, filtering, sorting, editing, etc.)
- Custom editors (star rating, bonus slider, status select, date picker)
- Custom view renderers (status badges, rating colors)
- Master-detail with expandable rows
- Shell integration (header, tool panels)
- Column grouping and aggregation
- Export to CSV/Excel

## Project Structure

```
demos/angular/src/demos/employee-management/
├── employee-management.component.ts    # Main standalone component
├── employee-management.component.html  # Template with <tbw-grid>
├── grid-config.ts                      # Column / plugin / pinned-row config
├── renderers/                          # Custom cell renderers
│   ├── status-badge.component.ts
│   ├── rating-display.component.ts
│   ├── top-performer.component.ts
│   └── detail-panel.component.ts
├── editors/                            # Custom cell editors
│   ├── star-rating-editor.component.ts
│   ├── bonus-slider-editor.component.ts
│   ├── status-select-editor.component.ts
│   └── date-editor.component.ts
├── tool-panels/                        # Sidebar tool panels
│   ├── analytics-panel.component.ts
│   ├── quick-filters-panel.component.ts
│   └── index.ts
└── README.md                           # This file
```

The shell that hosts this demo lives at [`demos/angular/`](../../..) — see its README for the router setup.

## Running the Demo

```bash
bun nx serve demo-angular
```

The demo runs on **http://localhost:4200/employee-management**.

## Key Angular 21 Features

### Standalone Components

No `@NgModule` - everything is standalone:

```typescript
@Component({
  selector: 'app-root',
  imports: [FormsModule, GridWrapperComponent],
  // ...
})
export class AppComponent {}
```

### Signal-Based APIs

Using Angular 21's signal primitives:

```typescript
export class GridWrapperComponent {
  // Signal inputs
  rowCount = input.required<number>();
  enableSelection = input.required<boolean>();

  // Signal-based viewChild
  gridRef = viewChild.required<ElementRef<GridElement>>('grid');

  constructor() {
    // Effect runs when inputs change
    effect(() => {
      const grid = this.gridRef().nativeElement;
      grid.gridConfig = createGridConfig({...});
      grid.rows = generateEmployees(this.rowCount());
    });
  }
}
```

### Simple Imperative Setup

Following the grid documentation pattern - no overcomplicated abstractions:

```typescript
const grid = this.gridRef().nativeElement;
grid.gridConfig = { ... };
grid.rows = data;
```

## Code Reuse

This demo **only reuses** code from `../shared/`:

- `types.ts` - Employee, Project, PerformanceReview types
- `data.ts` - `generateEmployees()`, `DEPARTMENTS` constants
- `index.ts` - Barrel exports

All other code is Angular-specific and follows Angular 21 best practices.

## Differences from Vanilla Demo

### Vanilla Approach

- Imperative DOM manipulation
- Direct event listeners
- Global functions
- Manual grid creation in `initializeDemo()`

### Angular Approach

- Declarative templates with two-way binding (`[(ngModel)]`)
- Signal-based reactivity with `effect()`
- Standalone components with dependency injection
- Simple imperative grid setup (following official docs)

## Learning Resources

- [Angular 21 Documentation](https://angular.dev)
- [Angular Signals Guide](https://angular.dev/guide/signals)
- [`@toolbox-web/grid-angular`](../../../../../libs/grid-angular/README.md)
- [`@toolbox-web/grid`](../../../../../libs/grid/README.md)
