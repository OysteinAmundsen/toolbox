import type { DataGridElement } from '@toolbox-web/grid';
import { inject, onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { GRID_ELEMENT_KEY } from './use-grid';

/**
 * Grid event types and their payload types.
 */
export interface GridEventMap {
  'cell-click': { value: unknown; row: unknown; column: unknown; rowIndex: number; colIndex: number };
  'cell-dblclick': { value: unknown; row: unknown; column: unknown; rowIndex: number; colIndex: number };
  'cell-commit': { value: unknown; oldValue: unknown; row: unknown; column: unknown };
  'row-commit': { row: unknown; changes: Record<string, unknown> };
  'selection-change': { selectedRows: unknown[]; selectedCells: unknown[] };
  'sort-change': { field: string; direction: 'asc' | 'desc' | null };
  'row-toggle': { row: unknown; expanded: boolean };
  ready: undefined;
}

/**
 * Composable for subscribing to grid events with automatic cleanup.
 *
 * @param eventName - The name of the grid event to listen for
 * @param handler - The event handler function
 * @param gridElement - Optional grid element ref (uses injected if not provided)
 *
 * @example
 * ```vue
 * <script setup>
 * import { useGridEvent } from '@toolbox-web/grid-vue';
 *
 * useGridEvent('cell-commit', (event) => {
 *   console.log('Cell committed:', event.detail);
 * });
 *
 * useGridEvent('selection-change', (event) => {
 *   console.log('Selection changed:', event.detail);
 * });
 * </script>
 * ```
 */
export function useGridEvent<K extends keyof GridEventMap>(
  eventName: K,
  handler: (event: CustomEvent<GridEventMap[K]>) => void,
  gridElement?: Ref<DataGridElement | null>,
): void {
  const grid = gridElement ?? inject(GRID_ELEMENT_KEY, ref(null));
  let cleanup: (() => void) | null = null;

  onMounted(() => {
    const element = grid.value as unknown as HTMLElement | null;
    if (!element) return;

    const eventHandler = handler as EventListener;
    element.addEventListener(eventName, eventHandler);
    cleanup = () => element.removeEventListener(eventName, eventHandler);
  });

  onBeforeUnmount(() => {
    cleanup?.();
  });
}
