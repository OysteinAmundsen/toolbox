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
    result = result.filter((c) => !c.hidden && !c.field.startsWith('__') && c.meta?.utility !== true);
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
