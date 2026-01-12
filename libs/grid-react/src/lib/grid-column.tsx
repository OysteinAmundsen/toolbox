import type { CellRenderContext, ColumnEditorContext } from '@toolbox-web/grid';
import { useCallback, useRef, type ReactNode } from 'react';
import '../jsx.d.ts';
import { registerColumnEditor, registerColumnRenderer } from './react-grid-adapter';

/**
 * Props for the GridColumn component.
 */
export interface GridColumnProps<TRow = unknown, TValue = unknown> {
  /** Field key in the row object */
  field: keyof TRow & string;
  /** Column header text (defaults to capitalized field) */
  header?: string;
  /** Column data type */
  type?: 'string' | 'number' | 'date' | 'boolean' | 'select' | 'typeahead';
  /** Whether the column is editable */
  editable?: boolean;
  /** Whether the column is sortable */
  sortable?: boolean;
  /** Whether the column is resizable */
  resizable?: boolean;
  /** Column width (e.g., "100px", "10%") */
  width?: string | number;
  /** Minimum width for stretch mode */
  minWidth?: number;
  /** Whether the column is hidden */
  hidden?: boolean;
  /** Prevent column from being hidden */
  lockVisible?: boolean;
  /**
   * Custom cell renderer (render prop pattern).
   * Receives cell context and returns React node.
   *
   * @example
   * ```tsx
   * <GridColumn field="status">
   *   {(ctx) => <StatusBadge status={ctx.value} />}
   * </GridColumn>
   * ```
   */
  children?: (ctx: CellRenderContext<TRow, TValue>) => ReactNode;
  /**
   * Custom cell editor.
   * Receives editor context with commit/cancel functions.
   *
   * @example
   * ```tsx
   * <GridColumn
   *   field="name"
   *   editable
   *   editor={(ctx) => (
   *     <input
   *       defaultValue={ctx.value}
   *       onBlur={(e) => ctx.commit(e.target.value)}
   *       onKeyDown={(e) => e.key === 'Escape' && ctx.cancel()}
   *     />
   *   )}
   * />
   * ```
   */
  editor?: (ctx: ColumnEditorContext<TRow, TValue>) => ReactNode;
  /** Select/typeahead options */
  options?: Array<{ label: string; value: unknown }>;
  /** Allow multiple selection (for select/typeahead) */
  multi?: boolean;
  /** Custom formatter function */
  format?: (value: TValue, row: TRow) => string;
}

/**
 * Column configuration component for use with DataGrid.
 *
 * Renders a `<tbw-grid-column>` custom element in the light DOM
 * and registers React renderers/editors with the adapter.
 *
 * ## Basic Usage
 *
 * ```tsx
 * <DataGrid rows={rows}>
 *   <GridColumn field="name" header="Full Name" />
 *   <GridColumn field="age" type="number" sortable />
 * </DataGrid>
 * ```
 *
 * ## Custom Renderer
 *
 * ```tsx
 * <GridColumn field="status">
 *   {(ctx) => (
 *     <span className={`status-${ctx.value}`}>
 *       {ctx.value}
 *     </span>
 *   )}
 * </GridColumn>
 * ```
 *
 * ## Custom Editor
 *
 * ```tsx
 * <GridColumn
 *   field="price"
 *   editable
 *   editor={(ctx) => (
 *     <input
 *       type="number"
 *       defaultValue={ctx.value}
 *       onBlur={(e) => ctx.commit(Number(e.target.value))}
 *       onKeyDown={(e) => {
 *         if (e.key === 'Enter') ctx.commit(Number(e.currentTarget.value));
 *         if (e.key === 'Escape') ctx.cancel();
 *       }}
 *     />
 *   )}
 * />
 * ```
 */
export function GridColumn<TRow = unknown, TValue = unknown>(props: GridColumnProps<TRow, TValue>): React.ReactElement {
  const {
    field,
    header,
    type,
    editable,
    sortable,
    resizable,
    width,
    minWidth,
    hidden,
    lockVisible,
    children,
    editor,
    options,
    multi,
    format,
  } = props;

  // Store a direct reference to the DOM element for debugging
  const elementRef = useRef<HTMLElement | null>(null);

  // Use ref callback to register renderer/editor synchronously when element attaches
  // This ensures registration happens before the grid parses light DOM columns
  const refCallback = useCallback(
    (element: HTMLElement | null) => {
      elementRef.current = element;

      if (!element) return;

      if (children) {
        registerColumnRenderer(element, children as (ctx: CellRenderContext<unknown, unknown>) => ReactNode);
      }

      if (editor) {
        registerColumnEditor(element, editor as (ctx: ColumnEditorContext<unknown, unknown>) => ReactNode);
      }
    },
    [children, editor, field],
  );

  // Convert width to string if number
  const widthStr = typeof width === 'number' ? `${width}px` : width;

  // Build attributes object using bracket notation for index signature compatibility
  const attrs: Record<string, unknown> = {
    field,
    ref: refCallback,
  };

  if (header !== undefined) attrs['header'] = header;
  if (type !== undefined) attrs['type'] = type;
  if (editable !== undefined) attrs['editable'] = editable;
  if (sortable !== undefined) attrs['sortable'] = sortable;
  if (resizable !== undefined) attrs['resizable'] = resizable;
  if (widthStr !== undefined) attrs['width'] = widthStr;
  if (minWidth !== undefined) attrs['min-width'] = minWidth;
  if (hidden !== undefined) attrs['hidden'] = hidden;
  if (lockVisible !== undefined) attrs['lock-visible'] = lockVisible;
  if (multi !== undefined) attrs['multi'] = multi;

  // Store format and options in data attributes for the adapter to pick up
  // These are handled by the grid's column parsing logic
  if (format) {
    // Format function needs to be stored on the element
    // The grid will access it during column parsing
    attrs['data-has-format'] = 'true';
  }
  if (options) {
    attrs['data-has-options'] = 'true';
  }

  return <tbw-grid-column {...attrs} />;
}
