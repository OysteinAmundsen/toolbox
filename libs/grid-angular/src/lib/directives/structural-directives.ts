import { Directive, effect, ElementRef, inject, OnDestroy, TemplateRef } from '@angular/core';
import { getViewTemplate } from './grid-column-view.directive';

/**
 * Context type for structural directives with `any` defaults.
 * This provides better ergonomics in templates without requiring explicit type annotations.
 *
 * @internal Use `GridCellContext` in application code for stricter typing.
 * @since 0.1.1
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface StructuralCellContext<TValue = any, TRow = any> {
  /** The cell value for this column */
  $implicit: TValue;
  /** The cell value (explicit binding) */
  value: TValue;
  /** The full row data object */
  row: TRow;
  /** The column configuration */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: any;
}

// Registry for structural view templates
const structuralViewRegistry = new Map<HTMLElement, TemplateRef<StructuralCellContext>>();

/**
 * Gets the view template registered by the structural directive for a given column element.
 * Falls back to the non-structural directive registry.
 */
export function getStructuralViewTemplate(columnElement: HTMLElement): TemplateRef<StructuralCellContext> | undefined {
  // First check structural directive registry
  const template = structuralViewRegistry.get(columnElement);
  if (template) return template;

  // Fall back to the nested element registry
  const viewEl = columnElement.querySelector('tbw-grid-column-view');
  if (viewEl) {
    return getViewTemplate(viewEl as HTMLElement) as TemplateRef<StructuralCellContext> | undefined;
  }
  return undefined;
}

/**
 * Structural directive for cell view rendering.
 *
 * This provides a cleaner syntax for defining custom cell renderers without
 * the nested `<tbw-grid-column-view>` and `<ng-template>` boilerplate.
 *
 * ## Usage
 *
 * ```html
 * <!-- Instead of this verbose syntax: -->
 * <tbw-grid-column field="status">
 *   <tbw-grid-column-view>
 *     <ng-template let-value let-row="row">
 *       <app-status-badge [value]="value" />
 *     </ng-template>
 *   </tbw-grid-column-view>
 * </tbw-grid-column>
 *
 * <!-- Use this cleaner syntax: -->
 * <tbw-grid-column field="status">
 *   <app-status-badge *tbwRenderer="let value; row as row" [value]="value" />
 * </tbw-grid-column>
 * ```
 *
 * ## Template Context
 *
 * The structural directive provides the same context as `GridColumnView`:
 * - `$implicit` / `value`: The cell value (use `let value` or `let-value`)
 * - `row`: The full row data object (use `row as row` or `let-row="row"`)
 * - `column`: The column configuration
 *
 * ## Import
 *
 * ```typescript
 * import { TbwRenderer } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   imports: [TbwRenderer],
 *   // ...
 * })
 * ```
 *
 * @example
 * ```html
 * <tbw-grid-column field="status">
 *   <app-status-badge *tbwRenderer="let value; row as row" [value]="value" />
 * </tbw-grid-column>
 * ```
 *
 * @category Directive
 * @since 0.1.1
 */
@Directive({ selector: '[tbwRenderer]' })
export class TbwRenderer implements OnDestroy {
  private template = inject(TemplateRef<StructuralCellContext>);
  private elementRef = inject(ElementRef<HTMLElement>);
  private columnElement: HTMLElement | null = null;

  constructor() {
    // Angular structural directives wrap the host element in a comment node.
    // We need to find the parent tbw-grid-column element.
    // Since we're injected into the template, we use an effect to register once the DOM is stable.
    effect(() => {
      this.registerTemplate();
    });
  }

  private registerTemplate(): void {
    // Find the parent tbw-grid-column element
    // The template's host element may not be in the DOM yet, so we traverse from the comment node
    let parent = this.elementRef.nativeElement?.parentElement;
    while (parent && parent.tagName !== 'TBW-GRID-COLUMN') {
      parent = parent.parentElement;
    }

    if (parent) {
      this.columnElement = parent;
      structuralViewRegistry.set(parent, this.template);
    }
  }

  ngOnDestroy(): void {
    if (this.columnElement) {
      structuralViewRegistry.delete(this.columnElement);
    }
  }

  /**
   * Static type guard for template context.
   * Uses `any` defaults for ergonomic template usage.
   */
  static ngTemplateContextGuard(dir: TbwRenderer, ctx: unknown): ctx is StructuralCellContext {
    return true;
  }
}
