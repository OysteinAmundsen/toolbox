/**
 * Shared `isReady` tracking for `useGrid` and the feature composables
 * (`useGridExport`, `useGridFiltering`, `useGridPrint`, `useGridSelection`,
 * `useGridUndoRedo`).
 *
 * Every adapter exposes an `isReady` flag on each feature accessor so consumers
 * can gate toolbar buttons before the grid has finished its first render.
 * `@toolbox-web/grid-react` mirrors this as `useGridIsReady`; Angular tracks the
 * same flag inline per accessor because signals need no hook boundary.
 *
 * @internal
 */

import type { DataGridElement } from '@toolbox-web/grid';
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

/**
 * Resolve `true` once the grid element returned by `getGrid` has completed
 * `ready()`. Stays `false` when no grid is present.
 *
 * @internal
 */
export function useGridIsReady(getGrid: () => DataGridElement | null): Ref<boolean> {
  const isReady = ref(false) as Ref<boolean>;
  let disposed = false;

  onMounted(() => {
    const grid = getGrid();
    if (!grid) return;
    // `ready` is optional on the element type and genuinely absent until the
    // custom element upgrades, so unwrap through `Promise.resolve`.
    Promise.resolve(grid.ready?.()).then(() => {
      if (!disposed) isReady.value = true;
    });
  });

  onBeforeUnmount(() => {
    disposed = true;
  });

  return isReady;
}
