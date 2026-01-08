import { contentChild, Directive, effect, ElementRef, EventEmitter, inject, TemplateRef } from '@angular/core';

/**
 * Context object passed to the cell editor template.
 * Contains the cell value, row data, column configuration, and commit/cancel functions.
 */
export interface GridEditorContext<TValue = unknown, TRow = unknown> {
  /** The cell value for this column */
  $implicit: TValue;
  /** The cell value (explicit binding) */
  value: TValue;
  /** The full row data object */
  row: TRow;
  /** The column configuration */
  column: unknown;
  /** Event emitter to commit the edited value */
  commit: EventEmitter<TValue>;
  /** Event emitter to cancel editing */
  cancel: EventEmitter<void>;
}

// Global registry mapping DOM elements to their templates
const editorTemplateRegistry = new Map<HTMLElement, TemplateRef<GridEditorContext>>();

/**
 * Gets the editor template registered for a given element.
 * Used by AngularGridAdapter to retrieve templates at render time.
 */
export function getEditorTemplate(element: HTMLElement): TemplateRef<GridEditorContext> | undefined {
  return editorTemplateRegistry.get(element);
}

/**
 * Directive that captures an `<ng-template>` for use as a cell editor.
 *
 * This enables declarative Angular component usage with proper input bindings
 * that satisfy Angular's AOT compiler.
 *
 * ## Usage
 *
 * ```html
 * <tbw-grid-column field="status" editable>
 *   <tbw-grid-column-editor>
 *     <ng-template let-value let-row="row" let-commit="commit" let-cancel="cancel">
 *       <app-status-select
 *         [value]="value"
 *         [row]="row"
 *         (commit)="commit.emit($event)"
 *         (cancel)="cancel.emit()"
 *       />
 *     </ng-template>
 *   </tbw-grid-column-editor>
 * </tbw-grid-column>
 * ```
 *
 * The template context provides:
 * - `$implicit` / `value`: The cell value
 * - `row`: The full row data object
 * - `column`: The column configuration
 * - `commit`: EventEmitter to commit the new value
 * - `cancel`: EventEmitter to cancel editing
 *
 * Import the directive in your component:
 *
 * ```typescript
 * import { GridColumnEditor } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   imports: [GridColumnEditor],
 *   // ...
 * })
 * ```
 */
@Directive({ selector: 'tbw-grid-column-editor' })
export class GridColumnEditor {
  private elementRef = inject(ElementRef<HTMLElement>);

  /**
   * Query for the ng-template content child.
   */
  template = contentChild(TemplateRef<GridEditorContext>);

  /** Effect that triggers when the template is available */
  private onTemplateReceived = effect(() => {
    const template = this.template();
    if (template) {
      // Register the template for this element
      editorTemplateRegistry.set(this.elementRef.nativeElement, template);
    }
  });

  /**
   * Static type guard for template context.
   * Enables type inference in templates.
   */
  static ngTemplateContextGuard(dir: GridColumnEditor, ctx: unknown): ctx is GridEditorContext {
    return true;
  }
}
