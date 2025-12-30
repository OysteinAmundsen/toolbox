/**
 * Clipboard Plugin (Class-based)
 *
 * Provides copy/paste functionality for tbw-grid.
 * Supports Ctrl+C/Cmd+C for copying and Ctrl+V/Cmd+V for pasting.
 *
 * **With Selection plugin:** Copy selected rows as a range
 * - includeHeaders: true → adds header row at top
 * - includeHeaders: false → data rows only
 *
 * **Without Selection plugin:** Copy focused cell only
 * - includeHeaders: true → "Header: value" format
 * - includeHeaders: false → value only
 */

import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import { buildClipboardText, copyToClipboard } from './copy';
import { parseClipboardText, readFromClipboard } from './paste';
import type { ClipboardConfig, CopyDetail, PasteDetail } from './types';

/**
 * Clipboard Plugin for tbw-grid
 *
 * @example
 * ```ts
 * new ClipboardPlugin({ includeHeaders: true })
 * ```
 */
export class ClipboardPlugin extends BaseGridPlugin<ClipboardConfig> {
  readonly name = 'clipboard';
  override readonly version = '1.0.0';

  protected override get defaultConfig(): Partial<ClipboardConfig> {
    return {
      includeHeaders: false,
      delimiter: '\t',
      newline: '\n',
      quoteStrings: false,
    };
  }

  // ===== Internal State =====
  /** The last copied text (for reference/debugging) */
  private lastCopied: { text: string; timestamp: number } | null = null;

  // ===== Lifecycle =====

  override detach(): void {
    this.lastCopied = null;
  }

  // ===== Event Handlers =====

  override onKeyDown(event: KeyboardEvent): boolean {
    const isCopy = (event.ctrlKey || event.metaKey) && event.key === 'c';
    const isPaste = (event.ctrlKey || event.metaKey) && event.key === 'v';

    if (isCopy) {
      this.#handleCopy(event.target as HTMLElement);
      return true; // Prevent default browser behavior
    }

    if (isPaste) {
      this.#handlePaste();
      return true; // Prevent default browser behavior
    }

    return false;
  }

  // ===== Private Methods =====

  /**
   * Handle copy operation
   */
  #handleCopy(target: HTMLElement): void {
    // Try to get selection from selection plugin (if available)
    // Use dynamic import to avoid circular dependency issues
    const selectionPlugin = this.#getSelectionPlugin();

    // Check for different selection types
    const selectedRows = selectionPlugin?.getSelectedRows() ?? [];
    const hasRowSelection = selectedRows.length > 0;
    const ranges = selectionPlugin?.getRanges() ?? [];
    const hasRangeSelection = ranges.length > 0;
    const hasCellSelection = selectionPlugin?.getSelectedCell() != null;

    let text: string;
    let rowCount: number;
    let columnCount: number;

