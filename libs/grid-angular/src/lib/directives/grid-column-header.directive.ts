import { Directive, effect, ElementRef, inject, OnDestroy, TemplateRef } from '@angular/core';

/**
 * Declarative header templates for `<tbw-grid-column>`.
 *
 * Angular equivalent of React's `<GridColumn headerRenderer={...}>` render prop
 * and Vue's `<TbwGridColumn #header>` slot. Both adapters expose the same two
 * entry points, so Angular does too:
 *
 * - `*tbwHeader` — full header cell; you own sort icons and filter buttons.
 * - `*tbwHeaderLabel` — label text only; the grid keeps sort icons, filter
 *   buttons, and resize handles.
 *
 * @since 2.5.0
 */

/**
 * Context passed to a `*tbwHeader` template.
 *
 * Mirrors the core `HeaderCellContext`, with `$implicit` bound to the header
 * text so `let value` works.
 *
 * @since 2.5.0
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface GridHeaderContext<TRow = any> {
  /** The header text (from `column.header` or `column.field`). */
  $implicit: string;
  /** The header text (explicit binding). */
  value: string;
  /** Column configuration reference. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: any;
  /** Current sort state for this column. */
  sortState: 'asc' | 'desc' | null;
  /** Whether the column has an active filter. */
  filterActive: boolean;
  /** The header cell DOM element being rendered into. */
  cellEl: HTMLElement;
  /** Render the standard sort indicator icon. Null when not sortable. */
  renderSortIcon: () => HTMLElement | null;
  /** Render the standard filter button. Null when filtering is inactive. */
  renderFilterButton: () => HTMLElement | null;
  /** Row data shape marker — never populated at runtime. */
  readonly __row?: TRow;
}

/**
 * Context passed to a `*tbwHeaderLabel` template.
 *
 * @since 2.5.0
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface GridHeaderLabelContext<TRow = any> {
  /** The header text (from `column.header` or `column.field`). */
  $implicit: string;
  /** The header text (explicit binding). */
  value: string;
  /** Column configuration reference. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: any;
  /** Row data shape marker — never populated at runtime. */
  readonly __row?: TRow;
}

const headerRegistry = new Map<HTMLElement, TemplateRef<GridHeaderContext>>();
const headerLabelRegistry = new Map<HTMLElement, TemplateRef<GridHeaderLabelContext>>();

/**
 * Get the `*tbwHeader` template registered for a column element.
 * Used by `AngularGridAdapter.createHeaderRenderer`.
 *
 * @internal
 */
export function getHeaderTemplate(columnElement: HTMLElement): TemplateRef<GridHeaderContext> | undefined {
  return headerRegistry.get(columnElement);
}

/**
 * Get the `*tbwHeaderLabel` template registered for a column element.
 * Used by `AngularGridAdapter.createHeaderLabelRenderer`.
 *
 * @internal
 */
export function getHeaderLabelTemplate(columnElement: HTMLElement): TemplateRef<GridHeaderLabelContext> | undefined {
  return headerLabelRegistry.get(columnElement);
}

/**
 * Walk up from a structural directive's comment anchor to the owning
 * `<tbw-grid-column>` / `<tbw-grid-type>` element.
 */
function findColumnElement(start: HTMLElement | null | undefined): HTMLElement | null {
  let parent = start?.parentElement;
  while (parent && parent.tagName !== 'TBW-GRID-COLUMN' && parent.tagName !== 'TBW-GRID-TYPE') {
    parent = parent.parentElement;
  }
  return parent ?? null;
}

/**
 * Structural directive that supplies a full header cell template for a column.
 *
 * You own the header content: use `renderSortIcon()` and `renderFilterButton()`
 * from the context to opt back into the built-in affordances. Resize handles
 * are appended automatically for resizable columns.
 *
 * @example
 * ```html
 * <tbw-grid-column field="salary">
 *   <span *tbwHeader="let value; column as column">
 *     💰 {{ value }}
 *   </span>
 * </tbw-grid-column>
 * ```
 *
 * @category Directive
 * @since 2.5.0
 */
@Directive({ selector: '[tbwHeader]' })
export class TbwHeader implements OnDestroy {
  private template = inject(TemplateRef<GridHeaderContext>);
  private elementRef = inject(ElementRef<HTMLElement>);
  private columnElement: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const parent = findColumnElement(this.elementRef.nativeElement);
      if (parent) {
        this.columnElement = parent;
        headerRegistry.set(parent, this.template);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.columnElement) {
      headerRegistry.delete(this.columnElement);
    }
  }

  /** Static type guard so `let value` / `column as column` infer correctly. */
  static ngTemplateContextGuard(dir: TbwHeader, ctx: unknown): ctx is GridHeaderContext {
    void dir;
    void ctx;
    return true;
  }
}

/**
 * Structural directive that supplies a header *label* template for a column.
 *
 * The grid keeps ownership of sort icons, filter buttons, and resize handles;
 * only the label text is replaced.
 *
 * @example
 * ```html
 * <tbw-grid-column field="salary">
 *   <strong *tbwHeaderLabel="let value">{{ value }}</strong>
 * </tbw-grid-column>
 * ```
 *
 * @category Directive
 * @since 2.5.0
 */
@Directive({ selector: '[tbwHeaderLabel]' })
export class TbwHeaderLabel implements OnDestroy {
  private template = inject(TemplateRef<GridHeaderLabelContext>);
  private elementRef = inject(ElementRef<HTMLElement>);
  private columnElement: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const parent = findColumnElement(this.elementRef.nativeElement);
      if (parent) {
        this.columnElement = parent;
        headerLabelRegistry.set(parent, this.template);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.columnElement) {
      headerLabelRegistry.delete(this.columnElement);
    }
  }

  /** Static type guard so `let value` infers correctly. */
  static ngTemplateContextGuard(dir: TbwHeaderLabel, ctx: unknown): ctx is GridHeaderLabelContext {
    void dir;
    void ctx;
    return true;
  }
}
