/**
 * Clipboard Plugin Types
 *
 * Type definitions for clipboard copy/paste functionality.
 */

/** Configuration options for the clipboard plugin */
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
}

/** Internal state managed by the clipboard plugin */
export interface ClipboardState {
  /** The last copied text (for reference/debugging) */
  lastCopied: string | null;
}

/** Event detail emitted after a successful copy operation */
export interface CopyDetail {
  /** The text that was copied to clipboard */
  text: string;
  /** Number of rows copied */
  rowCount: number;
  /** Number of columns copied */
  columnCount: number;
}

/** Event detail emitted after a paste operation */
export interface PasteDetail {
  /** Parsed rows from clipboard (2D array of cell values) */
  rows: string[][];
  /** Raw text that was pasted */
  text: string;
}