    if (hasRowSelection && selectionPlugin) {
      // Row selection mode - copy full rows
      text = buildClipboardText({
        rows: this.rows as unknown[],
        columns: [...this.columns],
        selectedIndices: selectedRows,
        config: this.config,
      });
      rowCount = selectedRows.length;
      columnCount = this.columns.filter((c) => !c.hidden && !c.field.startsWith('__')).length;
    } else if (hasRangeSelection && selectionPlugin) {
      // Range selection mode - copy rectangular range (use last range as active)
      const range = ranges[ranges.length - 1];
      const result = this.#buildRangeText({
        startRow: range.from.row,
        startCol: range.from.col,
        endRow: range.to.row,
        endCol: range.to.col,
      });
      text = result.text;
      rowCount = result.rowCount;
      columnCount = result.columnCount;
    } else if (hasCellSelection && selectionPlugin) {
      // Cell selection mode - copy single cell
      const cell = selectionPlugin.getSelectedCell()!;
      const result = this.#buildCellText(cell.row, cell.col);
      if (!result) return;
      text = result.text;
      rowCount = 1;
      columnCount = 1;
    } else {
      // Fallback: try to find focused cell from DOM
      const result = this.#buildSingleCellText(target);
      if (!result) return;
      text = result.text;
      rowCount = 1;
      columnCount = 1;
    }

    copyToClipboard(text).then(() => {
      this.lastCopied = { text, timestamp: Date.now() };
      this.emit<CopyDetail>('copy', { text, rowCount, columnCount });
    });
  }

  /**
   * Handle paste operation
   */
  #handlePaste(): void {
    readFromClipboard().then((text) => {
      if (!text) return;
      const parsed = parseClipboardText(text, this.config);
      this.emit<PasteDetail>('paste', { rows: parsed, text });
    });
  }

  /**
   * Get the selection plugin instance if available.
   */
  #getSelectionPlugin(): SelectionPluginInterface | undefined {
    // Dynamically get the SelectionPlugin class to avoid import order issues
    try {
      // Use getPlugin with the class - this requires the class to be imported
      // For now, we'll use a duck-typing approach via the grid's plugin registry
      const grid = this.grid as any;
      if (grid?._plugins) {
        for (const plugin of grid._plugins) {
          if (plugin.name === 'selection') {
            return plugin as SelectionPluginInterface;
          }
        }
      }
    } catch {
      // Selection plugin not available
    }
    return undefined;
  }

  /**
   * Build text for a single cell by row/col index.
   */
  #buildCellText(rowIndex: number, colIndex: number): { text: string } | null {
    const rowData = this.rows[rowIndex] as Record<string, unknown> | undefined;
    if (!rowData) return null;

    const column = this.columns[colIndex];
    if (!column) return null;

    const value = rowData[column.field];
    const header = column.header || column.field;

    let text: string;
    if (this.config.includeHeaders) {
      const formattedValue = value == null ? '' : String(value);
      text = `${header}: ${formattedValue}`;
    } else {
      text = value == null ? '' : String(value);
    }

    return { text };
  }

  /**
   * Build text for a rectangular range of cells.
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

    // Get columns in the range
    const rangeColumns = this.columns.slice(minCol, maxCol + 1);

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
   * Build text for a single focused cell from DOM.
   * Used when selection plugin is not available or no rows are selected.
   */
  #buildSingleCellText(target: HTMLElement): { text: string; field: string; value: unknown } | null {
    // Find the cell element - cells use data-field-cache for the field name
    const cell = target.closest('[data-field-cache]') as HTMLElement | null;
    if (!cell) return null;

    const field = cell.dataset.fieldCache;
    if (!field) return null;

    // Get row index from data-row attribute on the cell
    const rowIndexStr = cell.dataset.row;
    if (!rowIndexStr) return null;

    const rowIndex = parseInt(rowIndexStr, 10);
    if (isNaN(rowIndex)) return null;

    const rowData = this.rows[rowIndex] as Record<string, unknown> | undefined;
    if (!rowData) return null;

    const value = rowData[field];
    const column = this.columns.find((c) => c.field === field);
    const header = column?.header || field;

    // Format the text based on includeHeaders config
    let text: string;
    if (this.config.includeHeaders) {
      // Format: "{header}: {value}"
      const formattedValue = value == null ? '' : String(value);
      text = `${header}: ${formattedValue}`;
    } else {
      // Just the value
      text = value == null ? '' : String(value);
    }

    return { text, field, value };
  }

  // ===== Public API =====

  /**
   * Copy currently selected rows to clipboard.
   * @returns The copied text
   */
  async copy(): Promise<string> {
    const selectionPlugin = this.#getSelectionPlugin();
    const indices = selectionPlugin?.getSelectedRows() ?? [];

    const text = buildClipboardText({
      rows: this.rows as unknown[],
      columns: [...this.columns],
      selectedIndices: indices,
      config: this.config,
    });

    await copyToClipboard(text);
    this.lastCopied = { text, timestamp: Date.now() };
    return text;
  }

  /**
   * Copy specific rows by index to clipboard.
   * @param indices - Array of row indices to copy
   * @returns The copied text
   */
  async copyRows(indices: number[]): Promise<string> {
    const text = buildClipboardText({
      rows: this.rows as unknown[],
      columns: [...this.columns],
      selectedIndices: indices,
      config: this.config,
    });

    await copyToClipboard(text);
    this.lastCopied = { text, timestamp: Date.now() };
    return text;
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
}

// ===== Internal Types =====

/**
 * Interface for SelectionPlugin methods we need.
 * This avoids circular imports while providing type safety.
 */
interface SelectionPluginInterface {
  name: string;
  /** Get selected row indices (row mode) */
  getSelectedRows(): number[];
  /** Get all selected cell ranges (range mode) */
  getRanges(): Array<{ from: { row: number; col: number }; to: { row: number; col: number } }>;
  /** Get selected cell (cell mode) */
  getSelectedCell(): { row: number; col: number } | null;
}

// Re-export types
export type { ClipboardConfig, CopyDetail, PasteDetail } from './types';
