/**
 * Clipboard Plugin Types
 *
 * Type definitions for clipboard copy/paste functionality.
 */

import { invalidateAccessorCache } from '../../core/internal/value-accessor';
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
   * **Custom handlers own per-column `onPaste`.** A custom handler completely
   * replaces {@link defaultPasteHandler}, so the per-column
   * {@link BaseColumnConfig.onPaste} guard/transform and the `paste-rejected`
   * event are **not** applied automatically — you must honor them yourself if you
   * want that behavior. Use the exported {@link resolveColumnPaste} to resolve
   * each cell (reject / accept / transform) and {@link emitPasteRejected} to fire
   * the same `paste-rejected` event the default handler does:
   *
   * ```ts
   * import { resolveColumnPaste, emitPasteRejected } from '@toolbox-web/grid/plugins/clipboard';
   *
   * pasteHandler: (detail, grid) => {
   *   const rejected = [];
   *   for (const cell of myCells(detail)) {
   *     const res = resolveColumnPaste(cell.column.onPaste, {
   *       value: cell.value, field: cell.field, row: cell.row,
   *       rowIndex: cell.rowIndex, oldValue: cell.oldValue,
   *     });
   *     if (res.accepted) writeCell(cell, res.value);
   *     else rejected.push({ field: cell.field, rowIndex: cell.rowIndex, row: cell.row, value: cell.value, reason: res.reason });
   *   }
   *   emitPasteRejected(grid, rejected);
   *   return false; // handled
   * }
   * ```
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
  /**
   * Raw (structured) cell values for a **same-grid** paste, aligned 1:1 with
   * {@link rows} (same dimensions, data rows only). Present only when the paste
   * text exactly matches what this grid last copied — so an object-valued cell
   * (e.g. `{id,name}`, arrays) round-trips losslessly instead of degrading to
   * the copied display text. `undefined` for external/cross-grid pastes, where
   * only the text is available. The default handler prefers `rawRows` over
   * `rows` for values (cloning each so targets don't share references).
   * @since 3.0.0
   */
  rawRows?: unknown[][];
}

/**
 * Context passed to a column's {@link BaseColumnConfig.onPaste} guard/transform
 * for each cell a paste would write into.
 *
 * @since 3.0.0
 */
export interface PasteCellContext<TRow = unknown, TValue = unknown> {
  /** The incoming pasted value (the raw structured value for a same-grid paste). */
  value: TValue;
  /** The column field receiving the value. */
  field: string;
  /** The target row object (pre-paste state). */
  row: TRow;
  /** Index of the target row in the current data set. */
  rowIndex: number;
  /** The cell's current value before the paste. */
  oldValue: TValue;
}

/**
 * A column's paste guard / transform (`onPaste`). See {@link BaseColumnConfig.onPaste}.
 * @since 3.0.0
 */
export type ColumnPasteGuard<TRow = unknown, TValue = unknown> =
  | boolean
  | ((ctx: PasteCellContext<TRow, TValue>) => boolean | { value: TValue });

/**
 * Why a cell's paste was rejected: `'column'` = the column set `onPaste: false`;
 * `'cell'` = an `onPaste` callback returned `false`.
 * @since 3.0.0
 */
export type PasteRejectionReason = 'column' | 'cell';

/** One cell whose paste a column's `onPaste` guard rejected. @since 3.0.0 */
export interface PasteRejectedCell {
  /** The column field. */
  field: string;
  /** Index of the target row in the current data set. */
  rowIndex: number;
  /** The target row object. */
  row: unknown;
  /** The incoming value that was rejected (before any transform). */
  value: unknown;
  /** Why it was rejected. */
  reason: PasteRejectionReason;
}

/**
 * Detail for the `paste-rejected` event: the cells a column's `onPaste` guard
 * rejected during a paste. Fires once per paste, only when at least one cell was
 * rejected, so a consumer can surface a message. Non-editable cells are skipped
 * silently and are NOT reported here.
 * @since 3.0.0
 */
export interface PasteRejectedDetail {
  /** Cells rejected by a column `onPaste` guard. */
  rejected: PasteRejectedCell[];
}

