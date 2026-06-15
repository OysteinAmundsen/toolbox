import type { ToolbarContentDefinition } from '@toolbox-web/grid';
// Activate the `PluginNameMap` augmentation so `grid.getPluginByName('shell')`
// is typed as the shell plugin (which owns register/unregisterToolbarContent).
import { useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { GridElementContext } from './grid-element-context';
import { removeFromContainer, renderToContainer } from './portal-bridge';

/**
 * Props for {@link GridToolbarContent}.
 * @since 1.8.0
 */
export interface GridToolbarContentProps {
  /**
   * Unique identifier for this toolbar content entry.
   * Defaults to a stable React-generated id (`tbw-toolbar-content-:rN:`).
   */
  id?: string;
  /**
   * Render order priority. Lower values appear first.
   * @default 100
   */
  order?: number;
  /** React content to project into the grid shell toolbar. */
  children: ReactNode;
}

/**
 * Declarative wrapper around the grid's imperative
 * {@link ShellPlugin.registerToolbarContent} API.
 *
 * Mounts its children into the slot the grid provides for toolbar content while
 * keeping them inside the React tree. Must be a descendant of `<DataGrid>`.
 *
 * Prefer this over `<tbw-grid-tool-buttons>` (light DOM) when you need
 * reactive props or callbacks bound to React state. Use the light-DOM form
 * for static markup that should be moved verbatim into the toolbar.
 *
 * @example
 * ```tsx
 * <DataGrid gridConfig={config}>
 *   <GridToolbarContent id="calendar-nav" order={0}>
 *     <ToolbarNav onPrev={prev} onToday={today} onNext={next} />
 *   </GridToolbarContent>
 * </DataGrid>
 * ```
 *
 * @category Component
 * @since 1.8.0
 */
export function GridToolbarContent({ id: idProp, order = 100, children }: GridToolbarContentProps): null {
  const generatedId = useId();
  const id = idProp ?? `tbw-toolbar-content-${generatedId}`;

  const gridRef = useContext(GridElementContext);

  const [container, setContainer] = useState<HTMLElement | null>(null);
  const portalKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const grid = gridRef?.current;
    if (!grid) return;
    const portalKeyForCleanup = portalKeyRef;

    let unmounted = false;

    void (async () => {
      try {
        await grid.ready?.();
      } catch {
        return;
      }
      if (unmounted) return;

      const def: ToolbarContentDefinition = {
        id,
        order,
        render: (el) => {
          setContainer(el);
          // No-op cleanup — see comment in grid-header-content.tsx.
          return () => {
            /* intentionally empty */
          };
        },
      };
      // Route through the shell plugin (#370). The core grid-element delegates
      // (`grid.registerToolbarContent`) are deprecated (TBW076) and removed at v3;
      // fall back to them only on cores that predate the shell plugin.
      const shell = grid.getPluginByName?.('shell');
      if (shell?.registerToolbarContent) {
        shell.registerToolbarContent(def);
      } else {
        grid.registerToolbarContent?.(def);
      }
    })();

    return () => {
      unmounted = true;
      const shell = grid.getPluginByName?.('shell');
      if (shell?.unregisterToolbarContent) {
        shell.unregisterToolbarContent(id);
      } else {
        grid.unregisterToolbarContent?.(id);
      }
      if (portalKeyForCleanup.current) {
        removeFromContainer(portalKeyForCleanup.current, { sync: true });
        portalKeyForCleanup.current = null;
      }
      setContainer(null);
    };
  }, [gridRef, id, order]);

  useEffect(() => {
    if (!container) return;
    const grid = gridRef?.current ?? undefined;
    portalKeyRef.current = renderToContainer(container, children, portalKeyRef.current ?? undefined, grid);
  }, [children, container, gridRef]);

  return null;
}
