/**
 * Clipboard Plugin Types
 *
 * Type definitions for clipboard copy/paste functionality.
 */

import type { GridElement } from '../../core/plugin/base-plugin';
import type { CellEditablePredicate } from '../../core/plugin/types';

/**
 * Custom paste handler function.
 *
 * @param detail - The parsed paste data with target and field info
 * @param grid - The grid element to update
 * @returns `false` to prevent the default paste behavior, or `void`/`true` to allow it
 *
 * @example
 * ```ts
 * // Custom handler that validates before pasting
 * new ClipboardPlugin({
 *   pasteHandler: (detail, grid) => {
 *     if (!detail.target) return false;
 *     // Apply custom validation/transformation...
 *     applyPasteData(detail, grid);
 *     return false; // We handled it, skip default
 *   }
 * })
 * ```
 * @since 0.4.2
 */
export type PasteHandler = (detail: PasteDetail, grid: GridElement) => boolean | void;

/**
 * Options for programmatic copy operations.
 *
 * Allows callers to control exactly which columns and rows are included
 * in a copy, independently of the current selection state.
 *
 * @example Copy specific columns from selected rows
 * ```ts
 * const clipboard = grid.getPluginByName('clipboard');
 * // User selected rows 0, 2, 4 via a dialog, chose columns to include
 * const text = await clipboard.copy({
 *   rowIndices: [0, 2, 4],
 *   columns: ['name', 'email'],
 *   includeHeaders: true,
 * });
 * ```
 * @since 1.14.0
 */
export interface CopyOptions {
  /** Specific column fields to include. If omitted, uses current selection or all visible columns. */
  columns?: string[];
  /** Specific row indices to copy. If omitted, uses current selection or all rows. */
  rowIndices?: number[];
  /** Include column headers in copied text. Defaults to the plugin config value. */
  includeHeaders?: boolean;
  /** Column delimiter override. Defaults to the plugin config value. */
  delimiter?: string;
  /** Row delimiter override. Defaults to the plugin config value. */
  newline?: string;
  /** Custom cell value processor for this operation. Overrides the plugin config's `processCell`. */
  processCell?: (value: unknown, field: string, row: unknown) => string;
}

/** Configuration options for the clipboard plugin * @since 0.1.1
 */
export interface ClipboardConfig {
  /** Include column headers in copied text (default: false) */
  includeHeaders?: boolean;
  /** Column delimiter character (default: '\t' for tab) */
  delimiter?: string;
  /** Row delimiter/newline character (default: '\n') */
  newline?: string;
  /** Wrap string values with quotes (default: false) */
  quoteStrings?: boolean;
  /** Custom cell value processor for copy operations */
  processCell?: (value: unknown, field: string, row: unknown) => string;
  /**
   * When `true`, pasting into a multi-cell selection larger than the clipboard
   * source tiles (repeats) the source to fill the whole selection: a single
   * copied cell fills every selected cell, a 1×2 source fills as
   * `val1, val2, val1, val2`, and a 2×2 block tiles across the selection.
   *
   * Only applies when a bounded (multi-cell) selection is active — it never
   * grows the grid. Defaults to `false` (paste writes only the source extent).
   *
   * @default false
   * @since 3.0.0
   */
  fillSelection?: boolean;
  /**
   * Custom paste handler. By default, the plugin applies pasted data to `grid.rows`
   * starting at the target cell.
   *
   * - Set to a custom function to handle paste yourself
   * - Set to `null` to disable auto-paste (event still fires)
   * - Return `false` from handler to prevent default behavior
   *
   * @default defaultPasteHandler (auto-applies paste data)
   */
  pasteHandler?: PasteHandler | null;
}

/** Internal state managed by the clipboard plugin */
export interface ClipboardState {
  /** The last copied text (for reference/debugging) */
  lastCopied: string | null;
}

/** Event detail emitted after a successful copy operation * @since 0.1.1
 */
export interface CopyDetail {
  /** The text that was copied to clipboard */
  text: string;
  /** Number of rows copied */
  rowCount: number;
  /** Number of columns copied */
  columnCount: number;
}

/** Target cell coordinates and bounds for paste operations * @since 0.4.2
 */
export interface PasteTarget {
  /** Target row index (top-left of paste area) */
  row: number;
  /** Target column index (top-left of paste area) */
  col: number;
  /** Target column field name (for easy data mapping) */
  field: string;
  /**
   * Selection bounds that constrain the paste area.
   * If set, paste data will be clipped to fit within these bounds.
   * If null, paste expands freely from the target cell.
   */
  bounds: {
    /** End row index (inclusive) */
    endRow: number;
    /** End column index (inclusive) */
    endCol: number;
  } | null;
}

/** Event detail emitted after a paste operation * @since 0.1.1
 */
export interface PasteDetail {
  /** Parsed rows from clipboard (2D array of cell values) */
  rows: string[][];
  /** Raw text that was pasted */
  text: string;
  /** The target cell where paste starts (top-left of paste area). Null if no cell is selected. */
  target: PasteTarget | null;
  /**
   * Column fields for each column in the paste range, starting from target.col.
   * Useful for mapping parsed cell values to data fields.
   * Length matches the width of the pasted data (or available columns, whichever is smaller).
   * When `fillSelection` is active, this spans the full selection width so the source can be tiled.
   */
  fields: string[];
  /**
   * When `true`, the paste handler tiles the clipboard source across the full
   * selection bounds (see {@link ClipboardConfig.fillSelection}). Set by the
   * plugin from config; only ever `true` when `target.bounds` is set.
   * @since 3.0.0
   */
  fillSelection?: boolean;
}

