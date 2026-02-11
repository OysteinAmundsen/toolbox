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
 * | `copy` | `(options?: CopyOptions) => Promise<string>` | Copy to clipboard with optional column/row control |
 * | `copyRows` | `(indices, options?) => Promise<string>` | Copy specific rows to clipboard |
 * | `paste` | `() => Promise<string[][] \| null>` | Read and parse clipboard content |
 * | `getSelectionAsText` | `(options?: CopyOptions) => string` | Get clipboard text without writing to clipboard |
 * | `getLastCopied` | `() => { text, timestamp } \| null` | Get info about last copy operation |
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
   * Handle copy operation from keyboard shortcut.
   *
   * For keyboard-triggered copies, respects the current selection or
   * falls back to the focused cell from the DOM.
   */
  #handleCopy(target: HTMLElement): void {
    const selection = this.#getSelection();

    // Selection plugin exists but nothing selected → try focused cell from DOM
    if (selection && selection.ranges.length === 0) {
      const focused = this.#getFocusedCellFromDOM(target);
      if (!focused) return;
      const col = this.columns[focused.col];
      if (!col) return;
      this.copy({ rowIndices: [focused.row], columns: [col.field] });
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
      const range = selection.ranges[selection.ranges.length - 1];
      const minCol = Math.min(range.from.col, range.to.col);
      const maxCol = Math.max(range.from.col, range.to.col);
      columns = resolveColumns(this.columns.slice(minCol, maxCol + 1));
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
        const value = row[col.field];
        if (processCell) return processCell(value, col.field, row);
        return formatValueAsText(value);
      });
      lines.push(cells.join(delimiter));
    }

    return lines.join(newline);
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
   * const clipboard = grid.getPlugin(ClipboardPlugin);
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
   * const clipboard = grid.getPlugin(ClipboardPlugin);
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
    if (columns.length === 0 || rows.length === 0) return '';

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
   * const clipboard = grid.getPlugin(ClipboardPlugin);
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