/** Result of {@link resolveColumnPaste}. @since 3.0.0 */
export type PasteResolution = { accepted: true; value: unknown } | { accepted: false; reason: PasteRejectionReason };

/**
 * Resolve a column's {@link ColumnPasteGuard} (`onPaste`) for a single cell.
 *
 * Pure — never mutates or emits. Exposed so a **custom `pasteHandler`** can honor
 * per-column `onPaste` identically to {@link defaultPasteHandler}: call it per
 * cell, write `resolution.value` when accepted, and collect the rejected cells to
 * pass to {@link emitPasteRejected}.
 *
 * @param onPaste - The column's `onPaste` config (`column.onPaste`), if any.
 * @param ctx - The cell context (value, field, row, rowIndex, oldValue).
 * @returns `{ accepted: true, value }` (value possibly transformed) or
 *   `{ accepted: false, reason }`.
 *
 * @example
 * ```ts
 * // Inside a custom pasteHandler:
 * const rejected: PasteRejectedCell[] = [];
 * const res = resolveColumnPaste(column.onPaste, { value, field, row, rowIndex, oldValue });
 * if (res.accepted) row[field] = res.value;
 * else rejected.push({ field, rowIndex, row, value, reason: res.reason });
 * // …after writing all cells:
 * emitPasteRejected(grid, rejected);
 * ```
 * @since 3.0.0
 */
export function resolveColumnPaste(onPaste: ColumnPasteGuard | undefined, ctx: PasteCellContext): PasteResolution {
  if (onPaste === false) return { accepted: false, reason: 'column' };
  if (typeof onPaste === 'function') {
    const result = onPaste(ctx);
    if (result === false) return { accepted: false, reason: 'cell' };
    if (result && typeof result === 'object' && 'value' in result) {
      return { accepted: true, value: (result as { value: unknown }).value };
    }
  }
  return { accepted: true, value: ctx.value };
}

/**
 * Dispatch the `paste-rejected` event on the grid. No-op when `rejected` is empty.
 * Exposed so a custom `pasteHandler` can emit the same event the default handler
 * does, after resolving cells via {@link resolveColumnPaste}.
 * @since 3.0.0
 */
export function emitPasteRejected(grid: GridElement, rejected: PasteRejectedCell[]): void {
  if (rejected.length === 0) return;
  grid.dispatchEvent?.(new CustomEvent<PasteRejectedDetail>('paste-rejected', { detail: { rejected }, bubbles: true }));
}

/**
 * Default paste handler that applies pasted data to the grid.
 *
 * This is the built-in handler used when no custom `pasteHandler` is configured.
 *
 * Edits are routed through `grid.updateRows(…, 'paste')` so paste participates in
 * the full edit pipeline — dirty tracking, cancelable validation, undo/redo
 * history, and abortion — exactly like an interactive edit, and so a
 * `cell-commit` listener can tell a paste apart via `detail.source === 'paste'`.
 * Rows without a resolvable ID (no `getRowId`) fall back to a direct in-place
 * write, which still updates values but does not track them.
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
 * - Per-column `onPaste`: after the editability check, a column's
 *   {@link BaseColumnConfig.onPaste} may reject the cell (skipped, alignment
 *   preserved) or transform the pasted value. Rejected cells are reported once
 *   via the `paste-rejected` event ({@link PasteRejectedDetail}).
 *
 * @param detail - The parsed paste data from clipboard
 * @param grid - The grid element to update
 * @since 0.4.2
 */
