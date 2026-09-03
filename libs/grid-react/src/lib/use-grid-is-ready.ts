/**
 * Shared `isReady` tracking for `useGrid` and the feature hooks
 * (`useGridExport`, `useGridFiltering`, `useGridPrint`, `useGridSelection`,
 * `useGridUndoRedo`).
 *
 * Every adapter exposes an `isReady` flag on each feature accessor so consumers
 * can gate toolbar buttons before the grid has finished its first render.
 * `@toolbox-web/grid-vue` mirrors this as `useGridIsReady`; Angular tracks the
 * same flag inline per accessor because signals need no hook boundary.
 *
 * @internal
 */

import type { DataGridElement } from '@toolbox-web/grid';
import { useEffect, useState } from 'react';

/**
 * Resolve `true` once the grid element referenced by `getGrid` has completed
 * `ready()`. Stays `false` when no grid is present.
 *
 * @internal
 */
export function useGridIsReady(getGrid: () => DataGridElement | null): boolean {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    const grid = getGrid();
    if (!grid) return;
    Promise.resolve(grid.ready?.()).then(() => {
      if (!disposed) setIsReady(true);
    });
    return () => {
      disposed = true;
    };
  }, [getGrid]);

  return isReady;
}
