import type { CellRenderContext, ColumnConfig, ColumnEditorContext, GridConfig } from '@toolbox-web/grid';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

/**
 * Extended column config that supports React components for renderers/editors.
 *
 * Use `renderer` and `editor` properties to define React-based cell renderers
 * and editors directly in your gridConfig. These accept React render functions
 * that return ReactNode (JSX).
 *
 * @example
 * ```tsx
 * const gridConfig: ReactGridConfig<Employee> = {
 *   columns: [
 *     {
 *       field: 'status',
 *       header: 'Status',
 *       // React renderer - same property name as vanilla, but returns JSX
 *       renderer: (ctx) => <StatusBadge value={ctx.value} />,
 *       // React editor - same property name as vanilla, but returns JSX
 *       editor: (ctx) => (
 *         <StatusSelect
 *           value={ctx.value}
 *           onCommit={ctx.commit}
 *           onCancel={ctx.cancel}
 *         />
 *       ),
 *     },
 *   ],
 * };
 * ```
 */
export interface ReactColumnConfig<TRow = unknown> extends Omit<
  ColumnConfig<TRow>,
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
 * Grid config with React-enhanced column definitions.
 */
export type ReactGridConfig<TRow = unknown> = Omit<GridConfig<TRow>, 'columns'> & {
  columns?: ReactColumnConfig<TRow>[];
};

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
 * Processes a ReactGridConfig, converting React renderer/editor functions
 * to DOM-returning functions that the grid core understands.
 *
 * @internal Used by DataGrid component
 */
export function processReactGridConfig<TRow>(config: ReactGridConfig<TRow> | undefined): GridConfig<TRow> | undefined {
  if (!config) return undefined;
  if (!config.columns) return config as GridConfig<TRow>;

  const processedColumns = config.columns.map((col) => {
    const { renderer, editor, ...rest } = col as ReactColumnConfig<TRow>;
    const processed = { ...rest } as ColumnConfig<TRow>;

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
  } as GridConfig<TRow>;
}