export function defaultPasteHandler(detail: PasteDetail, grid: GridElement): void {
  const { rows: pastedRows, rawRows, target, fields, fillSelection } = detail;

  // No target = nothing to do
  if (!target || pastedRows.length === 0) return;

  // Prefer the raw structured values for a same-grid paste (lossless object
  // round-trip); fall back to the parsed text for external/cross-grid pastes.
  const valueRows: unknown[][] = rawRows ?? pastedRows;

  const currentRows = grid.rows as Record<string, unknown>[];
  const columns = grid.effectiveConfig.columns ?? [];
  const allFields = columns.map((col) => col.field);
  const columnByField = new Map(columns.map((col) => [col.field, col]));

  // Editability is owned by the editing plugin (row-conditional included). With
  // no editing plugin loaded, nothing is editable and paste is a no-op.
  const [canEditCell = () => false] = grid.query<CellEditablePredicate>('getCellEditableResolver');

  // Accumulate the intended edits per target row (honoring editability, tiling,
  // and selection bounds). Rows beyond current data are only created for an
  // unbounded (single-cell expansion) paste.
  const editsByRow = new Map<number, Record<string, unknown>>();
  let rowCountAfter = currentRows.length;
  // Cells a column's `onPaste` guard rejected — reported via `paste-rejected`.
  const rejected: PasteRejectedCell[] = [];

  const addEdit = (rowIndex: number, field: string | undefined, value: unknown, evalRow: Record<string, unknown>) => {
    if (!field || !canEditCell(field, evalRow)) return;
    // Per-column paste guard/transform (clipboard-augmented `onPaste`). Runs
    // after the editability check so it only sees cells paste could write.
    const resolution = resolveColumnPaste(columnByField.get(field)?.onPaste, {
      value,
      field,
      row: evalRow,
      rowIndex,
      oldValue: evalRow[field],
    });
    if (!resolution.accepted) {
      rejected.push({ field, rowIndex, row: evalRow, value, reason: resolution.reason });
      return; // reject this cell (alignment preserved, like a non-editable cell)
    }
    let changes = editsByRow.get(rowIndex);
    if (!changes) {
      changes = {};
      editsByRow.set(rowIndex, changes);
    }
    // Clone structured values so tiled/multi-target pastes never share a
    // reference (mutating one row's object would otherwise mutate the source
    // and every other target). No-op for primitives (the text path).
    changes[field] = cloneStructured(resolution.value);
  };

  if (fillSelection && target.bounds) {
    // Fill-selection (tile) mode: repeat the source across the selection bounds
    // using modulo indexing. Never grows the grid. Editability is resolved
    // against the pre-paste row (bounded mode never grows).
    const srcRows = valueRows.length;
    for (let rowIndex = target.row; rowIndex <= target.bounds.endRow; rowIndex++) {
      if (rowIndex >= currentRows.length) break;
      const sourceRow = valueRows[(rowIndex - target.row) % srcRows];
      const srcCols = sourceRow.length;
      if (srcCols === 0) continue;
      const evalRow = currentRows[rowIndex];
      fields.forEach((field, colOffset) => addEdit(rowIndex, field, sourceRow[colOffset % srcCols], evalRow));
    }
  } else {
    const maxPasteRow = target.bounds ? target.bounds.endRow : Infinity;
    valueRows.forEach((rowData, rowOffset) => {
      const targetRowIndex = target.row + rowOffset;
      if (targetRowIndex > maxPasteRow) return;
      if (target.bounds && targetRowIndex >= currentRows.length) return; // bounded: don't grow
      if (!target.bounds && targetRowIndex >= rowCountAfter) rowCountAfter = targetRowIndex + 1;
      // Editability resolved against the pre-paste row (empty for grown rows).
      const evalRow = currentRows[targetRowIndex] ?? {};
      rowData.forEach((cellValue, colOffset) => addEdit(targetRowIndex, fields[colOffset], cellValue, evalRow));
    });
  }

  if (editsByRow.size === 0 && rowCountAfter === currentRows.length) {
    // Nothing accepted (e.g. every cell rejected) — still report the rejections.
    emitPasteRejected(grid, rejected);
    return;
  }

  // Grow the grid first for unbounded pastes that extend past existing data.
  // New rows start empty; their pasted values are applied in the write phase.
  if (rowCountAfter > currentRows.length) {
    const grown = [...currentRows];
    while (grown.length < rowCountAfter) {
      const emptyRow: Record<string, unknown> = {};
      allFields.forEach((f) => (emptyRow[f] = ''));
      grown.push(emptyRow);
    }
    grid.rows = grown;
  }

  const rowsNow = grid.rows as Record<string, unknown>[];

  // Route edits through updateRows so paste flows through the edit pipeline
  // (dirty tracking, validation, history, abortion). Rows without a resolvable
  // ID fall back to a direct in-place write.
  const updates: Array<{ id: string; changes: Record<string, unknown> }> = [];
  let directWrote = false;
  for (const [rowIndex, changes] of editsByRow) {
    const row = rowsNow[rowIndex];
    if (!row) continue;
    let id: string | undefined;
    try {
      id = grid.getRowId(row);
    } catch {
      id = undefined;
    }
    if (id == null) {
      // No stable ID → can't route through updateRow; write directly. Invalidate
      // the value-accessor cache per field (row identity is unchanged), matching
      // RowManager.updateRow — otherwise a `column.valueAccessor` display can go
      // stale after paste.
      for (const [field, value] of Object.entries(changes)) {
        (row as Record<string, unknown>)[field] = value;
        invalidateAccessorCache(row as object, field);
      }
      directWrote = true;
    } else {
      updates.push({ id, changes });
    }
  }

  if (updates.length > 0) {
    grid.updateRows(updates, 'paste');
  } else if (directWrote && rowCountAfter === currentRows.length) {
    // Direct writes only, no structural grow above — trigger a render.
    grid.rows = [...rowsNow];
  }

  // Notify consumers of any cells a column's `onPaste` guard rejected.
  emitPasteRejected(grid, rejected);
}

