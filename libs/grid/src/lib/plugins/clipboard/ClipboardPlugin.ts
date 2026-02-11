/**
 * Clipboard Plugin (Class-based)
 *
 * Provides copy/paste functionality for tbw-grid.
 * Supports Ctrl+C/Cmd+C for copying and Ctrl+V/Cmd+V for pasting.
 *
 * **With Selection plugin:** Copies selected cells/rows/range
 * **Without Selection plugin:** Copies entire grid
 */

import { BaseGridPlugin, type GridElement, type PluginDependency } from '../../core/plugin/base-plugin';
import { isUtilityColumn } from '../../core/plugin/expander-column';
import { copyToClipboard } from './copy';
import { parseClipboardText, readFromClipboard } from './paste';
import {
  defaultPasteHandler,
  type ClipboardConfig,
  type CopyDetail,
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
 * ## Configuration Options
 *
 * | Option | Type | Default | Description |
 * |--------|------|---------|-------------|
 * | `includeHeaders` | `boolean` | `false` | Include column headers in copied data |
 * | `delimiter` | `string` | `'\t'` | Column delimiter (tab for Excel compatibility) |
 * | `newline` | `string` | `'\n'` | Row delimiter |
 * | `quoteStrings` | `boolean` | `false` | Wrap string values in quotes |
 * | `processCell` | `(value, field, row) => string` | - | Custom cell value processor |
 * | `pasteHandler` | `PasteHandler \| null` | `defaultPasteHandler` | Custom paste handler |
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
 * ## Programmatic API
 *
 * | Method | Signature | Description |
 * |--------|-----------|-------------|
 * | `copy` | `(options?) => Promise<void>` | Copy selection to clipboard |
 * | `paste` | `() => Promise<void>` | Paste from clipboard |
 * | `getSelectionAsText` | `() => string` | Get clipboard text without copying |
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
 * @see {@link SelectionPlugin} for enhanced copy/paste with selection
 *
 * @internal Extends BaseGridPlugin
 */
export class ClipboardPlugin extends BaseGridPlugin<ClipboardConfig> {
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
    // Cast to HTMLElement since GridElement is an interface
    (grid as unknown as HTMLElement).addEventListener(
      'paste',
      (e: Event) => this.#handleNativePaste(e as ClipboardEvent),
      { signal: this.disconnectSignal },
    );
  }

  /** @internal */
  override detach(): void {
    this.lastCopied = null;
  }
  // #endregion

  // #region Event Handlers

  /** @internal */
  override onKeyDown(event: KeyboardEvent): boolean {
    const isCopy = (event.ctrlKey || event.metaKey) && event.key === 'c';

    if (isCopy) {
      this.#handleCopy(event.target as HTMLElement);
      return true; // Prevent default browser behavior
    }

    // For paste, we do NOT return true - let the native paste event fire
    // so we can access clipboardData synchronously in #handleNativePaste
    return false;
  }
  // #endregion

  // #region Private Methods

  /**
   * Handle copy operation.
   *
   * Everything is treated as a range:
   * - With selection: copies the selected range
   * - Row mode: range spanning all columns for selected rows
   * - No selection plugin: entire grid as a range
   * - No selection: try to get focused cell from DOM as 1x1 range
   */
  #handleCopy(target: HTMLElement): void {
    const selection = this.#getSelection();
    const lastCol = this.columns.length - 1;
    const lastRow = this.rows.length - 1;

    let range: { startRow: number; startCol: number; endRow: number; endCol: number };

    if (selection && selection.ranges.length > 0) {
      const { mode, ranges } = selection;
      const activeRange = ranges[ranges.length - 1];

      if (mode === 'row') {
        // Row mode: use row bounds, but span all columns
        range = {
          startRow: activeRange.from.row,
          startCol: 0,
          endRow: activeRange.to.row,
          endCol: lastCol,
        };
      } else {
        // Cell or range mode: use the selection as-is
        range = {
          startRow: activeRange.from.row,
          startCol: activeRange.from.col,
          endRow: activeRange.to.row,
          endCol: activeRange.to.col,
        };
      }
    } else if (!selection) {
      // No selection plugin: copy entire grid
      range = { startRow: 0, startCol: 0, endRow: lastRow, endCol: lastCol };
    } else {
      // Selection plugin exists but no selection: try focused cell from DOM
      const focused = this.#getFocusedCellFromDOM(target);
      if (!focused) return;
      range = { startRow: focused.row, startCol: focused.col, endRow: focused.row, endCol: focused.col };
    }

    const result = this.#buildRangeText(range);

    copyToClipboard(result.text).then(() => {
      this.lastCopied = { text: result.text, timestamp: Date.now() };
      this.emit<CopyDetail>('copy', {
        text: result.text,
        rowCount: result.rowCount,
        columnCount: result.columnCount,
      });
    });
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
    const text = event.clipboardData?.getData('text/plain');
    if (!text) return;

    // Prevent default to avoid pasting into contenteditable elements
    event.preventDefault();

    const parsed = parseClipboardText(text, this.config);

    // Get target cell from selection via query
    const selection = this.#getSelection();
    const firstRange = selection?.ranges?.[0];

    // Determine target cell and bounds
    const targetRow = firstRange?.from.row ?? 0;
    const targetCol = firstRange?.from.col ?? 0;

    // Check if multi-cell selection (range with different start/end)
    const isMultiCell =
      firstRange &&
      (selection?.mode === 'range' || selection?.mode === 'row') &&
      (firstRange.from.row !== firstRange.to.row || firstRange.from.col !== firstRange.to.col);

    const bounds = isMultiCell ? { endRow: firstRange.to.row, endCol: firstRange.to.col } : null;
    const maxCol = bounds?.endCol ?? this.columns.length - 1;

    // Build target info
    const column = this.columns[targetCol];
    const target: PasteTarget | null = column ? { row: targetRow, col: targetCol, field: column.field, bounds } : null;

    // Build field list for paste width (constrained by bounds if set)
    const fields: string[] = [];
    const pasteWidth = parsed[0]?.length ?? 0;
    for (let i = 0; i < pasteWidth && targetCol + i <= maxCol; i++) {
      const col = this.columns[targetCol + i];
      if (col && !col.hidden) {
        fields.push(col.field);
      }
    }

    const detail: PasteDetail = { rows: parsed, text, target, fields };

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
   * Get the current selection via Query System.
   * Returns undefined if no selection plugin is loaded or nothing is selected.
   */
  #getSelection(): SelectionQueryResult | undefined {
    const responses = this.grid?.query<SelectionQueryResult>('getSelection');
    return responses?.[0];
  }

  /**
   * Build text for a rectangular range of cells.
   * Utility columns (like expander columns) are automatically excluded.
   */
  #buildRangeText(range: { startRow: number; startCol: number; endRow: number; endCol: number }): {
    text: string;
    rowCount: number;
    columnCount: number;
  } {
    const { startRow, startCol, endRow, endCol } = range;
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    const delimiter = this.config.delimiter ?? '\t';
    const newline = this.config.newline ?? '\n';
    const lines: string[] = [];

    // Get columns in the range, excluding utility columns (expander, etc.)
    const rangeColumns = this.columns.slice(minCol, maxCol + 1).filter((col) => !isUtilityColumn(col));

    // Add header row if configured
    if (this.config.includeHeaders) {
      const headerCells = rangeColumns.map((c) => c.header || c.field);
      lines.push(headerCells.join(delimiter));
    }

    // Add data rows
    for (let r = minRow; r <= maxRow; r++) {
      const rowData = this.rows[r] as Record<string, unknown> | undefined;
      if (!rowData) continue;

      const cells = rangeColumns.map((col) => {
        const value = rowData[col.field];
        if (value == null) return '';
        if (value instanceof Date) return value.toISOString();
        return String(value);
      });
      lines.push(cells.join(delimiter));
    }

    return {
      text: lines.join(newline),
      rowCount: maxRow - minRow + 1,
      columnCount: maxCol - minCol + 1,
    };
  }

  /**
   * Get focused cell coordinates from DOM.
   * Used as fallback when SelectionPlugin has no selection.
   */
  #getFocusedCellFromDOM(target: HTMLElement): { row: number; col: number } | null {
    const cell = target.closest('[data-field-cache]') as HTMLElement | null;
    if (!cell) return null;

    const field = cell.dataset.fieldCache;
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
   * Copy currently selected rows to clipboard.
   * @returns The copied text
   */
  async copy(): Promise<string> {
    const selection = this.#getSelection();
    const lastCol = this.columns.length - 1;

    // Default to entire grid if no selection
    let range = { startRow: 0, startCol: 0, endRow: this.rows.length - 1, endCol: lastCol };

    if (selection && selection.ranges.length > 0) {
      const activeRange = selection.ranges[selection.ranges.length - 1];
      if (selection.mode === 'row') {
        range = { startRow: activeRange.from.row, startCol: 0, endRow: activeRange.to.row, endCol: lastCol };
      } else {
        range = {
          startRow: activeRange.from.row,
          startCol: activeRange.from.col,
          endRow: activeRange.to.row,
          endCol: activeRange.to.col,
        };
      }
    }

    const result = this.#buildRangeText(range);
    await copyToClipboard(result.text);
    this.lastCopied = { text: result.text, timestamp: Date.now() };
    return result.text;
  }

  /**
   * Copy specific rows by index to clipboard.
   * @param indices - Array of row indices to copy
   * @returns The copied text
   */
  async copyRows(indices: number[]): Promise<string> {
    if (indices.length === 0) return '';

    const sortedIndices = [...indices].sort((a, b) => a - b);
    const lastCol = this.columns.length - 1;

    // For non-contiguous rows, we need to copy each row separately
    // For now, copy the range from first to last selected row
    const range = {
      startRow: sortedIndices[0],
      startCol: 0,
      endRow: sortedIndices[sortedIndices.length - 1],
      endCol: lastCol,
    };

    const result = this.#buildRangeText(range);
    await copyToClipboard(result.text);
    this.lastCopied = { text: result.text, timestamp: Date.now() };
    return result.text;
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
export type { ClipboardConfig, CopyDetail, PasteDetail } from './types';
