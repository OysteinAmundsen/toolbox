/**
 * Print feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `print` prop on TbwGrid.
 * Also exports `useGridPrint()` composable for programmatic print control.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/print';
 * </script>
 *
 * <template>
 *   <TbwGrid print />
 * </template>
 * ```
 *
 * @example Using the composable
 * ```vue
 * <script setup>
 * import { useGridPrint } from '@toolbox-web/grid-vue/features/print';
 *
 * const { print, isPrinting } = useGridPrint();
 * </script>
 *
 * <template>
 *   <button @click="print" :disabled="isPrinting()">Print Grid</button>
 * </template>
 * ```
 *
 * @packageDocumentation
 */

import type { DataGridElement } from '@toolbox-web/grid';
import { PrintPlugin, type PrintParams } from '@toolbox-web/grid/plugins/print';
import { inject, ref } from 'vue';
import { registerFeature } from '../lib/feature-registry';
import { GRID_ELEMENT_KEY } from '../lib/use-grid';

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
 * Composable for programmatic print control.
 *
 * Must be used within a component that contains a TbwGrid with print enabled.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useGridPrint } from '@toolbox-web/grid-vue/features/print';
 *
 * const { print, isPrinting } = useGridPrint();
 *
 * async function handlePrint() {
 *   await print({ title: 'My Report', isolate: true });
 *   console.log('Print completed');
 * }
 * </script>
 *
 * <template>
 *   <button @click="handlePrint" :disabled="isPrinting()">
 *     {{ isPrinting() ? 'Printing...' : 'Print' }}
 *   </button>
 * </template>
 * ```
 */
export function useGridPrint(): PrintMethods {
  const gridElement = inject(GRID_ELEMENT_KEY, ref(null));

  const getPlugin = (): PrintPlugin | undefined => {
    const grid = gridElement.value as DataGridElement | null;
    return grid?.getPlugin(PrintPlugin);
  };

  return {
    print: async (params?: PrintParams) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:print] PrintPlugin not found.\n\n` + `  → Enable print on the grid:\n` + `    <TbwGrid print />`,
        );
        return;
      }
      await plugin.print(params);
    },

    isPrinting: () => getPlugin()?.isPrinting() ?? false,
  };
}
