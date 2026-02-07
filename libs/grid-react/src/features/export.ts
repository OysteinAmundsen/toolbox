/**
 * Export feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `export` prop on DataGrid.
 * Also exports `useGridExport()` hook for programmatic export control.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/export';
 *
 * <DataGrid export />
 * ```
 *
 * @example Using the hook
 * ```tsx
 * import { useGridExport } from '@toolbox-web/grid-react/features/export';
 *
 * function ExportButton() {
 *   const { exportToCsv, exportToExcel, isExporting } = useGridExport();
 *
 *   return (
 *     <button onClick={() => exportToCsv('data.csv')} disabled={isExporting()}>
 *       Export CSV
 *     </button>
 *   );
 * }
 * ```
 *
 * @packageDocumentation
 */

import type { DataGridElement } from '@toolbox-web/grid';
import { ExportPlugin, type ExportFormat, type ExportParams } from '@toolbox-web/grid/plugins/export';
import { useCallback, useContext } from 'react';
import { GridElementContext } from '../lib/data-grid';
import { registerFeature } from '../lib/feature-registry';

registerFeature('export', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as any) ?? {});
  return new ExportPlugin(options);
});

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
 * Hook for programmatic export control.
 *
 * Must be used within a DataGrid component tree with the export feature enabled.
 *
 * @example
 * ```tsx
 * import { useGridExport } from '@toolbox-web/grid-react/features/export';
 *
 * function ExportToolbar() {
 *   const { exportToCsv, exportToExcel, exportToJson, isExporting } = useGridExport();
 *
 *   return (
 *     <div>
 *       <button onClick={() => exportToCsv()} disabled={isExporting()}>CSV</button>
 *       <button onClick={() => exportToExcel()} disabled={isExporting()}>Excel</button>
 *       <button onClick={() => exportToJson()} disabled={isExporting()}>JSON</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useGridExport(): ExportMethods {
  const gridRef = useContext(GridElementContext);

  const getPlugin = useCallback((): ExportPlugin | undefined => {
    const grid = gridRef?.current as DataGridElement | null;
    return grid?.getPlugin(ExportPlugin);
  }, [gridRef]);

  const exportToCsv = useCallback(
    (filename?: string, params?: Partial<ExportParams>) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:export] ExportPlugin not found.\n\n` +
            `  → Enable export on the grid:\n` +
            `    <DataGrid export />`,
        );
        return;
      }
      plugin.exportCsv({ ...params, fileName: filename ?? params?.fileName ?? 'export.csv' });
    },
    [getPlugin],
  );

  const exportToExcel = useCallback(
    (filename?: string, params?: Partial<ExportParams>) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:export] ExportPlugin not found.\n\n` +
            `  → Enable export on the grid:\n` +
            `    <DataGrid export />`,
        );
        return;
      }
      plugin.exportExcel({ ...params, fileName: filename ?? params?.fileName ?? 'export.xlsx' });
    },
    [getPlugin],
  );

  const exportToJson = useCallback(
    (filename?: string, params?: Partial<ExportParams>) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:export] ExportPlugin not found.\n\n` +
            `  → Enable export on the grid:\n` +
            `    <DataGrid export />`,
        );
        return;
      }
      plugin.exportJson({ ...params, fileName: filename ?? params?.fileName ?? 'export.json' });
    },
    [getPlugin],
  );

  const isExporting = useCallback(() => {
    return getPlugin()?.isExporting() ?? false;
  }, [getPlugin]);

  const getLastExport = useCallback(() => {
    return getPlugin()?.getLastExport() ?? null;
  }, [getPlugin]);

  return {
    exportToCsv,
    exportToExcel,
    exportToJson,
    isExporting,
    getLastExport,
  };
}
