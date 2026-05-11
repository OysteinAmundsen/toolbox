/**
 * Export Plugin (Class-based)
 *
 * Provides data export functionality for tbw-grid.
 * Supports CSV, Excel (XML), and JSON formats.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { formatDateValue } from '../../core/internal/utils';
import { resolveCellValue } from '../../core/internal/value-accessor';
import { BaseGridPlugin, type PluginManifest, type PluginQuery } from '../../core/plugin/base-plugin';
import {
  type CollectHeaderRowsContext,
  type HeaderRowCell,
  type HeaderRowContribution,
  QUERY_COLLECT_HEADER_ROWS,
} from '../../core/plugin/types';
import type { ColumnConfig, InternalGrid } from '../../core/types';
import { resolveColumns, resolveRows } from '../shared/data-collection';
import { buildCsv, type CsvOptions, downloadBlob, downloadCsv } from './csv';
import { buildExcelXml, downloadExcel } from './excel';
import type { ExportCompleteDetail, ExportConfig, ExportFormat, ExportMode, ExportParams } from './types';

/**
 * Subset of {@link ExportParams} accepted by the pure formatters
 * ({@link ExportPlugin.formatCsv} / {@link ExportPlugin.formatExcel}).
 *
 * The formatters operate on already-resolved data, so options that affect
 * value resolution (`mode`, `rowIndices`, `format`, `fileName`,
 * `fileExtension`) are intentionally excluded — if you need them, run them
 * through {@link ExportPlugin.export} first or call the download/export
 * methods.
 *
 * `processCell` **is** honoured: it runs once per cell on the values you pass
 * in, just like the download methods.
 * @since 2.4.0
 */
export type FormatCsvParams = Pick<ExportParams, 'columns' | 'includeHeaders' | 'processCell' | 'processHeader'>;

/**
 * Subset of {@link ExportParams} accepted by {@link ExportPlugin.formatExcel}.
 * Same shape as {@link FormatCsvParams} plus `excelStyles`.
 * @since 2.4.0
 */
