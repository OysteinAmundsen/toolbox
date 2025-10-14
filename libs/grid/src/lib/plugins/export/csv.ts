/**
 * CSV Export Utilities
 *
 * Functions for building and downloading CSV content.
 */

import type { ColumnConfig } from '../../core/types';
import type { ExportParams } from './types';

/** CSV export options */
export interface CsvOptions {
  /** Field delimiter (default: ',') */
  delimiter?: string;
  /** Line separator (default: '\n') */
  newline?: string;
  /** Whether to quote strings containing special characters (default: true) */
  quoteStrings?: boolean;
  /** Add UTF-8 BOM for Excel compatibility (default: false) */
  bom?: boolean;
}

/**
 * Format a value for CSV output.
 * Handles null, Date, objects, and strings with special characters.
 */
export function formatCsvValue(value: any, quote = true): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);

  const str = String(value);

  // Quote if contains special characters (comma, quote, newline)
  if (quote && (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r'))) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Build CSV content from rows and columns.
 */
export function buildCsv(rows: any[], columns: ColumnConfig[], params: ExportParams, options: CsvOptions = {}): string {
  const delimiter = options.delimiter ?? ',';
  const newline = options.newline ?? '\n';
  const lines: string[] = [];

  // UTF-8 BOM for Excel compatibility
  const bom = options.bom ? '\uFEFF' : '';

  // Build header row
  if (params.includeHeaders !== false) {
    const headerRow = columns.map((col) => {
      const header = col.header || col.field;
      const processed = params.processHeader ? params.processHeader(header, col.field) : header;
      return formatCsvValue(processed);
    });
    lines.push(headerRow.join(delimiter));
  }

  // Build data rows
  for (const row of rows) {
    const cells = columns.map((col) => {
      let value = row[col.field];
      if (params.processCell) {
        value = params.processCell(value, col.field, row);
      }
      return formatCsvValue(value);
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
