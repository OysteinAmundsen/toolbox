import type {
  ColumnConfig as BaseColumnConfig,
  GridConfig as BaseGridConfig,
  CellRenderContext,
  ColumnEditorContext,
  HeaderCellContext,
  HeaderLabelContext,
  LoadingContext,
} from '@toolbox-web/grid';
import type { ReactNode } from 'react';
import { notifyEditorMounted } from './editor-mount-hooks';
import { removeFromContainer, renderToContainer } from './portal-bridge';

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
 * @since 0.0.1
 */
export interface ColumnConfig<TRow = unknown> extends Omit<
  BaseColumnConfig<TRow>,
  'renderer' | 'viewRenderer' | 'editor' | 'headerRenderer' | 'headerLabelRenderer'
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

  /**
   * React component header renderer for full header cell control.
   * Receives header cell context and returns a React node (JSX).
   */
  headerRenderer?: (ctx: HeaderCellContext<TRow>) => ReactNode;

  /**
   * React component header label renderer for customizing just the label portion.
   * Receives header label context and returns a React node (JSX).
   */
  headerLabelRenderer?: (ctx: HeaderLabelContext<TRow>) => ReactNode;
}

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
 * @since 0.0.1
 */
export type GridConfig<TRow = unknown> = Omit<BaseGridConfig<TRow>, 'columns' | 'loadingRenderer'> & {
  columns?: ColumnConfig<TRow>[];
  /**
   * Custom loading renderer - can be a vanilla DOM function or a React render function returning JSX.
   */
  loadingRenderer?: BaseGridConfig<TRow>['loadingRenderer'] | ((ctx: LoadingContext) => ReactNode);
};

// #endregion

// Symbol used to mark configs that have already been processed by processGridConfig.
// This prevents double-wrapping when the grid's `set gridConfig` setter calls
// adapter.processConfig on an already-processed config.
const REACT_PROCESSED = Symbol('reactProcessed');

// Track portal keys for config-based editors (for cleanup via cleanupConfigRootsIn).
// Map keyed by container so `cleanupConfigRootsIn` can resolve only the
// containers actually inside the released cell via DOM query — avoids an
// O(total mounted portals) scan on every `releaseCell` call.
type MountedEntry = { key: string; unsub?: () => void };
const mountedPortals = new Map<HTMLElement, MountedEntry>();

/**
 * Clean up config-based editor and renderer portals whose containers are
 * inside the given element. Called by the React GridAdapter's `releaseCell`
 * to unmount portals created by `wrapReactEditor` / `wrapReactRenderer`
 * (which bypass the adapter's per-cell portal tracking).
 *
 * Targets both `.react-cell-editor` AND `.react-cell-renderer` containers:
 * editors always tear down on cell release, and renderers MUST also tear
 * down before the editing pipeline runs `cell.innerHTML = ''` (otherwise
 * React's still-mounted fiber tree points at orphan DOM and throws on the
 * next commit — see `wrapReactRenderer` doc and issue #250). The renderer
 * cache will create a fresh container on the next render via its
 * cellEl.contains() check.
 *
 * @internal
 */
export function cleanupConfigRootsIn(parentEl: HTMLElement): void {
  // Scoped DOM query keeps cost proportional to the cell's contents
  // instead of the global mount count.
  const containers = parentEl.querySelectorAll<HTMLElement>('.react-cell-editor, .react-cell-renderer');
  for (const container of containers) {
    const entry = mountedPortals.get(container);
    if (!entry) continue;
    entry.unsub?.();
    removeFromContainer(entry.key, { sync: true });
    mountedPortals.delete(container);
  }
}

/**
 * Creates a portal host `<div>` with the given class name and `display:contents`
 * so it is layout-transparent inside the grid cell. Used by all `wrapReact*`
 * helpers to avoid repeating the three-line boilerplate.
 * @internal
 */
function createPortalContainer(className: string): HTMLDivElement {
  const container = document.createElement('div');
  container.className = className;
  container.style.display = 'contents';
  return container;
}