export type FormatExcelParams = FormatCsvParams & Pick<ExportParams, 'excelStyles'>;

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
 * ## Supported Formats
 *
 * | Format | Method | Description |
 * |--------|--------|-------------|
 * | CSV | `exportToCSV()` | Comma-separated values |
 * | Excel | `exportToExcel()` | Excel XML format (.xlsx) |
 * | JSON | `exportToJSON()` | JSON array of objects |
 *
 * @example Basic Export with Button
 * ```ts
 * import { queryGrid } from '@toolbox-web/grid';
 * import { ExportPlugin } from '@toolbox-web/grid/plugins/export';
 *
 * const grid = queryGrid('tbw-grid');
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
 *   grid.getPluginByName('export').exportToCSV();
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
 * @see SelectionPlugin for exporting selected rows
 *
 * @internal Extends BaseGridPlugin
 * @since 0.1.1
 */
export class ExportPlugin extends BaseGridPlugin<ExportConfig> {
  /**
   * Plugin manifest — declares queries for inter-plugin communication.
   * @internal
   */
  static override readonly manifest: PluginManifest = {
    queries: [{ type: 'export:csv', description: 'Triggers a CSV export' }],
  };

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

  // #region Query System

  /** @internal */
  override handleQuery(query: PluginQuery): unknown {
    if (query.type === 'export:csv') {
      this.exportCsv();
      return true;
    }
    return undefined;
  }
  // #endregion

  // #region Private Methods

  /**
   * Resolve the columns and rows that an export with these params would
   * include, plus a fully-defaulted ExportParams for downstream consumers.
   *
   * Honours `config.onlyVisible`, `config.onlySelected`, `params.columns`, and
   * `params.rowIndices`.
   */
  private resolveExportData(
    format: ExportFormat,
    params?: Partial<ExportParams>,
  ): { columns: ColumnConfig[]; rows: Record<string, unknown>[]; fullParams: ExportParams } {
    const config = this.config;

    const fullParams: ExportParams = {
      format,
      fileName: params?.fileName ?? config.fileName ?? 'export',
      includeHeaders: params?.includeHeaders ?? config.includeHeaders,
      processCell: params?.processCell,
      processHeader: params?.processHeader,
      processHeaderRow: params?.processHeaderRow,
      mode: params?.mode ?? 'raw',
      columns: params?.columns,
      rowIndices: params?.rowIndices,
      excelStyles: params?.excelStyles,
      fileExtension: params?.fileExtension,
      headerRows: params?.headerRows,
    };

    const columns = resolveColumns(this.columns, params?.columns, config.onlyVisible) as ColumnConfig[];

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

    // Collect plugin-contributed header rows (e.g. column groups) and apply
    // `processHeaderRow` filtering. Both gated on `includeHeaders` — if the
    // caller asked for no headers, we collect nothing.
    if (fullParams.includeHeaders !== false && !fullParams.headerRows) {
      fullParams.headerRows = this.#collectAndProcessHeaderRows(columns, fullParams.processHeaderRow);
    } else if (fullParams.includeHeaders === false) {
      fullParams.headerRows = undefined;
    }

    return { columns, rows, fullParams };
  }

  /**
   * Broadcast {@link QUERY_COLLECT_HEADER_ROWS} to all plugins, apply the
   * optional `processHeaderRow` callback, and drop any row whose every cell
   * is blank (`label === ''`).
   *
   * Returns `undefined` (not `[]`) when no row survives, so downstream
   * formatters can keep their single-header-row layout unchanged via a
   * single `headerRows?.length` check.
   */
  #collectAndProcessHeaderRows(
    columns: ColumnConfig[],
    processHeaderRow?: (cell: HeaderRowCell, rowIndex: number) => HeaderRowCell | null,
  ): HeaderRowContribution[] | undefined {
    if (columns.length === 0) return undefined;
    const grid = this.grid as { query?: <T>(type: string, context: CollectHeaderRowsContext) => T[] } | undefined;
    if (!grid?.query) return undefined;
    const responses = grid.query<HeaderRowContribution | undefined>(QUERY_COLLECT_HEADER_ROWS, { columns });
    if (!responses || responses.length === 0) return undefined;
    const collected: HeaderRowContribution[] = [];
    for (const r of responses) {
      if (r && Array.isArray(r.cells) && r.cells.length > 0) collected.push(r);
    }
    if (collected.length === 0) return undefined;

    // Apply processHeaderRow per cell; drop rows that end up entirely blank.
    const processed: HeaderRowContribution[] = [];
    for (let rowIndex = 0; rowIndex < collected.length; rowIndex++) {
      const row = collected[rowIndex];
      const outCells: HeaderRowCell[] = [];
      let anyVisible = false;
      for (const cell of row.cells) {
        const next = processHeaderRow ? processHeaderRow(cell, rowIndex) : cell;
        if (next === null) {
          // Blank — preserve span so neighbours stay aligned.
          outCells.push({ label: '', span: cell.span });
        } else {
          outCells.push(next);
          if ((next.label ?? '') !== '') anyVisible = true;
        }
      }
      // Drop fully-blank rows (every cell `label === ''`). Honours the
      // "collapse row if every slot is blank" rule from #314.
      if (anyVisible) processed.push({ cells: outCells });
    }

    return processed.length > 0 ? processed : undefined;
  }

  /**
   * Apply the configured export `mode` to a single cell value.
   *
   * - `'raw'`       : returns the underlying value (after optional `processCell`).
   * - `'formatted'` : applies the column-type default formatter and `column.format`,
   *                   returning the same string the grid displays. `processCell`
   *                   runs last on the formatted value.
   */
  private resolveCellOutput(
    value: unknown,
    col: ColumnConfig,
    row: Record<string, unknown>,
    mode: ExportMode,
    processCell?: (value: any, field: string, row: any) => any,
  ): unknown {
    let out: unknown = value;

    if (mode === 'formatted') {
      const formatFn = this.#resolveFormatFn(col);
      if (formatFn) {
        try {
          const formatted = formatFn(value, row);
          out = formatted == null ? '' : String(formatted);
        } catch {
          out = value == null ? '' : String(value);
        }
      } else if (col.type === 'date') {
        out = formatDateValue(value);
      } else if (col.type === 'boolean') {
        out = !!value;
      } else {
        out = value;
      }
    }

    if (processCell) {
      out = processCell(out, col.field, row);
    }

    return out;
  }

  private performExport(format: ExportFormat, params?: Partial<ExportParams>): void {
    const { columns, rows, fullParams } = this.resolveExportData(format, params);

    this.isExportingFlag = true;
    let fileName = fullParams.fileName ?? 'export';

    // buildCsv / buildExcelXml read each cell via `resolveCellValue(row, col)`.
    // Our pre-resolved row objects are keyed by `column.field`, so any
    // `valueAccessor` on the column would misfire on these synthetic rows.
    // Strip accessors before delegating to keep the lookup as a plain field read.
    const downstreamColumns = this.#stripAccessors(columns);

    try {
      switch (format) {
        case 'csv': {
          const data = this.#buildExportData(rows, columns, fullParams);
          // processCell already applied during data resolution — strip it so buildCsv
          // doesn't double-apply.
          const content = buildCsv(data, downstreamColumns, { ...fullParams, processCell: undefined }, { bom: true });
          fileName = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
          downloadCsv(content, fileName);
          break;
        }

        case 'excel': {
          const data = this.#buildExportData(rows, columns, fullParams);
          const content = buildExcelXml(data, downstreamColumns, { ...fullParams, processCell: undefined });
          const ext = fullParams.fileExtension ?? '.xls';
          const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`;
          fileName = fileName.endsWith(normalizedExt) ? fileName : `${fileName}${normalizedExt}`;
          downloadExcel(content, fileName);
          break;
        }

        case 'json': {
          const data = this.#buildExportData(rows, columns, fullParams);
          // When plugins contributed header rows (e.g. column groups), emit an
          // envelope `{ headerRows, rows }` so consumers can reconstruct
          // multi-level headers. Without contributions the output stays a flat
          // array — non-breaking for existing JSON consumers.
          const payload =
            fullParams.headerRows && fullParams.headerRows.length > 0
              ? { headerRows: fullParams.headerRows, rows: data }
              : data;
          const content = JSON.stringify(payload, null, 2);
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

  /**
   * Resolve every cell into a plain object keyed by `column.field`, applying
   * the configured `mode` and `processCell` once. The result can be fed to
   * `buildCsv` / `buildExcelXml` directly — they read values via
   * `resolveCellValue`, which on plain key/value objects is a simple
   * `row[field]` lookup, so no double-resolution occurs.
   */
  #buildExportData(
    rows: Record<string, unknown>[],
    columns: ColumnConfig[],
    params: ExportParams,
  ): Record<string, unknown>[] {
    const mode = params.mode ?? 'raw';
    return rows.map((row) => {
      const obj: Record<string, unknown> = {};
      for (const col of columns) {
        const raw = resolveCellValue(row, col);
        obj[col.field] = this.resolveCellOutput(raw, col, row, mode, params.processCell);
      }
      return obj;
    });
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
   * Returns the row data that would be included in an export, without
   * producing a file. Honours `mode`, `onlyVisible`, `onlySelected`,
   * `columns`, `rowIndices`, `processCell`, and (for `mode: 'formatted'`)
   * `column.format`.
   *
   * Each returned object is keyed by `column.field` in column order.
   *
   * @example
   * ```ts
   * // Underlying typed values (Date stays Date, number stays number)
   * const raw = exporter.export();
   *
   * // What the user sees in each cell
   * const display = exporter.export({ mode: 'formatted' });
   * ```
   */
  export(params?: Partial<ExportParams>): Record<string, unknown>[] {
    const { columns, rows, fullParams } = this.resolveExportData('json', params);
    return this.#buildExportData(rows, columns, fullParams);
  }

  /**
   * Returns the columns (in order) that an export with these params would
   * include. Useful when handing rows to a third-party serializer that needs
   * header labels, widths, or types alongside the data.
   */
  getResolvedColumns(params?: Partial<ExportParams>): ColumnConfig[] {
    return resolveColumns(this.columns, params?.columns, this.config.onlyVisible) as ColumnConfig[];
  }

  /**
   * Format an array of row objects as a CSV string. Column order, headers,
   * and which fields to emit are taken from the plugin's resolved columns
   * (respecting `onlyVisible` and `params.columns`).
   *
   * This is a **pure formatter** — it does not re-resolve values from the
   * grid. Pass `data` produced by {@link ExportPlugin.export} (or any
   * compatible row objects keyed by `column.field`).
   *
   * `params.processCell` is honoured: it runs once per cell on the values in
   * `data`. `mode` is **not** accepted here — apply it upstream via
   * `export({ mode: 'formatted' })`.
   *
   * @example
   * ```ts
   * const csv = exporter.formatCsv(exporter.export());
   * await navigator.clipboard.writeText(csv);
   * ```
   */
  formatCsv(data: Record<string, unknown>[], params?: FormatCsvParams, options?: CsvOptions): string {
    const { columns, fullParams } = this.resolveExportData('csv', params);
    return buildCsv(data, this.#stripAccessors(columns), fullParams, options);
  }

  /**
   * Format an array of row objects as an Excel XML Spreadsheet 2003 string.
   * See {@link formatCsv} for the data-shape contract — this method is also a
   * pure formatter and `params.processCell` is honoured the same way.
   */
  formatExcel(data: Record<string, unknown>[], params?: FormatExcelParams): string {
    const { columns, fullParams } = this.resolveExportData('excel', params);
    return buildExcelXml(data, this.#stripAccessors(columns), fullParams);
  }

  /** @internal Drop `valueAccessor` so downstream builders read pre-resolved fields. */
  #stripAccessors(columns: ColumnConfig[]): ColumnConfig[] {
    return columns.map((c) => (c.valueAccessor ? ({ ...c, valueAccessor: undefined } as ColumnConfig) : c));
  }

  /**
   * @internal Resolve the format function for a column for `mode: 'formatted'`.
   * Mirrors the priority chain in core/internal/rows.ts (`column.format` → adapter
   * type default), but inlined so this module stays free of browser-only imports.
   */
  #resolveFormatFn(col: ColumnConfig): ((value: unknown, row: unknown) => string) | undefined {
    if (col.format) return col.format as (value: unknown, row: unknown) => string;
    if (!col.type) return undefined;
    // The grid host carries optional `__frameworkAdapter` and `_hostElement` from
    // InternalGrid. Narrow with a structural guard rather than an `as unknown as`
    // cast — these keys are documented public-internal in core/types.ts.
    const grid = this.grid as Partial<Pick<InternalGrid<unknown>, '__frameworkAdapter' | '_hostElement'>> | undefined;
    const adapter = grid?.__frameworkAdapter;
    if (!adapter?.getTypeDefault) return undefined;
    const appDefault = adapter.getTypeDefault(col.type, grid?._hostElement);
    return appDefault?.format as ((value: unknown, row: unknown) => string) | undefined;
  }

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
