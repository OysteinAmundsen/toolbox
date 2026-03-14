import type { DataGridElement } from '@toolbox-web/grid';
import type {
  CellActivateDetail,
  CellChangeDetail,
  CellClickDetail,
  CellCommitDetail,
  ColumnMoveDetail,
  ColumnResizeDetail,
  ColumnVisibilityDetail,
  CopyDetail,
  DetailExpandDetail,
  ExportCompleteDetail,
  FilterChangeDetail,
  GridColumnState,
  GroupToggleDetail,
  PasteDetail,
  PrintCompleteDetail,
  PrintStartDetail,
  ResponsiveChangeDetail,
  RowClickDetail,
  RowCommitDetail,
  RowMoveDetail,
  SelectionChangeDetail,
  SortChangeDetail,
  TreeExpandDetail,
  UndoRedoDetail,
} from '@toolbox-web/grid/all';
import { inject, onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { GRID_ELEMENT_KEY } from './use-grid';

/**
 * Grid event types and their payload types.
 *
 * @deprecated Use `@event` handlers directly on `<TbwGrid>` instead of useGridEvent.
 * Will be removed in v2.
 */
export interface GridEventMap {
  'cell-click': CellClickDetail;
  'row-click': RowClickDetail;
  'cell-activate': CellActivateDetail;
  'cell-change': CellChangeDetail;
  'cell-commit': CellCommitDetail;
  'row-commit': RowCommitDetail;
  'sort-change': SortChangeDetail;
  'filter-change': FilterChangeDetail;
  'column-resize': ColumnResizeDetail;
  'column-move': ColumnMoveDetail;
  'column-visibility': ColumnVisibilityDetail;
  'column-state-change': GridColumnState;
  'selection-change': SelectionChangeDetail;
  'row-move': RowMoveDetail;
  'group-toggle': GroupToggleDetail;
  'tree-expand': TreeExpandDetail;
  'detail-expand': DetailExpandDetail;
  'responsive-change': ResponsiveChangeDetail;
  copy: CopyDetail;
  paste: PasteDetail;
  'undo-redo': UndoRedoDetail;
  'export-complete': ExportCompleteDetail;
  'print-start': PrintStartDetail;
  'print-complete': PrintCompleteDetail;
}

// Track whether we've shown the deprecation warning (only show once per session)
let hasShownDeprecationWarning = false;

/**
 * @deprecated Use `@event` handlers directly on `<TbwGrid>` instead of useGridEvent. Will be removed in v2.
 *
 * ## Migration Guide
 *
 * **Before (useGridEvent):**
 * ```vue
 * <script setup>
 * import { useGridEvent } from '@toolbox-web/grid-vue';
 * useGridEvent('selection-change', (e) => console.log(e.detail));
 * </script>
 * <template><TbwGrid :rows="rows" /></template>
 * ```
 *
 * **After (@event handlers):**
 * ```vue
 * <template>
 *   <TbwGrid :rows="rows" @selection-change="(e) => console.log(e.detail)" />
 * </template>
 * ```
 *
 * Event handlers on `<TbwGrid>` provide:
 * - Cleaner, more declarative API
 * - Automatic cleanup (no composable needed)
 * - Better TypeScript inference via typed emits
 * - Consistent with Vue patterns
 *
 * @param eventName - The name of the grid event to listen for
 * @param handler - The event handler function
 * @param gridElement - Optional grid element ref (uses injected if not provided)
 */
export function useGridEvent<K extends keyof GridEventMap>(
  eventName: K,
  handler: (event: CustomEvent<GridEventMap[K]>) => void,
  gridElement?: Ref<DataGridElement | null>,
): void {
  // Show deprecation warning once per session (in development only)
  if (!hasShownDeprecationWarning && typeof window !== 'undefined') {
    const isDev =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('.local');

    if (isDev) {
      hasShownDeprecationWarning = true;
      console.warn(
        `[useGridEvent] Deprecated: Use @event handlers directly on <TbwGrid> instead.\n` +
          `Example: <TbwGrid @selection-change="handler" />\n` +
          `See migration guide: https://toolboxjs.com/grid-vue/migration`,
      );
    }
  }

  const grid = gridElement ?? inject(GRID_ELEMENT_KEY, ref(null));
  let cleanup: (() => void) | null = null;

  onMounted(() => {
    const element = grid.value as unknown as DataGridElement | null;
    if (!element) return;

    cleanup = element.on(eventName as string, (_detail: unknown, event: CustomEvent) =>
      handler(event as CustomEvent<GridEventMap[K]>),
    );
  });

  onBeforeUnmount(() => {
    cleanup?.();
  });
}
