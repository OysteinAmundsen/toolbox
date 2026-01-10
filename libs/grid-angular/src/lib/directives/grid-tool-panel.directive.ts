import { contentChild, Directive, effect, ElementRef, inject, input, TemplateRef } from '@angular/core';

/**
 * Context object passed to the tool panel template.
 * Provides access to grid-related information for the panel content.
 */
export interface GridToolPanelContext {
  /** The grid element (implicit binding) */
  $implicit: HTMLElement;
  /** The grid element */
  grid: HTMLElement;
}

// Global registry mapping DOM elements to their templates
const toolPanelTemplateRegistry = new Map<HTMLElement, TemplateRef<GridToolPanelContext>>();

/**
 * Gets the tool panel template registered for a given tool panel element.
 * Used by AngularGridAdapter to retrieve templates at render time.
 */
export function getToolPanelTemplate(panelElement: HTMLElement): TemplateRef<GridToolPanelContext> | undefined {
  return toolPanelTemplateRegistry.get(panelElement);
}

/**
 * Gets all tool panel elements with registered templates within a grid element.
 */
export function getToolPanelElements(gridElement: HTMLElement): HTMLElement[] {
  const panelElements = gridElement.querySelectorAll('tbw-grid-tool-panel');
  return Array.from(panelElements).filter((el) => toolPanelTemplateRegistry.has(el as HTMLElement)) as HTMLElement[];
}

/**
 * Directive that captures an `<ng-template>` for use as a custom tool panel.
 *
 * This enables declarative Angular component usage for tool panels
 * that appear in the grid's side panel.
 *
 * ## Usage
 *
 * ```html
 * <tbw-grid [rows]="rows" [gridConfig]="config">
 *   <tbw-grid-tool-panel
 *     id="quick-filters"
 *     title="Quick Filters"
 *     icon="🔍"
 *     tooltip="Apply quick filters"
 *     [order]="10"
 *   >
 *     <ng-template let-grid>
 *       <app-quick-filters [grid]="grid" />
 *     </ng-template>
 *   </tbw-grid-tool-panel>
 * </tbw-grid>
 * ```
 *
 * The template context provides:
 * - `$implicit` / `grid`: The grid element reference
 *
 * ### Attributes
 *
 * - `id` (required): Unique identifier for the panel
 * - `title` (required): Panel title shown in accordion header
 * - `icon`: Icon for accordion section header (emoji or text)
 * - `tooltip`: Tooltip for accordion section header
 * - `order`: Panel order priority (lower = first, default: 100)
 *
 * Import the directive in your component:
 *
 * ```typescript
 * import { GridToolPanel } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   imports: [GridToolPanel],
 *   // ...
 * })
 * ```
 */
@Directive({ selector: 'tbw-grid-tool-panel' })
export class GridToolPanel {
  private elementRef = inject(ElementRef<HTMLElement>);

  /** Unique panel identifier (required) */
  id = input.required<string>({ alias: 'id' });

  /** Panel title shown in accordion header (required) */
  title = input.required<string>({ alias: 'title' });

  /** Icon for accordion section header (emoji or text) */
  icon = input<string>();

  /** Tooltip for accordion section header */
  tooltip = input<string>();

  /** Panel order priority (lower = first, default: 100) */
  order = input<number>(100);

  /**
   * Query for the ng-template content child.
   */
  template = contentChild(TemplateRef<GridToolPanelContext>);

  /** Effect that triggers when the template is available */
  private onTemplateReceived = effect(() => {
    const template = this.template();
    const element = this.elementRef.nativeElement;

    if (template) {
      // Set attributes from inputs (for light DOM parsing to read)
      element.setAttribute('id', this.id());
      element.setAttribute('title', this.title());

      const icon = this.icon();
      if (icon) element.setAttribute('icon', icon);

      const tooltip = this.tooltip();
      if (tooltip) element.setAttribute('tooltip', tooltip);

      element.setAttribute('order', String(this.order()));

      // Register the template for this element
      toolPanelTemplateRegistry.set(element, template);
    }
  });

  /**
   * Static type guard for template context.
   * Enables type inference in templates.
   */
  static ngTemplateContextGuard(dir: GridToolPanel, ctx: unknown): ctx is GridToolPanelContext {
    return true;
  }
}
