import type { DataGridElement } from '@toolbox-web/grid';
import { useContext, useEffect, type RefObject } from 'react';

import { GridElementContext } from './grid-element-context';

/**
 * Options for {@link useGridOverlay}.
 *
 * @public
 * @since 1.4.0
 */
export interface UseGridOverlayOptions {
  /**
   * Whether the overlay is currently open.
   *
   * Set to `false` to unregister the panel without unmounting it (e.g. when
   * the consumer toggles visibility via CSS rather than conditional render).
   * Defaults to `true`.
   */
  open?: boolean;
  /**
   * Optional explicit grid element. When omitted, the hook resolves the
   * grid by:
   *
   * 1. Walking up the DOM from `panelRef.current` via `closest('tbw-grid')`
   *    (works for inline overlays).
   * 2. Falling back to the {@link GridElementContext} populated by
   *    `<DataGrid>` / `<GridProvider>` (works for portal-rendered overlays
   *    whose DOM is detached from the grid subtree).
   */
  gridElement?: DataGridElement | null;
}

/**
 * Register a custom overlay panel (popover, listbox, calendar, color
 * picker) as part of the active editor so the grid does not commit and
 * exit row edit when focus or pointer interaction enters the panel.
 *
 * Mirrors the Angular `BaseOverlayEditor` contract for React custom
 * editors. Wires `registerExternalFocusContainer(panel)` on mount/open
 * and `unregisterExternalFocusContainer(panel)` on unmount/close.
 *
 * Pair with `ColumnEditorContext.grid` (see {@link DataGridElement}) when
 * the panel is rendered outside any `<DataGrid>` provider.
 *
 * @example
 * ```tsx
 * function AutocompleteEditor({ value, commit, cancel }: GridEditorContext<Row>) {
 *   const [open, setOpen] = useState(false);
 *   const panelRef = useRef<HTMLDivElement | null>(null);
 *   useGridOverlay(panelRef, { open });
 *   return (
 *     <>
 *       <input
 *         aria-expanded={open}
 *         aria-controls="ac-listbox"
 *         onClick={() => setOpen(true)}
 *         onKeyDown={(e) => e.key === 'Enter' && commit(e.currentTarget.value)}
 *       />
 *       {open &&
 *         createPortal(
 *           <div id="ac-listbox" ref={panelRef} role="listbox">
 *             {options}
 *           </div>,
 *           document.body,
 *         )}
 *     </>
 *   );
 * }
 * ```
 *
 * @param panelRef - Ref to the overlay panel DOM element. The hook is a
 *   no-op while `panelRef.current` is `null`.
 * @param options - {@link UseGridOverlayOptions}.
 *
 * @public
 * @since 1.4.0
 */
export function useGridOverlay(panelRef: RefObject<HTMLElement | null>, options: UseGridOverlayOptions = {}): void {
  const { open = true, gridElement } = options;
  const ctxRef = useContext(GridElementContext);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const grid = gridElement ?? (panel.closest('tbw-grid') as DataGridElement | null) ?? ctxRef?.current ?? null;
    if (!grid) return;

    grid.registerExternalFocusContainer?.(panel);
    return () => {
      grid.unregisterExternalFocusContainer?.(panel);
    };
  }, [open, gridElement, ctxRef, panelRef]);
}
