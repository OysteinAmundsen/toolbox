/**
 * Export feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `export` prop on TbwGrid.
 * Also exports `useGridExport()` composable for programmatic export control.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/export';
 * </script>
 *
 * <template>
 *   <TbwGrid export />
 * </template>
 * ```
 *
 * @example Using the composable
 * ```vue
 * <script setup>
 * import { useGridExport } from '@toolbox-web/grid-vue/features/export';
 *
 * const { exportToCsv, exportToExcel, exportToJson } = useGridExport();
 *
 * function handleExport() {
 *   exportToCsv('employees.csv');
 * }
 * </script>
 * ```
 *
 * @packageDocumentation
 */

import type { DataGridElement } from '@toolbox-web/grid';
import { type ExportFormat, type ExportParams, type ExportPlugin } from '@toolbox-web/grid/plugins/export';
import { inject, ref } from 'vue';
import { GRID_ELEMENT_KEY } from '../lib/use-grid';

// Delegate to core feature registration
import '@toolbox-web/grid/features/export';

/**
 * Export methods returned from useGridExport.
 */
export interface ExportMethods {
  /**
   * Export grid data to CSV file.
   * @param filename - Optional filename (defaults to 'export.csv')
   * @param params - Optional export parameters
   */
  exportToCsv: (filename?: string, params?: Partial<ExportParams>) => void;

  /**
   * Export grid data to Excel file (XML Spreadsheet format).
   * @param filename - Optional filename (defaults to 'export.xlsx')
   * @param params - Optional export parameters
   */
  exportToExcel: (filename?: string, params?: Partial<ExportParams>) => void;

  /**
   * Export grid data to JSON file.
   * @param filename - Optional filename (defaults to 'export.json')
   * @param params - Optional export parameters
   */
  exportToJson: (filename?: string, params?: Partial<ExportParams>) => void;

  /**
   * Check if an export is currently in progress.
   */
  isExporting: () => boolean;

  /**
   * Get information about the last export.
   */
  getLastExport: () => { format: ExportFormat; timestamp: Date } | null;
}

/**
 * Composable for programmatic export control.
 *
 * Must be used within a component that contains a TbwGrid with the export feature enabled.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useGridExport } from '@toolbox-web/grid-vue/features/export';
 *
 * const { exportToCsv, exportToExcel, isExporting } = useGridExport();
 *
 * async function handleExport(format: 'csv' | 'excel' | 'json') {
 *   if (isExporting()) return; // Prevent concurrent exports
 *
 *   switch (format) {
 *     case 'csv': exportToCsv('data.csv'); break;
 *     case 'excel': exportToExcel('data.xlsx'); break;
 *     case 'json': exportToJson('data.json'); break;
 *   }
 * }
 * </script>
 * ```
 * @param selector - Optional CSS selector to target a specific grid element via
 *   DOM query instead of using Vue's provide/inject. Use when the component
 *   contains multiple grids, e.g. `'tbw-grid.primary'` or `'#my-grid'`.
 */
export function useGridExport(selector?: string): ExportMethods {
  const gridElement = selector ? ref(null) : inject(GRID_ELEMENT_KEY, ref(null));

  const getPlugin = (): ExportPlugin | undefined => {
    const grid = (selector ? document.querySelector(selector) : gridElement.value) as DataGridElement | null;
    return grid?.getPluginByName('export');
  };

  return {
    exportToCsv: (filename?: string, params?: Partial<ExportParams>) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:export] ExportPlugin not found.\n\n` +
            `  → Enable export on the grid:\n` +
            `    <TbwGrid :export="true" />`,
        );
        return;
      }
      plugin.exportCsv({ ...params, fileName: filename ?? params?.fileName ?? 'export.csv' });
    },

    exportToExcel: (filename?: string, params?: Partial<ExportParams>) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:export] ExportPlugin not found.\n\n` +
            `  → Enable export on the grid:\n` +
            `    <TbwGrid :export="true" />`,
        );
        return;
      }
      plugin.exportExcel({ ...params, fileName: filename ?? params?.fileName ?? 'export.xlsx' });
    },

    exportToJson: (filename?: string, params?: Partial<ExportParams>) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:export] ExportPlugin not found.\n\n` +
            `  → Enable export on the grid:\n` +
            `    <TbwGrid :export="true" />`,
        );
        return;
      }
      plugin.exportJson({ ...params, fileName: filename ?? params?.fileName ?? 'export.json' });
    },

    isExporting: () => {
      return getPlugin()?.isExporting() ?? false;
    },

    getLastExport: () => {
      return getPlugin()?.getLastExport() ?? null;
    },
  };
}
