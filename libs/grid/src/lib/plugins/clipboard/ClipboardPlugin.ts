/**
 * Clipboard Plugin (Class-based)
 *
 * Provides copy/paste functionality for tbw-grid.
 * Supports Ctrl+C/Cmd+C for copying and Ctrl+V/Cmd+V for pasting.
 *
 * **With Selection plugin:** Copies selected cells/rows/range
 * **Without Selection plugin:** Copies entire grid
 */

import { resolveCellValue } from '../../core/internal/value-accessor';
import {
  BaseGridPlugin,
  type GridElement,
  type PluginDependency,
  type PluginManifest,
  type PluginQuery,
} from '../../core/plugin/base-plugin';
import type { ColumnConfig } from '../../core/types';
import { formatValueAsText, resolveColumns, resolveRows } from '../shared/data-collection';
import { copyToClipboard } from './copy';
import { parseClipboardText, readFromClipboard } from './paste';
import {
  defaultPasteHandler,
  type ClipboardConfig,
  type CopyDetail,
  type CopyOptions,
  type PasteDetail,
  type PasteTarget,
} from './types';

/**
 * Clipboard Plugin for tbw-grid
 *
 * Brings familiar copy/cut/paste functionality with full keyboard shortcut support
 * (Ctrl+C, Ctrl+X, Ctrl+V). Handles single cells, multi-cell selections, and integrates
 * seamlessly with Excel and other spreadsheet applications via tab-delimited output.
 *
 * > **Optional Dependency:** Works best with SelectionPlugin for copying/pasting selected
 * > cells. Without SelectionPlugin, copies the entire grid and pastes at row 0, column 0.
 *
 * ## Installation
 *
 * ```ts
 * import { ClipboardPlugin } from '@toolbox-web/grid/plugins/clipboard';
 * ```
 *
 * ## Keyboard Shortcuts
 *
 * | Shortcut | Action |
 * |----------|--------|
 * | `Ctrl+C` / `Cmd+C` | Copy selected cells |
 * | `Ctrl+V` / `Cmd+V` | Paste into selected cells |
 * | `Ctrl+X` / `Cmd+X` | Cut selected cells |
 *
 * ## Paste Behavior by Selection Type
 *
 * | Selection Type | Paste Behavior |
 * |----------------|----------------|
 * | Single cell | Paste expands freely from that cell |
 * | Range selection | Paste is clipped to fit within the selected range |
 * | Row selection | Paste is clipped to the selected rows |
 * | No selection | Paste starts at row 0, column 0 |
 *
 * With `fillSelection: true`, pasting a smaller source into a larger bounded
 * selection tiles the source to fill the whole selection (e.g. one cell fills
 * all selected cells; a 1×2 source fills as `val1, val2, val1, val2`).
 *
 * @example Basic Usage with Excel Compatibility
 * ```ts
 * import '@toolbox-web/grid';
 * import { ClipboardPlugin } from '@toolbox-web/grid/plugins/clipboard';
 * import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
 *
 * grid.gridConfig = {
 *   columns: [
 *     { field: 'name', header: 'Name' },
 *     { field: 'email', header: 'Email' },
 *   ],
 *   plugins: [
 *     new SelectionPlugin({ mode: 'range' }),
 *     new ClipboardPlugin({
 *       includeHeaders: true,
 *       delimiter: '\t', // Tab for Excel
 *     }),
 *   ],
 * };
 * ```
 *
 * @example Custom Paste Handler
 * ```ts
 * new ClipboardPlugin({
 *   pasteHandler: (grid, target, data) => {
 *     // Validate or transform data before applying
 *     console.log('Pasting', data.length, 'rows');
 *     return defaultPasteHandler(grid, target, data);
 *   },
 * })
 * ```
 *
 * @see {@link ClipboardConfig} for all configuration options
 * @see SelectionPlugin for enhanced copy/paste with selection
 *
 * @internal Extends BaseGridPlugin
 * @since 0.1.1
 */
export class ClipboardPlugin extends BaseGridPlugin<ClipboardConfig> {
  /**
   * Plugin manifest — declares queries for inter-plugin communication.
   * @internal
   */
  static override readonly manifest: PluginManifest = {
    queries: [{ type: 'clipboard:copy', description: 'Triggers a copy operation and returns the copied text' }],
  };

