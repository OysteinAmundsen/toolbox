/**
 * Print feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `print` prop on DataGrid.
 * Also exports `useGridPrint()` hook for programmatic print control.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/print';
 *
 * <DataGrid print />
 * ```
 *
 * @example Using the hook
 * ```tsx
 * import { useGridPrint } from '@toolbox-web/grid-react/features/print';
 *
 * function PrintButton() {
 *   const { print, isPrinting } = useGridPrint();
 *
 *   return (
 *     <button onClick={() => print()} disabled={isPrinting()}>
 *       {isPrinting() ? 'Printing...' : 'Print'}
 *     </button>
 *   );
 * }
 * ```
 *
 * @packageDocumentation
 */

import type { DataGridElement } from '@toolbox-web/grid';
import { PrintPlugin, type PrintParams } from '@toolbox-web/grid/plugins/print';
import { useCallback, useContext } from 'react';
import { GridElementContext } from '../lib/data-grid';
import { registerFeature } from '../lib/feature-registry';

registerFeature('print', (config) => {
  if (config === true) {
    return new PrintPlugin();
  }
  return new PrintPlugin(config ?? undefined);
});

/**
 * Print methods returned from useGridPrint.
 */
export interface PrintMethods {
  /**
   * Print the grid.
   * Opens browser print dialog after preparing the grid for printing.
   * @param params - Optional print parameters
   */
  print: (params?: PrintParams) => Promise<void>;

  /**
   * Check if a print operation is currently in progress.
   */
  isPrinting: () => boolean;
}

/**
 * Hook for programmatic print control.
 *
 * Must be used within a DataGrid component tree with print enabled.
 *
 * @example
 * ```tsx
 * import { useGridPrint } from '@toolbox-web/grid-react/features/print';
 *
 * function PrintToolbar() {
 *   const { print, isPrinting } = useGridPrint();
 *
 *   const handlePrint = async () => {
 *     await print({ title: 'My Report', isolate: true });
 *     console.log('Print dialog closed');
 *   };
 *
 *   return (
 *     <button onClick={handlePrint} disabled={isPrinting()}>
 *       {isPrinting() ? 'Printing...' : 'Print Report'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useGridPrint(): PrintMethods {
  const gridRef = useContext(GridElementContext);

  const getPlugin = useCallback((): PrintPlugin | undefined => {
    const grid = gridRef?.current as DataGridElement | null;
    return grid?.getPlugin(PrintPlugin);
  }, [gridRef]);

  const print = useCallback(
    async (params?: PrintParams) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:print] PrintPlugin not found.\n\n` + `  → Enable print on the grid:\n` + `    <DataGrid print />`,
        );
        return;
      }
      await plugin.print(params);
    },
    [getPlugin],
  );

  const isPrinting = useCallback(() => getPlugin()?.isPrinting() ?? false, [getPlugin]);

  return { print, isPrinting };
}
