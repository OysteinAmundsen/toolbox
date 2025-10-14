/**
 * Export Plugin (Class-based)
 *
 * Provides data export functionality for tbw-grid.
 * Supports CSV, Excel (XML), and JSON formats.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import type { ColumnConfig } from '../../core/types';
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
 * @example
 * ```ts
 * new ExportPlugin({
 *   enabled: true,
 *   fileName: 'my-data',
 *   includeHeaders: true,
 *   onlyVisible: true,
 * })
 * ```
 */
export class ExportPlugin extends BaseGridPlugin<ExportConfig> {
  readonly name = 'export';
  override readonly version = '1.0.0';

  protected override get defaultConfig(): Partial<ExportConfig> {
    return {
      enabled: true,
      fileName: 'export',
      includeHeaders: true,
      onlyVisible: true,
      onlySelected: false,
    };
  }

  // ===== Internal State =====
  private isExportingFlag = false;
  private lastExportInfo: { format: ExportFormat; timestamp: Date } | null = null;

  // ===== Private Methods =====

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

    // Get columns to export
    let columns = [...this.columns] as ColumnConfig[];
    if (config.onlyVisible) {
      columns = columns.filter((c) => !c.hidden && !c.field.startsWith('__'));
    }
    if (params?.columns) {
      const colSet = new Set(params.columns);
      columns = columns.filter((c) => colSet.has(c.field));
    }

    // Get rows to export
    let rows = [...this.rows] as any[];
    if (config.onlySelected) {
      const selectionState = this.getSelectionState();
      if (selectionState?.selected?.size) {
        const sortedIndices = [...selectionState.selected].sort((a, b) => a - b);
        rows = sortedIndices.map((i) => this.rows[i]).filter(Boolean);
      }
    }
    if (params?.rowIndices) {
      rows = params.rowIndices.map((i) => this.rows[i]).filter(Boolean);
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
      const grid = this.grid as any;
      return grid?.getPluginState?.('selection') ?? null;
    } catch {
      return null;
    }
  }

  // ===== Public API =====

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
}
