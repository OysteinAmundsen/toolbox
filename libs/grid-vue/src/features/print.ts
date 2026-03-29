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
import { type PrintParams, type PrintPlugin } from '@toolbox-web/grid/plugins/print';
import { inject, ref } from 'vue';
import { GRID_ELEMENT_KEY } from '../lib/use-grid';

// Delegate to core feature registration
import '@toolbox-web/grid/features/print';

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
 * @param selector - Optional CSS selector to target a specific grid element via
 *   DOM query instead of using Vue's provide/inject. Use when the component
 *   contains multiple grids, e.g. `'tbw-grid.primary'` or `'#my-grid'`.
 */
export function useGridPrint(selector?: string): PrintMethods {
  const gridElement = selector ? ref(null) : inject(GRID_ELEMENT_KEY, ref(null));

  const getPlugin = (): PrintPlugin | undefined => {
    const grid = (selector ? document.querySelector(selector) : gridElement.value) as DataGridElement | null;
    return grid?.getPluginByName('print');
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