/**
 * Returns a function that, when invoked, blurs the focused input/textarea/select
 * inside `container` (if any). Used by the `before-edit-close` bridge so editors
 * with `onBlur={commit}` flush their pending value before the cell DOM is torn
 * down by Tab / programmatic row exit. The native `.blur()` method fires both
 * `blur` (non-bubbling) and `focusout` (bubbling) — React's event delegation
 * listens to `focusout` and maps it to `onBlur`.
 * @internal
 */
export function makeFlushFocusedInput(container: HTMLElement): () => void {
  return () => {
    const focused = container.ownerDocument.activeElement as HTMLElement | null;
    if (
      focused &&
      container.contains(focused) &&
      (focused instanceof HTMLInputElement ||
        focused instanceof HTMLTextAreaElement ||
        focused instanceof HTMLSelectElement)
    ) {
      focused.blur();
    }
  };
}

/**
 * Wraps a React renderer function into a DOM-returning viewRenderer.
 * Used internally by DataGrid to process reactRenderer properties.
 *
 * Cache invariant: a cached `{ portalKey, container }` is only safe to reuse
 * while `container` is still attached to the original cell. The editing
 * pipeline (`editor-injection.ts`) wipes a cell with `cell.innerHTML = ''`
 * when an editor opens — this detaches the renderer container from the cell
 * without React knowing, leaving React's fiber tree pointing at orphaned
 * nodes. If we then reuse the cached entry on the next render, the user's
 * `onCellCommit` → `setRows` triggers a React commit that tries to
 * `removeChild` nodes that no longer exist in the DOM and throws
 * `NotFoundError: Failed to execute 'removeChild' on 'Node'` (issue #250).
 *
 * Defense: before reusing a cached entry, verify the container is still
 * inside the cell. If not, synchronously unmount the stale React root
 * (`removeFromContainer(..., { sync: true })` so it tears down before any
 * batched user setState runs against it) and create a fresh container.
 */
export function wrapReactRenderer<TRow>(
  renderFn: (ctx: CellRenderContext<TRow>) => ReactNode,
): (ctx: CellRenderContext<TRow>) => HTMLElement {
  // Cell cache for reusing portals
  const cellCache = new WeakMap<HTMLElement, { portalKey: string; container: HTMLElement }>();

  return (ctx: CellRenderContext<TRow>) => {
    const cellEl = (ctx as any).cellEl as HTMLElement | undefined;

    if (cellEl) {
      const cached = cellCache.get(cellEl);
      if (cached) {
        if (cellEl.contains(cached.container)) {
          renderToContainer(cached.container, renderFn(ctx), cached.portalKey);
          return cached.container;
        }
        // Cached container was detached (typically by editor-injection's
        // cell.innerHTML = ''). Tear down the stale React root before
        // creating a fresh one, otherwise the orphaned root will throw
        // when the next React commit tries to reconcile its children.
        removeFromContainer(cached.portalKey, { sync: true });
        cellCache.delete(cellEl);
      }
    }

    const container = createPortalContainer('react-cell-renderer');

    const portalKey = renderToContainer(container, renderFn(ctx));

    if (cellEl) {
      cellCache.set(cellEl, { portalKey, container });
    }
    mountedPortals.set(container, { key: portalKey });

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
    const container = createPortalContainer('react-cell-editor');

    const portalKey = renderToContainer(container, editorFn(ctx));
    const entry: MountedEntry = { key: portalKey };
    mountedPortals.set(container, entry);

    // Run editor-mount hooks (e.g. `before-edit-close` blur bridge installed
    // by `@toolbox-web/grid-react/features/editing`). The grid element is
    // resolved lazily via `queueMicrotask` because the container is appended
    // to the cell *after* this function returns. If editing isn't imported,
    // no hooks run and editors lose the Tab-flush bridge — which matches the
    // editing precondition (the EditingPlugin needs the same import to
    // exist at all).
    queueMicrotask(() => {
      const gridEl = container.closest('tbw-grid') as HTMLElement | null;
      if (!gridEl) return;
      entry.unsub = notifyEditorMounted(container, gridEl);
    });

    return container;
  };
}

