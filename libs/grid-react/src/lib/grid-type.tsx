import type { CellRenderContext, ColumnEditorContext } from '@toolbox-web/grid';
import { useCallback, useRef, type ReactNode } from 'react';
import '../jsx.d.ts';
import { registerTypeEditor, registerTypeRenderer } from './react-grid-adapter';

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

/**
 * Props for the GridType component.
 *
 * @since 2.0.0
 */
export interface GridTypeProps<TRow = unknown, TValue = unknown> {
  /** Type name that columns reference via `type`. */
  name: string;
  /** Optional params surfaced as `typeDefault.*` in templates. */
  params?: Record<string, string | number | boolean>;
  /** Custom type-level cell renderer. */
  children?: (ctx: CellRenderContext<TRow, TValue>) => ReactNode;
  /** Custom type-level cell editor. Requires the editing feature/plugin. */
  editor?: (ctx: ColumnEditorContext<TRow, TValue>) => ReactNode;
}

/**
 * Type-default configuration component for use with DataGrid light DOM.
 *
 * Renders a `<tbw-grid-type>` custom element and registers React renderer
 * functions on the framework adapter registry keyed by type name.
 *
 * @since 2.0.0
 */
export function GridType<TRow = unknown, TValue = unknown>(props: GridTypeProps<TRow, TValue>): React.ReactElement {
  const { name, params, children, editor } = props;

  const elementRef = useRef<HTMLElement | null>(null);

  const refCallback = useCallback(
    (element: HTMLElement | null) => {
      elementRef.current = element;
      if (!element) return;

      if (children) {
        registerTypeRenderer(element, children as (ctx: CellRenderContext<unknown, unknown>) => ReactNode);
      }
      if (editor) {
        registerTypeEditor(element, editor as (ctx: ColumnEditorContext<unknown, unknown>) => ReactNode);
      }
    },
    [children, editor],
  );

  const attrs: Record<string, unknown> = {
    name,
    ref: refCallback,
  };

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      attrs[`data-${toKebabCase(k)}`] = String(v);
    }
  }

  return (
    <tbw-grid-type {...attrs}>
      {children ? <tbw-grid-column-view /> : null}
      {editor ? <tbw-grid-column-editor /> : null}
    </tbw-grid-type>
  );
}
