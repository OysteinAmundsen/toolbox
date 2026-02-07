import type {
  ColumnConfig as BaseColumnConfig,
  GridConfig as BaseGridConfig,
  CellRenderContext,
  ColumnEditorContext,
} from '@toolbox-web/grid';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

// #region ColumnConfig Interface
/**
 * Column configuration for React applications.
 *
 * Extends the base ColumnConfig with `renderer` and `editor` properties
 * that accept React render functions returning JSX.
 *
 * @example
 * ```tsx
 * import type { GridConfig, ColumnConfig } from '@toolbox-web/grid-react';
 *
 * const columns: ColumnConfig<Employee>[] = [
 *   { field: 'name', header: 'Name' },
 *   {
 *     field: 'status',
 *     header: 'Status',
 *     renderer: (ctx) => <StatusBadge value={ctx.value} />,
 *     editor: (ctx) => (
 *       <StatusSelect
 *         value={ctx.value}
 *         onCommit={ctx.commit}
 *         onCancel={ctx.cancel}
 *       />
 *     ),
 *   },
 * ];
 * ```
 */
export interface ColumnConfig<TRow = unknown> extends Omit<
  BaseColumnConfig<TRow>,
  'renderer' | 'viewRenderer' | 'editor'
> {
  /**
   * React component renderer for cell display.
   * Receives cell context and returns a React node (JSX).
   *
   * Same property name as vanilla JS, but accepts React components.
   */
  renderer?: (ctx: CellRenderContext<TRow>) => ReactNode;

  /**
   * React component editor for cell editing.
   * Receives editor context with commit/cancel functions and returns a React node (JSX).
   *
   * Same property name as vanilla JS, but accepts React components.
   */
  editor?: (ctx: ColumnEditorContext<TRow>) => ReactNode;
}

/**
 * @deprecated Use `ColumnConfig` instead.
 * @see {@link ColumnConfig}
 */
export type ReactColumnConfig<TRow = unknown> = ColumnConfig<TRow>;
// #endregion

// #region GridConfig Type
/**
 * Grid configuration for React applications.
 *
 * Uses React-augmented ColumnConfig that accepts JSX render functions.
 *
 * @example
 * ```tsx
 * import type { GridConfig } from '@toolbox-web/grid-react';
 *
 * const config: GridConfig<Employee> = {
 *   columns: [
 *     { field: 'name', header: 'Name' },
 *     {
 *       field: 'status',
 *       renderer: (ctx) => <StatusBadge value={ctx.value} />,
 *     },
 *   ],
 * };
 * ```
 */
export type GridConfig<TRow = unknown> = Omit<BaseGridConfig<TRow>, 'columns'> & {
  columns?: ColumnConfig<TRow>[];
};

/**
 * @deprecated Use `GridConfig` instead.
 * @see {@link GridConfig}
 */
export type ReactGridConfig<TRow = unknown> = GridConfig<TRow>;
// #endregion

// Track mounted roots for cleanup
const mountedRoots: Root[] = [];

/**
 * Wraps a React renderer function into a DOM-returning viewRenderer.
 * Used internally by DataGrid to process reactRenderer properties.
 */
export function wrapReactRenderer<TRow>(
  renderFn: (ctx: CellRenderContext<TRow>) => ReactNode,
): (ctx: CellRenderContext<TRow>) => HTMLElement {
  // Cell cache for reusing React roots
  const cellCache = new WeakMap<HTMLElement, { root: Root; container: HTMLElement }>();

  return (ctx: CellRenderContext<TRow>) => {
    const cellEl = (ctx as any).cellEl as HTMLElement | undefined;

    if (cellEl) {
      const cached = cellCache.get(cellEl);
      if (cached) {
        flushSync(() => {
          cached.root.render(renderFn(ctx));
        });
        return cached.container;
      }
    }

    const container = document.createElement('div');
    container.className = 'react-cell-renderer';
    container.style.display = 'contents';

    const root = createRoot(container);
    flushSync(() => {
      root.render(renderFn(ctx));
    });

    if (cellEl) {
      cellCache.set(cellEl, { root, container });
    }
    mountedRoots.push(root);

    return container;
  };
}

/**
 * Wraps a React editor function into a DOM-returning editor spec.
 * Used internally by DataGrid to process reactEditor properties.
 */
export function wrapReactEditor<TRow>(
  editorFn: (ctx: ColumnEditorContext<TRow>) => ReactNode,
): (ctx: ColumnEditorContext<TRow>) => HTMLElement {
  return (ctx: ColumnEditorContext<TRow>) => {
    const container = document.createElement('div');
    container.className = 'react-cell-editor';
    container.style.display = 'contents';

    const root = createRoot(container);
    flushSync(() => {
      root.render(editorFn(ctx));
    });
    mountedRoots.push(root);

    return container;
  };
}

/**
 * Processes a GridConfig, converting React renderer/editor functions
 * to DOM-returning functions that the grid core understands.
 *
 * @internal Used by DataGrid component
 */
export function processGridConfig<TRow>(config: GridConfig<TRow> | undefined): BaseGridConfig<TRow> | undefined {
  if (!config) return undefined;
  if (!config.columns) return config as BaseGridConfig<TRow>;

  const processedColumns = config.columns.map((col) => {
    const { renderer, editor, ...rest } = col as ColumnConfig<TRow>;
    const processed = { ...rest } as BaseColumnConfig<TRow>;

    // Convert React renderer to DOM renderer
    if (renderer) {
      (processed as any).renderer = wrapReactRenderer(renderer) as any;
    }

    // Convert React editor to DOM editor
    if (editor) {
      processed.editor = wrapReactEditor(editor) as any;
    }

    return processed;
  });

  return {
    ...config,
    columns: processedColumns,
  } as BaseGridConfig<TRow>;
}

/**
 * @deprecated Use `processGridConfig` instead.
 * @see {@link processGridConfig}
 */
export const processReactGridConfig = processGridConfig;
