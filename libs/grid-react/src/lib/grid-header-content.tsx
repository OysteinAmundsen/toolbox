import type { HeaderContentDefinition } from '@toolbox-web/grid/plugins/shell';
import { useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { GridElementContext } from './grid-element-context';
import { removeFromContainer, renderToContainer } from './portal-bridge';

/**
 * Props for {@link GridHeaderContent}.
 * @since 1.8.0
 */
export interface GridHeaderContentProps {
  /**
   * Unique identifier for this header content entry.
   * Defaults to a stable React-generated id (`tbw-header-content-:rN:`).
   */
  id?: string;
  /**
   * Render order priority. Lower values appear first.
   * @default 100
   */
  order?: number;
  /** React content to project into the grid shell header content area. */
  children: ReactNode;
}

/**
 * Declarative wrapper around the grid's imperative
 * {@link ShellPlugin.registerHeaderContent} API.
 *
 * Mounts its children into the slot the grid provides for header content while
 * keeping them inside the React tree (so context, Suspense, error boundaries,
 * portals, etc. all work). Must be a descendant of `<DataGrid>`.
 *
 * @example
 * ```tsx
 * <DataGrid gridConfig={config}>
 *   <GridHeaderContent id="calendar-nav" order={0}>
 *     <HeaderNav year={year} onYearChange={setYear} />
 *   </GridHeaderContent>
 * </DataGrid>
 * ```
 *
 * @category Component
 * @since 1.8.0
 */
export function GridHeaderContent({ id: idProp, order = 100, children }: GridHeaderContentProps): null {
  const generatedId = useId();
  const id = idProp ?? `tbw-header-content-${generatedId}`;

  const gridRef = useContext(GridElementContext);

  // The container the grid hands us during render. State (not ref) so that the
  // portal-update effect below re-runs when it becomes available or changes.
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const portalKeyRef = useRef<string | null>(null);

  // Register / unregister with the grid. Re-runs when identity-ish props change.
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

      const def: HeaderContentDefinition = {
        id,
        order,
        render: (el) => {
          setContainer(el);
          // No-op cleanup: the grid calls this between re-renders before
          // invoking `render` again with the SAME container (sticky by id).
          // Tearing the portal down here would destroy any internal state in
          // the children on every shell refresh. Teardown happens in the
          // outer effect's cleanup below (on unmount / id / order change).
          return () => {
            /* intentionally empty */
          };
        },
      };
      // Route through the shell plugin (#370). The shell is opt-in at v3 —
      // content registers only when a shell plugin is present.
      grid.getPluginByName?.('shell')?.registerHeaderContent(def);
    })();

    return () => {
      unmounted = true;
      grid.getPluginByName?.('shell')?.unregisterHeaderContent(id);
      if (portalKeyForCleanup.current) {
        removeFromContainer(portalKeyForCleanup.current, { sync: true });
        portalKeyForCleanup.current = null;
      }
      setContainer(null);
    };
  }, [gridRef, id, order]);

  // Mount / update the portal whenever children or the container change.
  // Reuses the same portal key so React reconciles in place.
  useEffect(() => {
    if (!container) return;
    const grid = gridRef?.current ?? undefined;
    portalKeyRef.current = renderToContainer(container, children, portalKeyRef.current ?? undefined, grid);
  }, [children, container, gridRef]);

  return null;
}
