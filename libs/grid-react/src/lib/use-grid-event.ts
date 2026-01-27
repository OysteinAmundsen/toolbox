import type { DataGridElement } from '@toolbox-web/grid';
import { useEffect, useRef } from 'react';

/**
 * Type-safe grid event names and their payload types.
 */
export type GridEventMap<TRow = unknown> = {
  'rows-change': CustomEvent<{ rows: TRow[] }>;
  'cell-edit': CustomEvent<{ row: TRow; field: string; oldValue: unknown; newValue: unknown }>;
  'row-click': CustomEvent<{ row: TRow; rowIndex: number; originalEvent: MouseEvent }>;
  'column-state-change': CustomEvent<{ columns: unknown[] }>;
  'sort-change': CustomEvent<{ field: string; direction: 'asc' | 'desc' } | null>;
  'selection-change': CustomEvent<{ selectedRows: TRow[]; selectedIndices: number[] }>;
  'filter-change': CustomEvent<{ filters: Record<string, unknown> }>;
  'group-toggle': CustomEvent<{ key: string; expanded: boolean }>;
};

// Track whether we've shown the deprecation warning (only show once per session)
let hasShownDeprecationWarning = false;

/**
 * @deprecated Use event props directly on DataGrid instead of useGridEvent.
 *
 * ## Migration Guide
 *
 * **Before (useGridEvent):**
 * ```tsx
 * const gridRef = useRef<DataGridRef>(null);
 * useGridEvent(gridRef, 'selection-change', (e) => console.log(e.detail));
 * return <DataGrid ref={gridRef} rows={rows} />;
 * ```
 *
 * **After (event props):**
 * ```tsx
 * return (
 *   <DataGrid
 *     rows={rows}
 *     onSelectionChange={(e) => console.log(e.detail)}
 *   />
 * );
 * ```
 *
 * Event props provide:
 * - Cleaner, more declarative API
 * - Automatic cleanup (no manual ref management)
 * - Better TypeScript inference
 * - Consistent with React patterns
 *
 * See the full list of event props in the DataGrid documentation.
 *
 * @param gridRef - Ref to the DataGrid component or element
 * @param eventName - Name of the grid event to listen for
 * @param handler - Event handler function
 * @param deps - Optional dependency array (handler is stable if omitted)
 */
export function useGridEvent<TRow = unknown, K extends keyof GridEventMap<TRow> = keyof GridEventMap<TRow>>(
  gridRef: React.RefObject<{ element?: DataGridElement | null } | DataGridElement | null>,
  eventName: K,
  handler: (event: GridEventMap<TRow>[K]) => void,
  deps: unknown[] = [],
): void {
  // Show deprecation warning once per session (in development only)
  if (!hasShownDeprecationWarning && typeof window !== 'undefined') {
    // Check for localhost/dev environment (avoid polluting production logs)
    const isDev =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('.local');

    if (isDev) {
      hasShownDeprecationWarning = true;
      console.warn(
        `[useGridEvent] Deprecated: Use event props directly on DataGrid instead.\n` +
          `Example: <DataGrid onSelectionChange={(e) => ...} />\n` +
          `See migration guide: https://toolbox-web.dev/grid-react/migration`,
      );
    }
  }

  const handlerRef = useRef(handler);

  // Update handler ref when handler changes
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler, ...deps]);

  useEffect(() => {
    // Get the actual element from either a DataGridRef or direct element ref
    const refValue = gridRef.current;
    const element: DataGridElement | null | undefined =
      refValue && 'element' in refValue ? refValue.element : (refValue as DataGridElement | null);

    if (!element) return;

    const eventHandler = ((event: Event) => {
      handlerRef.current(event as GridEventMap<TRow>[K]);
    }) as EventListener;

    element.addEventListener(eventName as string, eventHandler);

    return () => {
      element.removeEventListener(eventName as string, eventHandler);
    };
  }, [gridRef, eventName]);
}
