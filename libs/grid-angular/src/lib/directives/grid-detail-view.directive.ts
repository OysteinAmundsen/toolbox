import { contentChild, Directive, effect, ElementRef, inject, input, TemplateRef } from '@angular/core';
import type { ExpandCollapseAnimation } from '@toolbox-web/grid';

/**
 * Context object passed to the detail renderer template.
 * Contains the row data for the expanded detail view.
 */
export interface GridDetailContext<TRow = unknown> {
  /** The row data (implicit binding for let-row) */
  $implicit: TRow;
  /** The row data (explicit binding) */
  row: TRow;
}

// Global registry mapping DOM elements to their templates
const detailTemplateRegistry = new Map<HTMLElement, TemplateRef<GridDetailContext>>();

/**
 * Gets the detail template registered for a given grid element.
 * Used by AngularGridAdapter to retrieve templates at render time.
 */
export function getDetailTemplate(gridElement: HTMLElement): TemplateRef<GridDetailContext> | undefined {
  // Look for tbw-grid-detail child and get its template
  const detailElement = gridElement.querySelector('tbw-grid-detail');
  if (detailElement) {
    return detailTemplateRegistry.get(detailElement as HTMLElement);
  }
  return undefined;
}

/**
 * Gets the configuration for the detail view.
 */
export function getDetailConfig(
  gridElement: HTMLElement,
): { showExpandColumn?: boolean; animation?: ExpandCollapseAnimation } | undefined {
  const detailElement = gridElement.querySelector('tbw-grid-detail');
  if (detailElement) {
    const animationAttr = detailElement.getAttribute('animation');
    let animation: ExpandCollapseAnimation = 'slide';
    if (animationAttr === 'false') {
      animation = false;
    } else if (animationAttr === 'fade') {
      animation = 'fade';
    }
    return {
      showExpandColumn: detailElement.getAttribute('showExpandColumn') !== 'false',
      animation,
    };
  }
  return undefined;
}

/**
 * Directive that captures an `<ng-template>` for use as a master-detail row renderer.
 *
 * This enables declarative Angular component usage for expandable detail rows
 * that appear below the main row when expanded.
 *
 * ## Usage
 *
 * ```html
 * <tbw-grid [rows]="rows" [gridConfig]="config">
 *   <tbw-grid-detail [showExpandColumn]="true" animation="slide">
 *     <ng-template let-row>
 *       <app-detail-panel [employee]="row" />
 *     </ng-template>
 *   </tbw-grid-detail>
 * </tbw-grid>
 * ```
 *
 * The template context provides:
 * - `$implicit` / `row`: The full row data object
 *
 * Import the directive in your component:
 *
 * ```typescript
 * import { GridDetailView } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   imports: [GridDetailView],
 *   // ...
 * })
 * ```
 */
@Directive({ selector: 'tbw-grid-detail' })
export class GridDetailView {
  private elementRef = inject(ElementRef<HTMLElement>);

  /** Whether to show the expand/collapse column. Default: true */
  showExpandColumn = input<boolean>(true);

  /** Animation style for expand/collapse. Default: 'slide' */
  animation = input<ExpandCollapseAnimation>('slide');

  /**
   * Query for the ng-template content child.
   */
  template = contentChild(TemplateRef<GridDetailContext>);

  /** Effect that triggers when the template is available */
  private onTemplateReceived = effect(() => {
    const template = this.template();
    if (template) {
      // Register the template for this element
      detailTemplateRegistry.set(this.elementRef.nativeElement, template);
    }
  });

  /**
   * Static type guard for template context.
   * Enables type inference in templates.
   */
  static ngTemplateContextGuard(dir: GridDetailView, ctx: unknown): ctx is GridDetailContext {
    return true;
  }
}
