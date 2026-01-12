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

/**
 * Hook for subscribing to grid events with automatic cleanup.
 *
 * ## Usage
 *
 * ```tsx
 * import { DataGrid, useGridEvent, DataGridRef } from '@toolbox-web/grid-react';
 * import { useRef } from 'react';
 *
 * function MyComponent() {
 *   const gridRef = useRef<DataGridRef>(null);
 *
 *   // Subscribe to cell edit events
 *   useGridEvent(gridRef, 'cell-edit', (event) => {
 *     console.log('Cell edited:', event.detail);
 *   });
 *
 *   // Subscribe to row clicks
 *   useGridEvent(gridRef, 'row-click', (event) => {
 *     console.log('Row clicked:', event.detail.row);
 *   });
 *
 *   return <DataGrid ref={gridRef} rows={rows} />;
 * }
 * ```
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
