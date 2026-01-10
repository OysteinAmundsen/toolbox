import { contentChild, Directive, effect, ElementRef, inject, TemplateRef } from '@angular/core';

/**
 * Context object passed to the cell renderer template.
 * Contains the cell value, row data, and column configuration.
 */
export interface GridCellContext<TValue = unknown, TRow = unknown> {
  /** The cell value for this column */
  $implicit: TValue;
  /** The cell value (explicit binding) */
  value: TValue;
  /** The full row data object */
  row: TRow;
  /** The column configuration */
  column: unknown;
}

// Global registry mapping DOM elements to their templates
const templateRegistry = new Map<HTMLElement, TemplateRef<GridCellContext>>();

/**
 * Gets the template registered for a given element.
 * Used by AngularGridAdapter to retrieve templates at render time.
 */
export function getViewTemplate(element: HTMLElement): TemplateRef<GridCellContext> | undefined {
  return templateRegistry.get(element);
}

/**
 * Directive that captures an `<ng-template>` for use as a cell renderer.
 *
 * This enables declarative Angular component usage with proper input bindings
 * that satisfy Angular's AOT compiler.
 *
 * ## Usage
 *
 * ```html
 * <tbw-grid-column field="status">
 *   <tbw-grid-column-view>
 *     <ng-template let-value let-row="row">
 *       <app-status-badge [value]="value" [row]="row" />
 *     </ng-template>
 *   </tbw-grid-column-view>
 * </tbw-grid-column>
 * ```
 *
 * The template context provides:
 * - `$implicit` / `value`: The cell value
 * - `row`: The full row data object
 * - `column`: The column configuration
 *
 * Import the directive in your component:
 *
 * ```typescript
 * import { GridColumnView } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   imports: [GridColumnView],
 *   // ...
 * })
 * ```
 */
@Directive({ selector: 'tbw-grid-column-view' })
export class GridColumnView {
  private elementRef = inject(ElementRef<HTMLElement>);

  /**
   * Query for the ng-template content child.
   */
  template = contentChild(TemplateRef<GridCellContext>);

  /** Effect that triggers when the template is available */
  private onTemplateReceived = effect(() => {
    const template = this.template();
    if (template) {
      // Register the template for this element
      templateRegistry.set(this.elementRef.nativeElement, template);
    }
  });

  /**
   * Static type guard for template context.
   * Enables type inference in templates.
   */
  static ngTemplateContextGuard(dir: GridColumnView, ctx: unknown): ctx is GridCellContext {
    return true;
  }
}
