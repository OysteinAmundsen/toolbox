/**
 * Shared Data Collection Utilities
 *
 * Pure functions for resolving columns and formatting values, shared between
 * the Clipboard and Export plugins. Each plugin bundles its own copy of this
 * module (no chunk splitting) since plugin builds inline sibling imports.
 *
 * @internal
 */

import type { ColumnConfig } from '../../core/types';

/**
 * Resolve which columns to include in a data export or copy operation.
 *
 * Filters out hidden columns, utility columns (`meta.utility`), and
 * internal columns (`__`-prefixed fields). Optionally restricts to an
 * explicit set of field names.
 *
 * @param columns - All column configurations
 * @param fields  - If provided, only include columns whose field is in this list
 * @param onlyVisible - When `true` (default), exclude hidden and internal columns
 * @returns Filtered column array preserving original order
 */
export function resolveColumns(
  columns: readonly ColumnConfig[],
  fields?: string[],
  onlyVisible = true,
): ColumnConfig[] {
  let result = columns as ColumnConfig[];

  if (onlyVisible) {
    result = result.filter((c) => !c.hidden && !c.field.startsWith('__') && c.utility !== true);
  }

  if (fields?.length) {
    const fieldSet = new Set(fields);
    result = result.filter((c) => fieldSet.has(c.field));
  }

  return result;
}

/**
 * Resolve which rows to include, optionally filtered to specific indices.
 *
 * @param rows    - All row data
 * @param indices - If provided, only include rows at these indices (sorted ascending)
 * @returns Filtered row array
 */
export function resolveRows<T>(rows: readonly T[], indices?: number[]): T[] {
  if (!indices?.length) return rows as T[];

  return [...indices]
    .sort((a, b) => a - b)
    .map((i) => rows[i])
    .filter((r): r is T => r != null);
}

/**
 * Format a raw cell value as a text string.
 *
 * Provides the common null / Date / object → string conversion shared by
 * both clipboard and export output builders.
 *
 * @param value - The cell value to format
 * @returns A plain-text representation of the value
 */
export function formatValueAsText(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Leading characters that make Excel / LibreOffice / Google Sheets treat a cell
 * as a formula rather than text.
 */
const FORMULA_TRIGGER_RE = /^[=+\-@\t\r]/;

/**
 * Options for {@link formatDelimitedValue}.
 *
 * @since 3.5.0
 */
export interface DelimitedFormatOptions {
  /** Field separator (`,` for CSV, `\t` for clipboard). */
  delimiter: string;
  /** Row separator. */
  newline: string;
  /**
   * `'auto'` (default) quotes only strings containing a separator or quote,
   * `'always'` quotes every string, `'never'` disables quoting entirely.
   */
  quoting?: 'auto' | 'always' | 'never';
  /**
   * Prefix formula-triggering strings with `'` so spreadsheets treat them as
   * text. Defaults to `true`.
   */
  escapeFormulas?: boolean;
}

/**
 * Format a cell value for a delimiter-separated text format (CSV export or
 * clipboard copy).
 *
 * Only string values are formula-escaped: numbers such as `-5` stringify to a
 * leading `-` but are unambiguously numeric to a spreadsheet, and escaping them
 * would turn every negative number into text.
 *
 * Dispatch order is `typeof`-first because string + number cover the vast
 * majority of cell values; the cheap typeof check skips an `instanceof Date`
 * probe (which V8 cannot fold into a fast path) for every plain string cell.
 *
 * @param value - The cell value to format
 * @param opts  - Delimiter, newline, quoting and formula-escaping behaviour
 * @returns The value as a delimiter-safe string
 * @since 3.5.0
 */
export function formatDelimitedValue(value: unknown, opts: DelimitedFormatOptions): string {
  // Hot path: strings (most cells).
  if (typeof value === 'string') {
    const text = opts.escapeFormulas !== false && FORMULA_TRIGGER_RE.test(value) ? `'${value}` : value;
    const quoting = opts.quoting ?? 'auto';
    if (
      quoting === 'always' ||
      (quoting === 'auto' &&
        (text.includes(opts.delimiter) ||
          text.includes(opts.newline) ||
          text.includes('"') ||
          text.includes('\n') ||
          text.includes('\r')))
    ) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  // Symbols, bigints, etc.
  return String(value);
}