/**
 * Default paste handler that applies pasted data to grid.rows.
 *
 * This is the built-in handler used when no custom `pasteHandler` is configured.
 * It clones the rows array for immutability and applies values starting at the target cell.
 *
 * Behavior:
 * - Single cell selection: paste expands freely, adds new rows if needed
 * - Range/row selection: paste is clipped to fit within selection bounds
 * - Fill-selection: when `detail.fillSelection` is set, the source is tiled
 *   (repeated via modulo indexing) to fill the whole selection bounds
 * - Non-editable cells: values are skipped (column alignment preserved).
 *   Editability is resolved by the editing plugin via the
 *   `getCellEditableResolver` query — including row-conditional `editable`.
 *   Without the editing plugin, no cell is editable and paste is a no-op.
 *
 * @param detail - The parsed paste data from clipboard
 * @param grid - The grid element to update
 * @since 0.4.2
 */
export function defaultPasteHandler(detail: PasteDetail, grid: GridElement): void {
  const { rows: pastedRows, target, fields, fillSelection } = detail;

  // No target = nothing to do
  if (!target || pastedRows.length === 0) return;

  // Get current rows and columns from grid
  const currentRows = grid.rows as Record<string, unknown>[];
  const columns = grid.effectiveConfig.columns ?? [];
  const allFields = columns.map((col) => col.field);

  // Ask the editing plugin (via query) whether each target cell may receive a
  // value. We never read editing-owned column props (`editable`/`rowEditable`)
  // here — the editing plugin owns that resolution, including row-conditional
  // `editable`. With no editing plugin loaded, no plugin responds and nothing
  // is editable (paste becomes a no-op).
  const [canEditCell = () => false] = grid.query<CellEditablePredicate>('getCellEditableResolver');

  // Clone data for immutability
  const newRows = [...currentRows];

  // Fill-selection (tile) mode: repeat the clipboard source across the full
  // selection bounds using modulo indexing. Never grows the grid.
  if (fillSelection && target.bounds) {
    const srcRows = pastedRows.length;
    for (let rowIndex = target.row; rowIndex <= target.bounds.endRow; rowIndex++) {
      // Don't paste beyond existing rows
      if (rowIndex >= newRows.length) break;
      const sourceRow = pastedRows[(rowIndex - target.row) % srcRows];
      const srcCols = sourceRow.length;
      if (srcCols === 0) continue;
      // Editability is resolved against the pre-paste row state (bounded mode
      // never grows, so the original row always exists).
      const evalRow = currentRows[rowIndex];
      const editRow = (newRows[rowIndex] = { ...newRows[rowIndex] });
      fields.forEach((field, colOffset) => {
        if (field && canEditCell(field, evalRow)) {
          editRow[field] = sourceRow[colOffset % srcCols];
        }
      });
    }
    grid.rows = newRows;
    return;
  }

  // Calculate row bounds
  const maxPasteRow = target.bounds ? target.bounds.endRow : Infinity;

  // Apply pasted data starting at target cell
  pastedRows.forEach((rowData, rowOffset) => {
    const targetRowIndex = target.row + rowOffset;

    // Stop if we've exceeded the selection bounds
    if (targetRowIndex > maxPasteRow) return;

    // Only grow array if no bounds (single cell selection)
    if (!target.bounds) {
      while (targetRowIndex >= newRows.length) {
        const emptyRow: Record<string, unknown> = {};
        allFields.forEach((field) => (emptyRow[field] = ''));
        newRows.push(emptyRow);
      }
    } else if (targetRowIndex >= newRows.length) {
      // With bounds, don't paste beyond existing rows
      return;
    }

    // Clone the target row and apply values. Editability is resolved against
    // the pre-paste row state — the original row for existing rows, or an
    // (empty) snapshot for rows grown by a single-cell expansion paste.
    const originalRow = currentRows[targetRowIndex];
    const editRow = (newRows[targetRowIndex] = { ...newRows[targetRowIndex] });
    const evalRow = originalRow ?? { ...editRow };
    rowData.forEach((cellValue, colOffset) => {
      // fields array is already constrained by bounds in ClipboardPlugin
      const field = fields[colOffset];
      if (field && canEditCell(field, evalRow)) {
        // Only paste into editable cells
        editRow[field] = cellValue;
      }
    });
  });

  // Update grid with new data
  grid.rows = newRows;
}

// Module Augmentation - Register plugin name for type-safe getPluginByName()
declare module '../../core/types' {
  interface DataGridEventMap {
    /** Fired after a successful copy operation. Provides the copied text, row count, and column count. @group Clipboard Events */
    copy: CopyDetail;
    /** Fired after a paste operation. Provides parsed rows, target cell, and column fields. @group Clipboard Events */
    paste: PasteDetail;
  }

  interface PluginNameMap {
    clipboard: import('./ClipboardPlugin').ClipboardPlugin;
  }
}
