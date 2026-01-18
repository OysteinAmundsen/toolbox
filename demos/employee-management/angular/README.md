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
- ✅ **Web Component Integration** - Uses `CUSTOM_ELEMENTS_SCHEMA` for `<tbw-grid>`

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
angular/
├── src/
│   ├── app/
│   │   ├── editors/                   # Editor components for inline editing
│   │   ├── renderers/                 # View renderer components
│   │   ├── app.component.ts           # Root standalone component
│   │   ├── app.component.html         # Main template with grid
│   │   └── grid-config.ts             # Grid configuration factory
│   ├── main.ts                        # Angular bootstrap (standalone)
│   └── vite-env.d.ts                  # Vite type definitions
├── index.html                         # HTML entry point
├── package.json                       # Dependencies (Angular 21)
├── tsconfig.json                      # TypeScript config
├── vite.config.ts                     # Vite configuration
└── README.md                          # This file

shared/                                # Shared between Angular and Vanilla demos
├── demo-styles.css                    # Global demo styles (light/dark mode)
├── custom-styles.css                  # Custom styles for grid styling
├── data.ts                            # Employee data generator
├── types.ts                           # Shared TypeScript types
└── styles.ts                          # Style exports for bundlers
```

## Running the Demo

### Development Server

```bash
# From the angular directory
cd demos/employee-management/angular
bun install
bun run dev
```

The demo will open at `http://localhost:5174`

### Building

```bash
bun run build
```

Output will be in `dist/`

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
- [Grid Component Docs](../../../libs/grid/README.md)
- [Vite Documentation](https://vite.dev)
- [@analogjs/vite-plugin-angular](https://analogjs.org/docs/packages/vite-plugin-angular/overview)