  /**
   * Plugin dependencies - ClipboardPlugin works best with SelectionPlugin.
   *
   * Without SelectionPlugin: copies entire grid, pastes at row 0 col 0.
   * With SelectionPlugin: copies/pastes based on selection.
   */
  /** @internal */
  static override readonly dependencies: PluginDependency[] = [
    { name: 'selection', required: false, reason: 'Enables copy/paste of selected cells instead of entire grid' },
  ];

  /** @internal */
  readonly name = 'clipboard';

  /** @internal */
  protected override get defaultConfig(): Partial<ClipboardConfig> {
    return {
      includeHeaders: false,
      delimiter: '\t',
      newline: '\n',
      quoteStrings: false,
    };
  }

  // #region Internal State
  /** The last copied text (for reference/debugging) */
  private lastCopied: { text: string; timestamp: number } | null = null;
  // #endregion

  // #region Lifecycle

  /** @internal */
  override attach(grid: GridElement): void {
    super.attach(grid);

    // Listen for native paste events to get clipboard data synchronously
    // This is more reliable than the async Clipboard API in iframe contexts
    grid.addEventListener('paste', (e) => this.#handleNativePaste(e), {
      signal: this.disconnectSignal,
    });
  }

  /** @internal */
  override detach(): void {
    this.lastCopied = null;
  }

  /** @internal */
  override handleQuery(query: PluginQuery): unknown {
    if (query.type === 'clipboard:copy') {
      this.copy();
      return true;
    }
    return undefined;
  }
  // #endregion

  // #region Event Handlers

  /** @internal */
  override onKeyDown(event: KeyboardEvent): boolean {
    const isCopy = (event.ctrlKey || event.metaKey) && event.key === 'c';

    if (isCopy) {
      // Prevent the browser's default copy action so it doesn't overwrite
      // our clipboard write with whatever text is selected in the DOM.
      event.preventDefault();
      this.#handleCopy(event.target as HTMLElement);
      return true;
    }

    // For paste, we do NOT return true - let the native paste event fire
    // so we can access clipboardData synchronously in #handleNativePaste
    return false;
  }
  // #endregion

  // #region Private Methods

  /**
   * Handle copy operation from keyboard shortcut.
   *
   * For keyboard-triggered copies, respects the current selection or
   * falls back to the focused cell from the DOM.
   */
  #handleCopy(target: HTMLElement): void {
    const selection = this.#getSelection();

    // Selection plugin exists but has no ranges → resolve the single active cell.
    // Range mode CLEARS `ranges` on plain keyboard navigation (arrow/Tab without
    // Shift), keeping the focused cell only as the selection `anchor`, and DOM
    // focus is NOT on a cell element after keyboard nav — so prefer the anchor
    // (a visible-column index) and only fall back to the focused DOM cell for
    // the mouse-focus / no-anchor edge. Without the anchor path, keyboard-nav
    // copy silently no-ops.
    if (selection && selection.ranges.length === 0) {
      let row: number | undefined;
      let field: string | undefined;
      if (selection.anchor) {
        row = selection.anchor.row;
        field = this.visibleColumns[selection.anchor.col]?.field;
      } else {
        const focused = this.#getFocusedCellFromDOM(target);
        if (focused) {
          row = focused.row;
          field = this.columns[focused.col]?.field;
        }
      }
      if (row == null || field == null) return;
      this.copy({ rowIndices: [row], columns: [field] });
      return;
    }

    // Delegate to the public copy() method (selection or full grid)
    this.copy();
  }

  /**
   * Handle native paste event (preferred method - works in iframes).
   * Uses synchronous clipboardData from the native paste event.
   *
   * Flow:
   * 1. Parse clipboard text
   * 2. Build target/fields info from selection
   * 3. Emit 'paste' event (for listeners)
   * 4. Call paste handler (if configured) to apply data to grid
   *
   * Selection behavior:
   * - Single cell: paste starts at cell, expands freely
   * - Range/row: paste is clipped to fit within selection bounds
   * - No selection: paste starts at row 0, col 0
   */
  #handleNativePaste(event: ClipboardEvent): void {
    // If the paste target is an editable form control or contenteditable element
    // (e.g. an active cell editor injected by EditingPlugin, a filter input, a
    // header search box), let the browser deliver the paste to that control
    // natively. Without this guard `event.preventDefault()` below would swallow
    // the user's keystroke and the editor input would never receive the text.
    if (this.#isEditablePasteTarget(event.target)) return;

    const text = event.clipboardData?.getData('text/plain');
    if (!text) return;

    // Prevent default to avoid pasting into contenteditable elements
    event.preventDefault();

    const parsed = parseClipboardText(text, this.config);

    // Get target cell from selection via query
    const selection = this.#getSelection();
    const ranges = selection?.ranges ?? [];
    const firstRange = ranges[0];

    // Aggregate the bounding box across ALL selected ranges. A multi-cell
    // selection is frequently expressed as several single-cell ranges (clicking
    // or dragging cell-by-cell), so inspecting `ranges[0]` alone would treat it
    // as a single cell and skip fill/clip — pasting into only the first cell.
    // min/max also normalizes reversed (bottom-up / right-to-left) drags.
    let selMinRow = Infinity;
    let selMinCol = Infinity;
    let selMaxRow = -Infinity;
    let selMaxCol = -Infinity;
    for (const r of ranges) {
      selMinRow = Math.min(selMinRow, r.from.row, r.to.row);
      selMaxRow = Math.max(selMaxRow, r.from.row, r.to.row);
      selMinCol = Math.min(selMinCol, r.from.col, r.to.col);
      selMaxCol = Math.max(selMaxCol, r.from.col, r.to.col);
    }

    // Determine target cell (top-left of the whole selection). Range mode
    // CLEARS `ranges` on plain keyboard navigation (arrow/Tab without Shift),
    // keeping the focused cell only as the selection `anchor`. So when there are
    // no ranges, fall back to the anchor before defaulting to (0,0) — otherwise
    // "copy, arrow to another cell, paste" always lands on cell (0,0) instead of
    // the active cell. Mirrors the focused-cell fallback in #handleCopy.
    const anchor = selection?.anchor ?? null;
    const targetRow = firstRange ? selMinRow : (anchor?.row ?? 0);
    const targetCol = firstRange ? selMinCol : (anchor?.col ?? 0);

    // Multi-cell when the selection spans more than one cell in total, whether
    // it's one large range or many single-cell ranges.
    const isMultiCell =
      !!firstRange &&
      (selection?.mode === 'range' || selection?.mode === 'row') &&
      (selMinRow !== selMaxRow || selMinCol !== selMaxCol);

    const bounds = isMultiCell ? { endRow: selMaxRow, endCol: selMaxCol } : null;
    // Selection range indices are visible-column indices (from data-col)
    const maxCol = bounds?.endCol ?? this.visibleColumns.length - 1;

    // Drop a copied header row so a round-trip paste writes only values into
    // cells (never the header label). Strips when this grid is configured to
    // include headers AND every cell of the first parsed row is one of this
    // grid's own column labels — independent of which column is pasted INTO, so
    // cross-column pastes (e.g. "Source terminal" → "Terminal route") strip too.
    // External pastes (first row ≠ labels) are left intact.
    this.#dropCopiedHeaderRow(parsed);

    // Build target info
    const column = this.visibleColumns[targetCol];
    const target: PasteTarget | null = column ? { row: targetRow, col: targetCol, field: column.field, bounds } : null;

    // Fill-selection tiling only applies to a bounded (multi-cell) selection.
    const fillSelection = this.config.fillSelection === true && bounds !== null;

    // Build field list for paste width (constrained by bounds if set). When
    // filling the selection, extend fields across the full selection width so
    // the source can be tiled to fill every selected column; otherwise cap at
    // the clipboard's own width.
    const fields: string[] = [];
    const pasteWidth = parsed[0]?.length ?? 0;
    const fieldWidth = fillSelection ? maxCol - targetCol + 1 : pasteWidth;
    for (let i = 0; i < fieldWidth && targetCol + i <= maxCol; i++) {
      const col = this.visibleColumns[targetCol + i];
      if (col) {
        fields.push(col.field);
      }
    }

    const detail: PasteDetail = { rows: parsed, text, target, fields, fillSelection };

    // Emit the event for any listeners
    this.emit<PasteDetail>('paste', detail);

    // Apply paste data using the configured handler (or default)
    this.#applyPasteHandler(detail);
  }

  /**
   * Apply the paste handler to update grid data.
   *
   * Uses the configured `pasteHandler`, or the default handler if not specified.
   * Set `pasteHandler: null` in config to disable auto-paste.
   */
  #applyPasteHandler(detail: PasteDetail): void {
    if (!this.grid) return;

    const { pasteHandler } = this.config;

    // pasteHandler: null means explicitly disabled
    if (pasteHandler === null) return;

    // Use custom handler or default
    const handler = pasteHandler ?? defaultPasteHandler;
    handler(detail, this.grid);
  }

  /**
   * Drop a header row that this grid itself copied, so a round-trip paste
   * never lands a header label in a data cell.
   *
   * A row copied with `includeHeaders` consists entirely of this grid's own
   * column labels (`header || field`). Detect that by matching every cell of the
   * first parsed row against the full set of column labels — independent of
   * which column the user pastes INTO. This is essential for **cross-column**
   * paste (e.g. copying "Source terminal" and pasting into "Terminal route"):
   * the copied header carries the SOURCE column's label, which does not equal
   * the target column's label but is still one of this grid's labels. Matching
   * the label set fixes cross-column paste while leaving external pastes (whose
   * first row is data, not labels) untouched.
   *
   * Guarded to avoid eating a legitimate first data row:
   * 1. The grid is configured with `includeHeaders` (it copies headers), and
   * 2. there is more than one row (never strip the only row), and
   * 3. every cell of the first row equals some column's label.
   */
  #dropCopiedHeaderRow(parsed: string[][]): void {
    if (!this.config.includeHeaders) return;
    // Never strip away the only row — that would make paste a no-op.
    if (parsed.length <= 1) return;

    const headerRow = parsed[0];
    if (headerRow.length === 0) return;

    const labels = this.#columnLabels();
    for (const cell of headerRow) {
      // A cell that isn't a known column label → this is real data, keep the row.
      if (!labels.has(cell)) return;
    }

    parsed.shift();
  }

  /**
   * Set of this grid's column labels (`header || field`), matching how
   * {@link buildClipboardText} serializes the copied header row. Used to detect
   * a header row this grid copied, regardless of paste position.
   */
  #columnLabels(): Set<string> {
    const labels = new Set<string>();
    for (const col of this.columns) {
      const label = col.header || col.field;
      if (label) labels.add(label);
    }
    return labels;
  }

  /**
   * True when the paste event originated from a focusable form control or
   * contenteditable element — i.e. somewhere the user expects the browser's
   * native paste behavior (typing into an editor input). Lets EditingPlugin
   * editors, filter inputs, and other text fields receive paste normally
   * instead of having ClipboardPlugin swallow the event.
   */
  #isEditablePasteTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    if (target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) {
      return true;
    }
    return false;
  }

  /**
   * Get the current selection via Query System.
   * Returns undefined if no selection plugin is loaded or nothing is selected.
   */
  #getSelection(): SelectionQueryResult | undefined {
    const responses = this.grid?.query<SelectionQueryResult>('getSelection');
    return responses?.[0];
  }

  /**
   * Resolve columns and rows to include based on options and/or current selection.
   *
   * Priority for columns:
   *   1. `options.columns` (explicit field list)
   *   2. Selection range column bounds (range/cell mode only)
   *   3. All visible non-utility columns
   *
   * Priority for rows:
   *   1. `options.rowIndices` (explicit indices)
   *   2. Selection range row bounds
   *   3. All rows
   */
  #resolveData(options?: CopyOptions): { columns: ColumnConfig[]; rows: Record<string, unknown>[] } {
    const selection = this.#getSelection();

    // --- Columns ---
    let columns: ColumnConfig[];
    if (options?.columns) {
      // Caller specified exact fields
      columns = resolveColumns(this.columns, options.columns);
    } else if (selection?.ranges.length && selection.mode !== 'row') {
      // Range/cell selection: restrict to selection column bounds
      // Selection indices are visible-column indices (from data-col)
      const range = selection.ranges[selection.ranges.length - 1];
      const minCol = Math.min(range.from.col, range.to.col);
      const maxCol = Math.max(range.from.col, range.to.col);
      columns = resolveColumns(this.visibleColumns.slice(minCol, maxCol + 1));
    } else {
      // Row selection or no selection: all visible columns
      columns = resolveColumns(this.columns);
    }

    // --- Rows ---
    let rows: Record<string, unknown>[];
    if (options?.rowIndices) {
      // Caller specified exact row indices
      rows = resolveRows(this.rows as Record<string, unknown>[], options.rowIndices);
    } else if (selection?.ranges.length) {
      // Selection range: extract contiguous row range
      const range = selection.ranges[selection.ranges.length - 1];
      const minRow = Math.min(range.from.row, range.to.row);
      const maxRow = Math.max(range.from.row, range.to.row);
      rows = [];
      for (let r = minRow; r <= maxRow; r++) {
        const row = this.rows[r] as Record<string, unknown> | undefined;
        if (row) rows.push(row);
      }
    } else {
      // No selection: all rows
      rows = this.rows as Record<string, unknown>[];
    }

    return { columns, rows };
  }

  /**
   * Build delimited text from resolved columns and rows.
   *
   * When no `processCell` callback is configured, uses "copy what you see" logic:
   * 1. Column `format` function (includes typeDefaults merged at config time)
   * 2. DOM cell textContent for columns with custom renderers (visible rows only)
   * 3. Raw value via `formatValueAsText` as final fallback
   */
  #buildText(columns: ColumnConfig[], rows: Record<string, unknown>[], options?: CopyOptions): string {
    const delimiter = options?.delimiter ?? this.config.delimiter ?? '\t';
    const newline = options?.newline ?? this.config.newline ?? '\n';
    const includeHeaders = options?.includeHeaders ?? this.config.includeHeaders ?? false;
    const processCell = options?.processCell ?? this.config.processCell;

    const lines: string[] = [];

    // Header row
    if (includeHeaders) {
      lines.push(columns.map((c) => c.header || c.field).join(delimiter));
    }

    // Data rows
    for (const row of rows) {
      const cells = columns.map((col) => {
        const value = resolveCellValue(row, col);
        if (processCell) return processCell(value, col.field, row);
        return this.#formatCellAsDisplayed(col, value, row);
      });
      lines.push(cells.join(delimiter));
    }

    return lines.join(newline);
  }

  /**
   * Format a cell value the way the grid displays it.
   *
   * Priority:
   * 1. Column `format` function (includes typeDefaults applied at config merge time)
   * 2. DOM textContent for columns with a custom renderer (virtualized rows only)
   * 3. Raw value via `formatValueAsText`
   */
  #formatCellAsDisplayed(col: ColumnConfig, value: unknown, row: Record<string, unknown>): string {
    // 1. Column format function (covers col.format and typeDefaults)
    if (col.format) {
      try {
        const formatted = col.format(value, row);
        return formatted == null ? '' : String(formatted);
      } catch {
        // Format failed — fall through to next strategy
      }
    }

    // 2. DOM textContent for columns with custom renderers
    if (col.renderer || col.viewRenderer) {
      const text = this.#readCellTextFromDOM(col.field, row);
      if (text != null) return text;
    }

    // 3. Fallback to raw value formatting
    return formatValueAsText(value);
  }

  /**
   * Try to read a cell's displayed text from the DOM.
   *
   * Only works for rows currently rendered in the virtualized viewport.
   * Returns `null` if the row is not in the DOM (caller should fall back).
   */
  #readCellTextFromDOM(field: string, row: Record<string, unknown>): string | null {
    const host = this.gridElement;
    if (!host) return null;

    // Find the row index in the grid's current row array
    const rowIndex = this.rows.indexOf(row);
    if (rowIndex === -1) return null;

    // Query the rendered cell by row index and field name
    const cell = host.querySelector<HTMLElement>(`.cell[data-row="${rowIndex}"][data-field="${field}"]`);
    if (!cell) return null;

    return cell.textContent?.trim() ?? null;
  }

  /**
   * Get focused cell coordinates from DOM.
   * Used as fallback when SelectionPlugin has no selection.
   */
  #getFocusedCellFromDOM(target: HTMLElement): { row: number; col: number } | null {
    // Cells carry `data-field` + `data-row` (see `data-field-cache` was never a
    // real attribute). Body cells have `data-row`; header cells don't, so the
    // `data-row` guard below excludes headers.
    const cell = target.closest('.cell[data-field]') as HTMLElement | null;
    if (!cell) return null;

    const field = cell.dataset.field;
    const rowIndexStr = cell.dataset.row;
    if (!field || !rowIndexStr) return null;

    const row = parseInt(rowIndexStr, 10);
    if (isNaN(row)) return null;

    const col = this.columns.findIndex((c) => c.field === field);
    if (col === -1) return null;

    return { row, col };
  }
  // #endregion

  // #region Public API

  /**
   * Get the text representation of the current selection (or specified data)
   * without writing to the system clipboard.
   *
   * Useful for previewing what would be copied, or for feeding the text into
   * a custom UI (e.g., a "copy with column picker" dialog).
   *
   * @param options - Control which columns/rows to include
   * @returns Delimited text, or empty string if nothing to copy
   *
   * @example Get text for specific columns
   * ```ts
   * const clipboard = grid.getPluginByName('clipboard');
   * const text = clipboard.getSelectionAsText({
   *   columns: ['name', 'email'],
   *   includeHeaders: true,
   * });
   * console.log(text);
   * // "Name\tEmail\nAlice\talice@example.com\n..."
   * ```
   */
  getSelectionAsText(options?: CopyOptions): string {
    const { columns, rows } = this.#resolveData(options);
    if (columns.length === 0 || rows.length === 0) return '';
    return this.#buildText(columns, rows, options);
  }

  /**
   * Copy data to the system clipboard.
   *
   * Without options, copies the current selection (or entire grid if no selection).
   * With options, copies exactly the specified columns and/or rows — ideal for
   * "copy with column picker" workflows where the user selects rows first,
   * then chooses which columns to include via a dialog.
   *
   * @param options - Control which columns/rows to include
   * @returns The copied text
   *
   * @example Copy current selection (default)
   * ```ts
   * const clipboard = grid.getPluginByName('clipboard');
   * await clipboard.copy();
   * ```
   *
   * @example Copy specific columns from specific rows
   * ```ts
   * // User selected rows in the grid, then picked columns in a dialog
   * const selectedRowIndices = [0, 3, 7];
   * const chosenColumns = ['name', 'department', 'salary'];
   * await clipboard.copy({
   *   rowIndices: selectedRowIndices,
   *   columns: chosenColumns,
   *   includeHeaders: true,
   * });
   * ```
   */
  async copy(options?: CopyOptions): Promise<string> {
    const { columns, rows } = this.#resolveData(options);
    if (columns.length === 0 || rows.length === 0) {
      return '';
    }

    const text = this.#buildText(columns, rows, options);
    await copyToClipboard(text);
    this.lastCopied = { text, timestamp: Date.now() };
    this.emit<CopyDetail>('copy', {
      text,
      rowCount: rows.length,
      columnCount: columns.length,
    });
    return text;
  }

  /**
   * Copy specific rows by index to clipboard.
   *
   * Convenience wrapper around {@link copy} for row-based workflows.
   * Supports non-contiguous row indices (e.g., `[0, 3, 7]`).
   *
   * @param indices - Array of row indices to copy
   * @param options - Additional copy options (columns, headers, etc.)
   * @returns The copied text
   *
   * @example
   * ```ts
   * const clipboard = grid.getPluginByName('clipboard');
   * // Copy only rows 0 and 5, including just name and email columns
   * await clipboard.copyRows([0, 5], { columns: ['name', 'email'] });
   * ```
   */
  async copyRows(indices: number[], options?: Omit<CopyOptions, 'rowIndices'>): Promise<string> {
    if (indices.length === 0) return '';
    return this.copy({ ...options, rowIndices: indices });
  }

  /**
   * Read and parse clipboard content.
   * @returns Parsed 2D array of cell values, or null if clipboard is empty
   */
  async paste(): Promise<string[][] | null> {
    const text = await readFromClipboard();
    if (!text) return null;
    return parseClipboardText(text, this.config);
  }

  /**
   * Get the last copied text and timestamp.
   * @returns The last copied info or null
   */
  getLastCopied(): { text: string; timestamp: number } | null {
    return this.lastCopied;
  }
  // #endregion
}

// #region Internal Types

/**
 * Range representation for clipboard operations.
 */
interface CellRange {
  from: { row: number; col: number };
  to: { row: number; col: number };
}

/**
 * Selection result returned by the Query System.
 * Matches the SelectionResult type from SelectionPlugin.
 */
interface SelectionQueryResult {
  mode: 'cell' | 'row' | 'range';
  ranges: CellRange[];
  anchor: { row: number; col: number } | null;
}
// #endregion

// Re-export types
export type { ClipboardConfig, CopyDetail, CopyOptions, PasteDetail } from './types';
