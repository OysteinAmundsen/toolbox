/**
 * CSV Export Utilities
 *
 * Functions for building and downloading CSV content.
 */

import { resolveCellValue } from '../../core/internal/value-accessor';
import type { ColumnConfig } from '../../core/types';
import { formatDelimitedValue, type DelimitedFormatOptions } from '../shared/data-collection';
import type { ExportParams } from './types';

/**
 * CSV export options
 *
 * @since 0.1.1
 */
export interface CsvOptions {
  /** Field delimiter (default: ',') */
  delimiter?: string;
  /** Line separator (default: '\n') */
  newline?: string;
  /** Whether to quote strings containing special characters (default: true) */
  quoteStrings?: boolean;
  /** Add UTF-8 BOM for Excel compatibility (default: false) */
  bom?: boolean;
  /**
   * Neutralize spreadsheet formula injection (CWE-1236) by prefixing string
   * values that start with `=`, `+`, `-`, `@`, TAB or CR with a single quote,
   * so Excel / LibreOffice / Sheets render them as text instead of evaluating
   * them (default: `true`).
   *
   * Set to `false` only when the exported data is fully trusted AND the file is
   * re-imported by a parser that must see the original characters.
   *
   * @since 3.5.0
   */
  escapeFormulas?: boolean;
}

/**
 * Format a value for CSV output.
 * Handles null, Date, objects, and strings with special characters.
 *
 * @param value - The cell value to format
 * @param quote - Quote strings containing `,`, `"`, CR or LF (default: `true`)
 * @param escapeFormulas - Neutralize spreadsheet formula injection (default: `true`)
 */
export function formatCsvValue(value: any, quote = true, escapeFormulas = true): string {
  return formatDelimitedValue(value, {
    delimiter: ',',
    newline: '\n',
    quoting: quote ? 'auto' : 'never',
    escapeFormulas,
  });
}

/**
 * Build CSV content from rows and columns.
 */
export function buildCsv(rows: any[], columns: ColumnConfig[], params: ExportParams, options: CsvOptions = {}): string {
  const delimiter = options.delimiter ?? ',';
  const newline = options.newline ?? '\n';
  // Built once — buildCsv is a hot path (50K x 6 cells), so no per-cell alloc.
  const format: DelimitedFormatOptions = {
    delimiter,
    newline,
    quoting: (options.quoteStrings ?? true) ? 'auto' : 'never',
    escapeFormulas: options.escapeFormulas,
  };
  const lines: string[] = [];

  // UTF-8 BOM for Excel compatibility
  const bom = options.bom ? '\uFEFF' : '';

  // Build header row
  if (params.includeHeaders !== false) {
    const headerRow = columns.map((col) => {
      const header = col.header || col.field;
      const processed = params.processHeader ? params.processHeader(header, col.field) : header;
      return formatDelimitedValue(processed, format);
    });
    lines.push(headerRow.join(delimiter));
  }

  // Build data rows
  for (const row of rows) {
    const cells = columns.map((col) => {
      let value = resolveCellValue(row, col);
      if (params.processCell) {
        value = params.processCell(value, col.field, row);
      }
      return formatDelimitedValue(value, format);
    });
    lines.push(cells.join(delimiter));
  }

  return bom + lines.join(newline);
}

/**
 * Download a Blob as a file.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download CSV content as a file.
 */
export function downloadCsv(content: string, fileName: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, fileName);
}
