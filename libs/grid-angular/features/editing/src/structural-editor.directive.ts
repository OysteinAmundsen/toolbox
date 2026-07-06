import { Directive, effect, ElementRef, inject, OnDestroy, TemplateRef } from '@angular/core';
import type { AbstractControl } from '@angular/forms';
import { getEditorTemplate } from './grid-column-editor.directive';

/**
 * Context type for structural editor directives with `any` defaults.
 * This provides better ergonomics in templates without requiring explicit type annotations.
 *
 * @internal Use `GridEditorContext` in application code for stricter typing.
 * @since 0.1.1
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface StructuralEditorContext<TValue = any, TRow = any> {
  /** The cell value for this column */
  $implicit: TValue;
  /** The cell value (explicit binding) */
  value: TValue;
  /** The full row data object */
  row: TRow;
  /** The column configuration */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: any;
  /**
   * Callback function to commit the edited value.
   */
  onCommit: (value: TValue) => void;
  /**
   * Callback function to cancel editing.
   */
  onCancel: () => void;
  /**
   * The FormControl for this cell, if the grid is bound to a FormArray with FormGroups.
   *
   * Returns `undefined` if:
   * - The grid is not bound to a FormArray
   * - The FormArray doesn't contain FormGroups
   * - The field doesn't exist in the FormGroup
   */
  control?: AbstractControl;
}

// Registry for structural editor templates
const structuralEditorRegistry = new Map<HTMLElement, TemplateRef<StructuralEditorContext>>();

/**
 * Gets the editor template registered by the structural directive for a given column element.
 * Falls back to the non-structural directive registry.
 */
export function getStructuralEditorTemplate(
  columnElement: HTMLElement,
): TemplateRef<StructuralEditorContext> | undefined {
  // First check structural directive registry
  const template = structuralEditorRegistry.get(columnElement);
  if (template) return template;

  // Fall back to the nested element registry
  const editorEl = columnElement.querySelector('tbw-grid-column-editor');
  if (editorEl) {
    return getEditorTemplate(editorEl as HTMLElement) as TemplateRef<StructuralEditorContext> | undefined;
  }
  return undefined;
}

/**
 * Structural directive for cell editor rendering.
 *
 * This provides a cleaner syntax for defining custom cell editors without
 * the nested `<tbw-grid-column-editor>` and `<ng-template>` boilerplate.
 *
 * ## Usage
 *
 * ```html
 * <!-- Instead of this verbose syntax: -->
 * <tbw-grid-column field="status">
 *   <tbw-grid-column-editor>
 *     <ng-template let-value let-onCommit="onCommit" let-onCancel="onCancel">
 *       <app-status-editor [value]="value" (commit)="onCommit($event)" (cancel)="onCancel()" />
 *     </ng-template>
 *   </tbw-grid-column-editor>
 * </tbw-grid-column>
 *
 * <!-- Use this cleaner syntax (with auto-wiring - no explicit bindings needed!): -->
 * <tbw-grid-column field="status">
 *   <app-status-editor *tbwEditor="let value" [value]="value" />
 * </tbw-grid-column>
 * ```
 *
 * ## Template Context
 *
 * The structural directive provides the same context as `GridColumnEditor`:
 * - `$implicit` / `value`: The cell value
 * - `row`: The full row data object
 * - `column`: The column configuration
 * - `onCommit`: Callback function to commit the new value (optional - auto-wired if component emits `commit` event)
 * - `onCancel`: Callback function to cancel editing (optional - auto-wired if component emits `cancel` event)
 *
 * ## Import
 *
 * ```typescript
 * import { TbwEditor } from '@toolbox-web/grid-angular/features/editing';
 *
 * @Component({
 *   imports: [TbwEditor],
 *   // ...
 * })
 * ```
 *
 * @example
 * ```html
 * <tbw-grid-column field="status" editable>
 *   <app-status-editor *tbwEditor="let value" [value]="value" />
 * </tbw-grid-column>
 * ```
 *
 * @category Directive
 * @since 0.1.1
 */
@Directive({ selector: '[tbwEditor]' })
export class TbwEditor implements OnDestroy {
  private template = inject(TemplateRef<StructuralEditorContext>);
  private elementRef = inject(ElementRef<HTMLElement>);
  private columnElement: HTMLElement | null = null;

  constructor() {
    effect(() => {
      this.registerTemplate();
    });
  }

  private registerTemplate(): void {
    // Find the parent tbw-grid-column element
    let parent = this.elementRef.nativeElement?.parentElement;
    while (parent && parent.tagName !== 'TBW-GRID-COLUMN') {
      parent = parent.parentElement;
    }

    if (parent) {
      this.columnElement = parent;
      structuralEditorRegistry.set(parent, this.template);
    }
  }

  ngOnDestroy(): void {
    if (this.columnElement) {
      structuralEditorRegistry.delete(this.columnElement);
    }
  }

  /**
   * Static type guard for template context.
   * Uses `any` defaults for ergonomic template usage.
   */
  static ngTemplateContextGuard(dir: TbwEditor, ctx: unknown): ctx is StructuralEditorContext {
    return true;
  }
}