/**
 * Deep-clone a structured cell value so tiled/multi-target pastes don't share a
 * reference. Primitives (and `null`) are returned as-is. Falls back to the
 * original value if it isn't structured-cloneable.
 * @internal
 */
export function cloneStructured(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  try {
    return structuredClone(value);
  } catch {
    return value;
  }
}

// Module Augmentation - Register plugin name for type-safe getPluginByName()
declare module '../../core/types' {
  interface DataGridEventMap {
    /** Fired after a successful copy operation. Provides the copied text, row count, and column count. @group Clipboard Events */
    copy: CopyDetail;
    /** Fired after a paste operation. Provides parsed rows, target cell, and column fields. @group Clipboard Events */
    paste: PasteDetail;
    /** Fired after a paste when one or more cells were rejected by a column's `onPaste` guard. @group Clipboard Events */
    'paste-rejected': PasteRejectedDetail;
  }

  interface PluginNameMap {
    clipboard: import('./ClipboardPlugin').ClipboardPlugin;
  }

  /** Clipboard contributes its own edit-origin tag so a `cell-commit` listener
   * can tell a paste from a user edit via `detail.source === 'paste'`. */
  interface UpdateSourceMap {
    /** A value written by a clipboard paste. @since 3.0.0 */
    paste: true;
  }

  interface BaseColumnConfig<TRow, TValue> {
    /**
     * Per-column paste guard / transform. Requires the ClipboardPlugin.
     *
     * Runs for each cell a paste would write into (after the editing plugin's
     * editability check), letting a consumer reject or rewrite pasted values
     * **per column** — finer-grained than the whole-operation
     * {@link ClipboardConfig.pasteHandler}.
     *
     * - `true` / omitted — accept pastes (default behavior).
     * - `false` — this column never accepts pastes; matching cells are skipped
     *   (column alignment is preserved, like a non-editable cell).
     * - `(ctx) => …` — called per cell. Return `false` to reject just that cell,
     *   `true` (or nothing) to accept as-is, or `{ value }` to write a
     *   transformed value instead. Returning `{ value }` disambiguates a
     *   transform from a boolean verdict, so boolean-valued columns stay safe.
     *
     * Synchronous only — the paste pipeline does not await. Rejected cells
     * (either form) are reported once per paste via the `paste-rejected` event
     * ({@link PasteRejectedDetail}), so a consumer can show a message.
     *
     * @example
     * ```typescript
     * // Reject pastes into a locked column
     * { field: 'id', onPaste: false }
     *
     * // Reject invalid values, coerce the rest
     * {
     *   field: 'price',
     *   onPaste: ({ value }) => {
     *     const n = Number(String(value).replace(/[^0-9.]/g, ''));
     *     return Number.isFinite(n) ? { value: n } : false;
     *   },
     * }
     * ```
     * @since 3.0.0
     */
    onPaste?: ColumnPasteGuard<TRow, TValue>;
  }
}
