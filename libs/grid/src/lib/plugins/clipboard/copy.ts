/**
 * Clipboard Copy Logic
 *
 * Pure functions for copying grid data to clipboard.
 */

import type { ColumnConfig } from '../../core/types';
import type { ClipboardConfig } from './types';

/** Parameters for building clipboard text */
export interface CopyParams {
  /** All grid rows */
  rows: unknown[];
  /** Column configurations */
  columns: ColumnConfig[];
  /** Selected row indices */
  selectedIndices: Set<number> | number[];
  /** Clipboard configuration */
  config: ClipboardConfig;
}

/**
 * Format a cell value for clipboard output.
 *
 * Uses custom processCell if provided, otherwise applies default formatting:
 * - null/undefined → empty string
 * - Date → ISO string
 * - Object → JSON string
 * - Other → String conversion with optional quoting
 *
 * @param value - The cell value to format
 * @param field - The field name
 * @param row - The full row object
 * @param config - Clipboard configuration
 * @returns Formatted string value
 */
export function formatCellValue(value: unknown, field: string, row: unknown, config: ClipboardConfig): string {
  if (config.processCell) {
    return config.processCell(value, field, row);
  }

  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);

  const str = String(value);
  const delimiter = config.delimiter ?? '\t';
  const newline = config.newline ?? '\n';

  // Quote if contains delimiter, newline, or quotes (or if quoteStrings is enabled)
  if (config.quoteStrings || str.includes(delimiter) || str.includes(newline) || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Build clipboard text from selected rows and columns.
 *
 * @param params - Copy parameters including rows, columns, selection, and config
 * @returns Tab-separated (or custom delimiter) text ready for clipboard
 */
export function buildClipboardText(params: CopyParams): string {
  const { rows, columns, selectedIndices, config } = params;
  const delimiter = config.delimiter ?? '\t';
  const newline = config.newline ?? '\n';

  // Filter to visible columns (not hidden, not internal __ prefixed)
  const visibleColumns = columns.filter((c) => !c.hidden && !c.field.startsWith('__'));

  const lines: string[] = [];

  // Add header row if configured
  if (config.includeHeaders) {
    const headerCells = visibleColumns.map((c) => {
      const header = c.header || c.field;
      // Quote headers if they contain special characters
      if (header.includes(delimiter) || header.includes(newline) || header.includes('"')) {
        return `"${header.replace(/"/g, '""')}"`;
      }
      return header;
    });
    lines.push(headerCells.join(delimiter));
  }

  // Convert indices to sorted array
  const indices = selectedIndices instanceof Set ? [...selectedIndices] : selectedIndices;
  const sortedIndices = [...indices].sort((a, b) => a - b);

  // Build data rows
  for (const idx of sortedIndices) {
    const row = rows[idx];
    if (!row) continue;

    const cells = visibleColumns.map((col) =>
      formatCellValue((row as Record<string, unknown>)[col.field], col.field, row, config)
    );
    lines.push(cells.join(delimiter));
  }

  return lines.join(newline);
}

/**
 * Copy text to the system clipboard.
 *
 * Uses the modern Clipboard API when available, with fallback
 * to execCommand for older browsers.
 *
 * @param text - The text to copy
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers or when Clipboard API is not available
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }
}
