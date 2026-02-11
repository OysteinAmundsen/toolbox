/**
 * Export Plugin (Class-based)
 *
 * Provides data export functionality for tbw-grid.
 * Supports CSV, Excel (XML), and JSON formats.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import type { ColumnConfig } from '../../core/types';
import { resolveColumns, resolveRows } from '../shared/data-collection';
import { buildCsv, downloadBlob, downloadCsv } from './csv';
import { buildExcelXml, downloadExcel } from './excel';
import type { ExportCompleteDetail, ExportConfig, ExportFormat, ExportParams } from './types';

/** Selection plugin state interface for type safety */
interface SelectionPluginState {
  selected: Set<number>;
}

/**
 * Export Plugin for tbw-grid
 *
 * Lets users download grid data as CSV, Excel (XML), or JSON with a single click
 * or API call. Great for reporting, data backup, or letting users work with data
 * in Excel. Integrates with SelectionPlugin to export only selected rows.
 *
 * ## Installation
 *
 * ```ts
 * import { ExportPlugin } from '@toolbox-web/grid/plugins/export';
 * ```
 *
 * ## Configuration Options
 *
 * | Option | Type | Default | Description |
 * |--------|------|---------|-------------|
 * | `fileName` | `string` | `'export'` | Base filename (without extension) |
 * | `includeHeaders` | `boolean` | `true` | Include column headers in export |
 * | `onlyVisible` | `boolean` | `true` | Export only visible columns |
 * | `onlySelected` | `boolean` | `false` | Export only selected rows (requires SelectionPlugin) |
 *
 * ## Supported Formats
 *
 * | Format | Method | Description |
 * |--------|--------|-------------|
 * | CSV | `exportToCSV()` | Comma-separated values |
 * | Excel | `exportToExcel()` | Excel XML format (.xlsx) |
 * | JSON | `exportToJSON()` | JSON array of objects |
 *
 * ## Programmatic API
 *
 * | Method | Signature | Description |
 * |--------|-----------|-------------|
 * | `exportToCSV` | `(params?) => void` | Export as CSV file |
 * | `exportToExcel` | `(params?) => void` | Export as Excel file |
 * | `exportToJSON` | `(params?) => void` | Export as JSON file |
 * | `isExporting` | `() => boolean` | Check if export is in progress |
 *
 * @example Basic Export with Button
 * ```ts
 * import '@toolbox-web/grid';
 * import { ExportPlugin } from '@toolbox-web/grid/plugins/export';
 *
 * const grid = document.querySelector('tbw-grid');
 * grid.gridConfig = {
 *   columns: [
 *     { field: 'name', header: 'Name' },
 *     { field: 'email', header: 'Email' },
 *   ],
 *   plugins: [new ExportPlugin({ fileName: 'employees', includeHeaders: true })],
 * };
 *
 * // Trigger export via button
 * document.getElementById('export-btn').addEventListener('click', () => {
 *   grid.getPlugin(ExportPlugin).exportToCSV();
 * });
 * ```
 *
 * @example Export Selected Rows Only
 * ```ts
 * import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
 *
 * grid.gridConfig = {
 *   plugins: [
 *     new SelectionPlugin({ mode: 'row' }),
 *     new ExportPlugin({ onlySelected: true }),
 *   ],
 * };
 * ```
 *
 * @see {@link ExportConfig} for all configuration options
 * @see {@link ExportParams} for method parameters
 * @see {@link SelectionPlugin} for exporting selected rows
 *
 * @internal Extends BaseGridPlugin
 */
export class ExportPlugin extends BaseGridPlugin<ExportConfig> {
  /** @internal */
  readonly name = 'export';

  /** @internal */
  protected override get defaultConfig(): Partial<ExportConfig> {
    return {
      fileName: 'export',
      includeHeaders: true,
      onlyVisible: true,
      onlySelected: false,
    };
  }

