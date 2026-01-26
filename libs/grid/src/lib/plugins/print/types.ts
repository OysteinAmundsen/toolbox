/**
 * Print Plugin Types
 *
 * Type definitions for the print layout feature.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ============================================================================
// Module Augmentation - Extends core types with print-specific properties
// ============================================================================

declare module '../../core/types' {
  /**
   * Augment ColumnConfig with print visibility property.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnConfig<TRow = any> {
    /**
     * Hide this column when printing (default: false).
     * Use this to exclude interactive or less important columns from print output.
     *
     * @example
     * ```ts
     * columns: [
     *   { field: 'name', header: 'Name' },
     *   { field: 'actions', header: 'Actions', printHidden: true }, // Hidden in print
     * ]
     * ```
     */
    printHidden?: boolean;
  }
}

/** Page orientation */
export type PrintOrientation = 'portrait' | 'landscape';

/** Configuration options for the print plugin */
export interface PrintConfig {
  /**
   * Show print button in toolbar (default: false)
   * When true, adds a print icon to the grid toolbar
   */
  button?: boolean;

  /**
   * Page orientation (default: 'landscape')
   * Grids typically print better in landscape
   */
  orientation?: PrintOrientation;

  /**
   * Show a confirmation dialog when row count exceeds this threshold (default: 500)
   *
   * When the number of rows to print exceeds this value, the user is shown a
   * confirmation dialog asking if they want to proceed. This gives users a chance
   * to cancel before a potentially slow print operation.
   *
   * Set to 0 to disable the warning dialog.
   *
   * Note: This only shows a warning - it does NOT limit the rows printed.
   * Use `maxRows` to actually limit the output.
   *
   * @example
   * ```ts
   * // Warn at 500+ rows, but allow printing all if confirmed
   * new PrintPlugin({ warnThreshold: 500 })
   *
   * // Warn at 1000+ rows AND limit to 500 rows max
   * new PrintPlugin({ warnThreshold: 1000, maxRows: 500 })
   * ```
   */
  warnThreshold?: number;

  /**
   * Maximum rows to print (default: 0 = unlimited)
   *
   * When set to a positive number, only the first N rows will be printed.
   * This is a hard limit - excess rows are not rendered regardless of user choice.
   *
   * Use `warnThreshold` to show a confirmation dialog instead of hard-limiting.
   *
   * @example
   * ```ts
   * // Hard limit to 100 rows (no warning, just limits)
   * new PrintPlugin({ maxRows: 100 })
   *
   * // Warn at 500+ AND hard limit to 1000
   * new PrintPlugin({ warnThreshold: 500, maxRows: 1000 })
   * ```
   */
  maxRows?: number;

  /**
   * Include grid title in print output (default: true)
   * Uses shell.header.title if available
   */
  includeTitle?: boolean;

  /**
   * Include timestamp in print footer (default: true)
   */
  includeTimestamp?: boolean;

  /**
   * Custom print title (overrides shell title)
   */
  title?: string;

  /**
   * Print in isolation mode (default: false)
   *
   * When true, uses CSS to hide all other page content during printing,
   * showing only the grid. This is the default when the toolbar button is clicked.
   */
  isolate?: boolean;
}

/** Parameters for a specific print operation */
export interface PrintParams {
  /** Override page orientation for this print */
  orientation?: PrintOrientation;

  /** Override title for this print */
  title?: string;

  /** Override warn threshold for this print (0 = no warning) */
  warnThreshold?: number;

  /** Override max rows for this print (0 = unlimited) */
  maxRows?: number;

  /**
   * Print in an isolated window (default: false)
   *
   * When true, opens a new window containing only the grid and prints that,
   * excluding any other page content. Useful when:
   * - The page has complex layouts that interfere with print
   * - You want to print only the grid without surrounding UI
   * - The grid is embedded in an application with navigation, sidebars, etc.
   */
  isolate?: boolean;
}

/** Detail for print-start event */
export interface PrintStartDetail {
  /** Total rows being printed */
  rowCount: number;

  /** Whether row limit was applied */
  limitApplied: boolean;

  /** Original row count before limit */
  originalRowCount: number;
}

/** Detail for print-complete event */
export interface PrintCompleteDetail {
  /**
   * Whether the print operation completed without errors.
   *
   * Note: This does NOT indicate whether the user clicked "Print" or "Cancel"
   * in the browser dialog - browsers don't expose that information.
   * This only indicates whether the plugin successfully prepared and
   * opened the print dialog.
   */
  success: boolean;

  /** Total rows that were prepared for printing */
  rowCount: number;

  /** Time in milliseconds from print-start to dialog close */
  duration: number;
}
