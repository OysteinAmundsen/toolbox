/**
 * Column Selection Core Logic
 *
 * Pure functions for column selection: mode normalization, range expansion
 * across visible columns, and Ctrl+Shift+Arrow extension math. All grid-DOM
 * interaction lives in `SelectionPlugin.ts` — this module is dependency-free
 * and trivially unit-testable.
 *
 * @since 2.8.0
 */

import type { ColumnConfig } from '../../core/types';
import type { SelectionMode } from './types';

// #region Mode normalization

/**
 * Normalized representation of `SelectionConfig.mode`. Splits the user-supplied
 * mode (single string OR array) into:
 *
 * - `primary`: the in-row axis (`'cell' | 'row' | 'range'`) — drives existing
 *   click/drag/keyboard behavior. When the user configured column-only, this is
 *   `'column'` and the in-row hooks treat it as inert.
 * - `columnEnabled`: whether the column axis is also active. Drives Ctrl+Click
 *   on header, Ctrl+Space on focused cell, and the column-selection render pass.
 * - `bothAxes`: shorthand for "column AND a non-column axis are configured" —
 *   this is the only state where the row↔column mutual-exclusion logic kicks in.
 */
export interface NormalizedModeConfig {
  primary: SelectionMode;
  columnEnabled: boolean;
  bothAxes: boolean;
}

/**
 * Normalize the user-supplied `mode` and validate it.
 *
 * Allowed shapes:
 * - Single: `'cell' | 'row' | 'column' | 'range'`
 * - Array: `['column', X]` or `[X, 'column']` where X is `'cell' | 'row' | 'range'`
 * - Single-element arrays are treated as the contained string for ergonomics.
 *
 * Throws on:
 * - Empty array
 * - Arrays of 3+ items
 * - Arrays without `'column'` (the only purpose of an array is to enable the
 *   column axis alongside an in-row axis — `['row', 'cell']` etc. don't compose)
 * - Duplicate entries
 * - Unknown mode strings
 */
export function normalizeMode(mode: SelectionMode | SelectionMode[]): NormalizedModeConfig {
  const validModes: ReadonlySet<string> = new Set(['cell', 'row', 'column', 'range']);

  if (typeof mode === 'string') {
    if (!validModes.has(mode)) {
      throw new Error(
        `[SelectionPlugin] Invalid selection mode: "${mode}". Expected one of: 'cell' | 'row' | 'column' | 'range'.`,
      );
    }
    return {
      primary: mode,
      columnEnabled: mode === 'column',
      bothAxes: false,
    };
  }

  if (!Array.isArray(mode)) {
    throw new Error(`[SelectionPlugin] Invalid selection mode: expected string or array, got ${typeof mode}.`);
  }

  if (mode.length === 0) {
    throw new Error(`[SelectionPlugin] Invalid selection mode: array must contain at least one mode.`);
  }

  for (const m of mode) {
    if (!validModes.has(m)) {
      throw new Error(
        `[SelectionPlugin] Invalid selection mode in array: "${m}". Expected one of: 'cell' | 'row' | 'column' | 'range'.`,
      );
    }
  }

  // Reject duplicates
  if (new Set(mode).size !== mode.length) {
    throw new Error(`[SelectionPlugin] Invalid selection mode: array contains duplicate entries (${mode.join(', ')}).`);
  }

  // Single-element array → treat as plain string
  if (mode.length === 1) {
    return normalizeMode(mode[0]);
  }

  if (mode.length > 2) {
    throw new Error(
      `[SelectionPlugin] Invalid selection mode: arrays of more than 2 modes are not supported. Got [${mode.join(', ')}].`,
    );
  }

  // 2-element array: must contain 'column' + one of 'cell' | 'row' | 'range'
  const hasColumn = mode.includes('column');
  if (!hasColumn) {
    throw new Error(
      `[SelectionPlugin] Invalid selection mode: [${mode.join(', ')}]. ` +
        `Two-mode arrays must include 'column' (the only valid combinations are ['row','column'], ['cell','column'], ['range','column']). ` +
        `Other in-row modes don't compose meaningfully.`,
    );
  }

  const other = mode.find((m) => m !== 'column') as SelectionMode;
  if (other === 'column') {
    // Both entries are 'column' — already caught by duplicate check, but defend
    throw new Error(`[SelectionPlugin] Invalid selection mode: [${mode.join(', ')}].`);
  }

  return {
    primary: other,
    columnEnabled: true,
    bothAxes: true,
  };
}

// #endregion

// #region Field/index helpers

/**
 * Build the ordered list of selectable column fields from the grid's visible
 * columns. Utility columns (checkbox, expander, drag handle) are excluded —
 * they exist to support grid behavior, not to be selected.
 */
export function selectableColumnFields(visibleColumns: readonly ColumnConfig[]): string[] {
  const fields: string[] = [];
  for (const col of visibleColumns) {
    if ((col as { utility?: boolean }).utility === true) continue;
    if (typeof col.field === 'string' && col.field.length > 0) {
      fields.push(col.field);
    }
  }
  return fields;
}

/** Find the index of `field` within the selectable-fields list. -1 if not present. */
export function indexOfField(field: string, fields: readonly string[]): number {
  return fields.indexOf(field);
}

/**
 * Compute the inclusive field range from `anchor` to `target` along the
 * visible-column order. Returns the fields between the two (inclusive),
 * regardless of which one is to the left. Empty if either is missing.
 */
export function fieldsBetween(anchor: string, target: string, fields: readonly string[]): string[] {
  const a = indexOfField(anchor, fields);
  const b = indexOfField(target, fields);
  if (a === -1 || b === -1) return [];
  const start = Math.min(a, b);
  const end = Math.max(a, b);
  return fields.slice(start, end + 1);
}

// #endregion

// #region Keyboard extension (Ctrl+Shift+Arrow)

/**
 * Compute the new "head" field after pressing `ArrowLeft` or `ArrowRight`
 * during column-axis keyboard extension. `head` is the most recently focused
 * column edge (the one that moves); `anchor` stays put.
 *
 * Returns the new head field, or `null` if the move would go out of bounds
 * (caller should leave selection unchanged).
 */
export function computeKeyboardExtension(
  head: string | null,
  fields: readonly string[],
  direction: 'left' | 'right',
): string | null {
  if (fields.length === 0) return null;
  if (head === null) return null;
  const headIdx = indexOfField(head, fields);
  if (headIdx < 0) return null;
  const next = direction === 'left' ? Math.max(0, headIdx - 1) : Math.min(fields.length - 1, headIdx + 1);
  if (next === headIdx) return null;
  return fields[next];
}

// #endregion
