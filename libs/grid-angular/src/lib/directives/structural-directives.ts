import { Directive, effect, ElementRef, inject, OnDestroy, TemplateRef } from '@angular/core';
import { getEditorTemplate } from './grid-column-editor.directive';
import { getViewTemplate } from './grid-column-view.directive';

/**
 * Context type for structural directives with `any` defaults.
 * This provides better ergonomics in templates without requiring explicit type annotations.
 *
 * @internal Use `GridCellContext` in application code for stricter typing.
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

/**
 * Context type for structural editor directives with `any` defaults.
 * This provides better ergonomics in templates without requiring explicit type annotations.
 *
 * @internal Use `GridEditorContext` in application code for stricter typing.
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
}

// Registries for structural directive templates
const structuralViewRegistry = new Map<HTMLElement, TemplateRef<StructuralCellContext>>();
const structuralEditorRegistry = new Map<HTMLElement, TemplateRef<StructuralEditorContext>>();

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
 * import { TbwEditor } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   imports: [TbwEditor],
 *   // ...
 * })
 * ```
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