  // #region Internal State
  private isExportingFlag = false;
  private lastExportInfo: { format: ExportFormat; timestamp: Date } | null = null;
  // #endregion

  // #region Private Methods

  private performExport(format: ExportFormat, params?: Partial<ExportParams>): void {
    const config = this.config;

    // Build full params with defaults
    const fullParams: ExportParams = {
      format,
      fileName: params?.fileName ?? config.fileName ?? 'export',
      includeHeaders: params?.includeHeaders ?? config.includeHeaders,
      processCell: params?.processCell,
      processHeader: params?.processHeader,
      columns: params?.columns,
      rowIndices: params?.rowIndices,
    };

    // Get columns to export (shared utility handles hidden/utility filtering)
    const columns = resolveColumns(this.columns, params?.columns, config.onlyVisible) as ColumnConfig[];

    // Get rows to export
    let rows: Record<string, unknown>[];
    if (params?.rowIndices) {
      rows = resolveRows(this.rows as Record<string, unknown>[], params.rowIndices);
    } else if (config.onlySelected) {
      const selectionState = this.getSelectionState();
      if (selectionState?.selected?.size) {
        rows = resolveRows(this.rows as Record<string, unknown>[], [...selectionState.selected]);
      } else {
        rows = [...this.rows] as Record<string, unknown>[];
      }
    } else {
      rows = [...this.rows] as Record<string, unknown>[];
    }

    this.isExportingFlag = true;
    let fileName = fullParams.fileName!;

    try {
      switch (format) {
        case 'csv': {
          const content = buildCsv(rows, columns, fullParams, { bom: true });
          fileName = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
          downloadCsv(content, fileName);
          break;
        }

        case 'excel': {
          const content = buildExcelXml(rows, columns, fullParams);
          fileName = fileName.endsWith('.xls') ? fileName : `${fileName}.xls`;
          downloadExcel(content, fileName);
          break;
        }

        case 'json': {
          const jsonData = rows.map((row) => {
            const obj: Record<string, any> = {};
            for (const col of columns) {
              let value = row[col.field];
              if (fullParams.processCell) {
                value = fullParams.processCell(value, col.field, row);
              }
              obj[col.field] = value;
            }
            return obj;
          });
          const content = JSON.stringify(jsonData, null, 2);
          fileName = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
          const blob = new Blob([content], { type: 'application/json' });
          downloadBlob(blob, fileName);
          break;
        }
      }

      this.lastExportInfo = { format, timestamp: new Date() };

      this.emit<ExportCompleteDetail>('export-complete', {
        format,
        fileName,
        rowCount: rows.length,
        columnCount: columns.length,
      });
    } finally {
      this.isExportingFlag = false;
    }
  }

  private getSelectionState(): SelectionPluginState | null {
    try {
      return (this.grid?.getPluginState?.('selection') as SelectionPluginState | null) ?? null;
    } catch {
      return null;
    }
  }
  // #endregion

  // #region Public API

  /**
   * Export data to CSV format.
   * @param params - Optional export parameters
   */
  exportCsv(params?: Partial<ExportParams>): void {
    this.performExport('csv', params);
  }

  /**
   * Export data to Excel format (XML Spreadsheet).
   * @param params - Optional export parameters
   */
  exportExcel(params?: Partial<ExportParams>): void {
    this.performExport('excel', params);
  }

  /**
   * Export data to JSON format.
   * @param params - Optional export parameters
   */
  exportJson(params?: Partial<ExportParams>): void {
    this.performExport('json', params);
  }

  /**
   * Check if an export is currently in progress.
   * @returns Whether export is in progress
   */
  isExporting(): boolean {
    return this.isExportingFlag;
  }

  /**
   * Get information about the last export.
   * @returns Export info or null if no export has occurred
   */
  getLastExport(): { format: ExportFormat; timestamp: Date } | null {
    return this.lastExportInfo;
  }
  // #endregion
}