/**
 * Wraps a React header renderer function into a DOM-returning function.
 * Used internally by DataGrid to process headerRenderer properties.
 */
export function wrapReactHeaderRenderer<TRow>(
  renderFn: (ctx: HeaderCellContext<TRow>) => ReactNode,
): (ctx: HeaderCellContext<TRow>) => HTMLElement {
  return (ctx: HeaderCellContext<TRow>) => {
    const container = createPortalContainer('react-header-renderer');

    const portalKey = renderToContainer(container, renderFn(ctx));
    mountedPortals.set(container, { key: portalKey });

    return container;
  };
}

/**
 * Wraps a React header label renderer function into a DOM-returning function.
 * Used internally by DataGrid to process headerLabelRenderer properties.
 */
export function wrapReactHeaderLabelRenderer<TRow>(
  renderFn: (ctx: HeaderLabelContext<TRow>) => ReactNode,
): (ctx: HeaderLabelContext<TRow>) => HTMLElement {
  return (ctx: HeaderLabelContext<TRow>) => {
    const container = createPortalContainer('react-header-label-renderer');

    const portalKey = renderToContainer(container, renderFn(ctx));
    mountedPortals.set(container, { key: portalKey });

    return container;
  };
}

/**
 * Wraps a React loading renderer function into a DOM-returning function.
 * Used internally by processGridConfig to process loadingRenderer properties.
 * Skips wrapping if the function already returns an HTMLElement or string (vanilla DOM renderer).
 */
export function wrapReactLoadingRenderer(
  renderFn: (ctx: LoadingContext) => ReactNode,
): (ctx: LoadingContext) => HTMLElement | string {
  return (ctx: LoadingContext) => {
    // Call the function to see what it returns
    const result = renderFn(ctx);

    // If the result is already an HTMLElement or string, pass through (vanilla renderer)
    if (result instanceof HTMLElement || typeof result === 'string') {
      return result;
    }

    // Otherwise, mount as React JSX
    const container = createPortalContainer('react-loading-renderer');

    const portalKey = renderToContainer(container, result);
    mountedPortals.set(container, { key: portalKey });

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

  // Already processed — return as-is to prevent double-wrapping
  if ((config as any)[REACT_PROCESSED]) return config as BaseGridConfig<TRow>;

  // Process loadingRenderer at grid config level
  if (config.loadingRenderer && typeof config.loadingRenderer === 'function') {
    const originalRenderer = config.loadingRenderer as (ctx: LoadingContext) => ReactNode;
    config = {
      ...config,
      loadingRenderer: wrapReactLoadingRenderer(originalRenderer) as unknown as BaseGridConfig<TRow>['loadingRenderer'],
    };
  }

  if (!config.columns) {
    const result = config as BaseGridConfig<TRow>;
    (result as any)[REACT_PROCESSED] = true;
    return result;
  }

  const processedColumns = config.columns.map((col) => {
    const { renderer, editor, headerRenderer, headerLabelRenderer, ...rest } = col as ColumnConfig<TRow>;
    const processed = { ...rest } as BaseColumnConfig<TRow>;

    // Convert React renderer to DOM renderer
    if (renderer) {
      (processed as any).renderer = wrapReactRenderer(renderer) as any;
    }

    // Convert React editor to DOM editor
    if (editor) {
      processed.editor = wrapReactEditor(editor) as any;
    }

    // Convert React header renderer to DOM header renderer
    if (headerRenderer) {
      (processed as any).headerRenderer = wrapReactHeaderRenderer(headerRenderer);
    }

    // Convert React header label renderer to DOM header label renderer
    if (headerLabelRenderer) {
      (processed as any).headerLabelRenderer = wrapReactHeaderLabelRenderer(headerLabelRenderer);
    }

    return processed;
  });

  const result = {
    ...config,
    columns: processedColumns,
  } as BaseGridConfig<TRow>;

  // Mark as processed so subsequent calls (e.g. from the grid setter's
  // adapter.processConfig) skip re-wrapping.
  (result as any)[REACT_PROCESSED] = true;

  return result;
}
