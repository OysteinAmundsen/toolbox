import { contentChild, Directive, effect, ElementRef, inject, TemplateRef } from '@angular/core';

/**
 * Context object passed to the responsive card template.
 *
 * @template TRow - The type of row data
 *
 * @example
 * ```html
 * <tbw-grid-responsive-card>
 *   <ng-template let-row let-index="index">
 *     <div class="card-content">
 *       <span>{{ row.name }}</span>
 *       <span>Row #{{ index }}</span>
 *     </div>
 *   </ng-template>
 * </tbw-grid-responsive-card>
 * ```
 */
export interface GridResponsiveCardContext<TRow = unknown> {
  /**
   * The row data (available as `let-row` or `let-myVar`).
   */
  $implicit: TRow;

  /**
   * The row data (explicit access via `let-row="row"`).
   */
  row: TRow;

  /**
   * The row index (zero-based).
   */
  index: number;
}

/**
 * Registry to store responsive card templates by grid element.
 * Used by AngularGridAdapter to create card renderers.
 */
export const responsiveCardTemplateRegistry = new Map<HTMLElement, TemplateRef<GridResponsiveCardContext>>();

/**
 * Retrieves the responsive card template for a grid element.
 *
 * @param gridElement - The grid element to look up
 * @returns The template reference or undefined if not found
 */
export function getResponsiveCardTemplate(
  gridElement: HTMLElement,
): TemplateRef<GridResponsiveCardContext> | undefined {
  // Find the tbw-grid-responsive-card element inside the grid
  const cardElement = gridElement.querySelector('tbw-grid-responsive-card');
  if (!cardElement) return undefined;
  return responsiveCardTemplateRegistry.get(cardElement as HTMLElement);
}

/**
 * Directive for providing custom Angular templates for responsive card layout.
 *
 * Use this directive to define how each row should render when the grid
 * is in responsive/mobile mode. The template receives the row data and index.
 *
 * ## Usage
 *
 * ```html
 * <tbw-grid [rows]="employees">
 *   <tbw-grid-responsive-card>
 *     <ng-template let-employee let-idx="index">
 *       <div class="employee-card">
 *         <img [src]="employee.avatar" alt="">
 *         <div class="info">
 *           <strong>{{ employee.name }}</strong>
 *           <span>{{ employee.department }}</span>
 *         </div>
 *       </div>
 *     </ng-template>
 *   </tbw-grid-responsive-card>
 * </tbw-grid>
 * ```
 *
 * ## Important Notes
 *
 * - The ResponsivePlugin must be added to your grid config
 * - The Grid directive will automatically configure the plugin's cardRenderer
 * - Template context provides `$implicit` (row), `row`, and `index`
 *
 * @see ResponsivePlugin
 */
@Directive({
  selector: 'tbw-grid-responsive-card',
})
export class GridResponsiveCard<TRow = unknown> {
  private elementRef = inject(ElementRef<HTMLElement>);

  /**
   * The ng-template containing the card content.
   */
  template = contentChild(TemplateRef<GridResponsiveCardContext<TRow>>);

  /**
   * Effect that registers the template when it becomes available.
   */
  private onTemplateReceived = effect(() => {
    const template = this.template();
    if (template) {
      responsiveCardTemplateRegistry.set(
        this.elementRef.nativeElement,
        template as TemplateRef<GridResponsiveCardContext>,
      );
    }
  });

  /**
   * Type guard for template context inference.
   */
  static ngTemplateContextGuard<T>(
    _directive: GridResponsiveCard<T>,
    context: unknown,
  ): context is GridResponsiveCardContext<T> {
    return true;
  }
}
