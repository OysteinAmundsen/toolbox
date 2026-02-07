/**
 * Export feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `export` input on Grid directive.
 * Also exports `injectGridExport()` for programmatic export control.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/export';
 *
 * <tbw-grid [export]="true" />
 * <tbw-grid [export]="{ fileName: 'data.csv' }" />
 * ```
 *
 * @example Using injectGridExport
 * ```typescript
 * import { injectGridExport } from '@toolbox-web/grid-angular/features/export';
 *
 * @Component({...})
 * export class MyComponent {
 *   private gridExport = injectGridExport();
 *
 *   exportData() {
 *     this.gridExport.exportToCsv('employees.csv');
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

import { ElementRef, inject, signal, type Signal } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { registerFeature } from '@toolbox-web/grid-angular';
import { ExportPlugin, type ExportFormat, type ExportParams } from '@toolbox-web/grid/plugins/export';

registerFeature('export', (config) => {
  if (config === true) {
    return new ExportPlugin();
  }
  return new ExportPlugin(config ?? undefined);
});

/**
 * Export methods returned from injectGridExport.
 *
 * Uses lazy discovery - the grid is found on first method call, not during initialization.
 * This ensures it works with lazy-rendered tabs, conditional rendering, etc.
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

  /**
   * Signal indicating if grid is ready.
   * The grid is discovered lazily, so this updates when first method call succeeds.
   */
  isReady: Signal<boolean>;
}

/**
 * Angular inject function for programmatic export control.
 *
 * Uses **lazy grid discovery** - the grid element is found when methods are called,
 * not during initialization. This ensures it works reliably with:
 * - Lazy-rendered tabs
 * - Conditional rendering (*ngIf)
 * - Dynamic component loading
 *
 * @example
 * ```typescript
 * import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
 * import { Grid } from '@toolbox-web/grid-angular';
 * import '@toolbox-web/grid-angular/features/export';
 * import { injectGridExport } from '@toolbox-web/grid-angular/features/export';
 *
 * @Component({
 *   selector: 'app-my-grid',
 *   imports: [Grid],
 *   schemas: [CUSTOM_ELEMENTS_SCHEMA],
 *   template: `
 *     <button (click)="handleExport()">Export CSV</button>
 *     <tbw-grid [rows]="rows" [export]="true"></tbw-grid>
 *   `
 * })
 * export class MyGridComponent {
 *   gridExport = injectGridExport();
 *
 *   handleExport() {
 *     this.gridExport.exportToCsv('employees.csv');
 *   }
 * }
 * ```
 */
export function injectGridExport(): ExportMethods {
  const elementRef = inject(ElementRef);
  const isReady = signal(false);

  // Lazy discovery: cached grid reference
  let cachedGrid: DataGridElement | null = null;
  let readyPromiseStarted = false;

  /**
   * Lazily find the grid element. Called on each method invocation.
   * Caches the reference once found and triggers ready() check.
   */
  const getGrid = (): DataGridElement | null => {
    if (cachedGrid) return cachedGrid;

    const grid = elementRef.nativeElement.querySelector('tbw-grid') as DataGridElement | null;
    if (grid) {
      cachedGrid = grid;
      // Start ready() check only once
      if (!readyPromiseStarted) {
        readyPromiseStarted = true;
        grid.ready?.().then(() => isReady.set(true));
      }
    }
    return grid;
  };

  const getPlugin = (): ExportPlugin | undefined => {
    return getGrid()?.getPlugin(ExportPlugin);
  };

  return {
    isReady: isReady.asReadonly(),

    exportToCsv: (filename?: string, params?: Partial<ExportParams>) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:export] ExportPlugin not found.\n\n` +
            `  → Enable export on the grid:\n` +
            `    <tbw-grid [export]="true" />`,
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
            `    <tbw-grid [export]="true" />`,
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
            `    <tbw-grid [export]="true" />`,
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
