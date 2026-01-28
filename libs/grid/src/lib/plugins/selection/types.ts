/**
 * Selection Plugin Types
 *
 * Type definitions for the selection feature.
 */

import type { ColumnConfig } from '../../core/types';

// #region Module Augmentation
// When this plugin is imported, GridConfig is augmented with selection-specific properties
declare module '../../core/types' {
  interface GridConfig {
    /**
     * Grid-wide selection toggle. Requires `SelectionPlugin` to be loaded.
     *
     * When `false`, disables all selection interactions while keeping the plugin loaded.
     * When `true` (default), selection works according to the plugin's mode configuration.
     *
     * This affects:
     * - Click/drag selection
     * - Keyboard selection (arrows, Shift+arrows, Ctrl+A)
     * - Checkbox column clicks (if enabled)
     *
     * @default true
     *
     * @example
     * ```typescript
     * // Disable all selection at runtime
     * grid.gridConfig = { ...grid.gridConfig, selectable: false };
     *
     * // Re-enable selection
     * grid.gridConfig = { ...grid.gridConfig, selectable: true };
     * ```
     */
    selectable?: boolean;
  }
}
// #endregion

/**
 * Selection mode for the grid.
 *
 * Each mode offers different selection behavior suited to different use cases:
 *
 * | Mode | Use Case | Behavior |
 * |------|----------|----------|
 * | `'cell'` | Spreadsheet-style editing | Single cell focus. Click to select one cell at a time. |
 * | `'row'` | Record-based operations | Full row selection. Click anywhere to select the entire row. |
 * | `'range'` | Bulk operations, export | Rectangular selection. Drag or Shift+Click to select ranges. |
 *
 * @example
 * ```ts
 * // Cell mode (default) - for spreadsheet-like interaction
 * new SelectionPlugin({ mode: 'cell' })
 *
 * // Row mode - for selecting complete records
 * new SelectionPlugin({ mode: 'row' })
 *
 * // Range mode - for bulk copy/paste operations
 * new SelectionPlugin({ mode: 'range' })
 * ```
 *
 * @see [Cell Mode Demo](?path=/story/grid-plugins-selection--default) - Click cells to select
 * @see [Row Mode Demo](?path=/story/grid-plugins-selection--row-mode) - Full row selection
 * @see [Range Mode Demo](?path=/story/grid-plugins-selection--range-mode) - Drag to select ranges
 */
export type SelectionMode = 'cell' | 'row' | 'range';

/**
 * Mouse event type that triggers selection.
 *
 * - `'click'` - Single click activates selection (default)
 * - `'dblclick'` - Double-click activates selection; single-click only focuses
 *
 * **Note:** Only applies to `'cell'` and `'row'` modes. Range mode uses drag
 * selection (mousedown → mousemove) which is unaffected by this option.
 *
 * @example
 * ```ts
 * // Double-click to select - useful for data entry grids
 * new SelectionPlugin({ mode: 'cell', triggerOn: 'dblclick' })
 * ```
 */
export type SelectionTrigger = 'click' | 'dblclick';

/**
 * Callback that determines whether a specific row or cell can be selected.
 *
 * Return `true` if the row/cell should be selectable, `false` otherwise.
 *
 * @param row - The row data object
 * @param rowIndex - The row index in the grid
 * @param column - The column config (provided in cell/range modes, undefined in row mode)
 * @param colIndex - The column index (provided in cell/range modes, undefined in row mode)
 *
 * @example
 * ```ts
 * // Prevent selection of locked rows
 * isSelectable: (row) => row.status !== 'locked'
 *
 * // Prevent selection of specific columns
 * isSelectable: (row, rowIndex, col) => col?.field !== 'id'
 *
 * // Permission-based selection
 * isSelectable: (row) => userPermissions.canSelect(row)
 * ```
 */
export type SelectableCallback<T = unknown> = (
  row: T,
  rowIndex: number,
  column?: ColumnConfig,
  colIndex?: number,
) => boolean;

/** Configuration options for the selection plugin */
export interface SelectionConfig<T = unknown> {
  /** Selection mode (default: 'cell') */
  mode: SelectionMode;

  /**
   * Whether selection is enabled (default: true).
   *
   * When `false`, disables all selection interactions while keeping the plugin loaded.
   * Useful for temporarily disabling selection without removing the plugin.
   *
   * @default true
   *
   * @example
   * ```ts
   * // Disable selection at runtime
   * new SelectionPlugin({ mode: 'row', enabled: false })
   *
   * // Toggle via gridConfig
   * grid.gridConfig = { ...grid.gridConfig, selectable: false };
   * ```
   */
  enabled?: boolean;

  /**
   * Mouse event type that triggers selection (default: 'click').
   *
   * - `'click'` - Single click activates selection
   * - `'dblclick'` - Double-click activates selection; single-click only focuses
   *
   * **Note:** Only applies to `'cell'` and `'row'` modes. Range mode uses drag
   * selection which is unaffected by this option.
   */
  triggerOn?: SelectionTrigger;

  /**
   * Callback that determines whether a specific row or cell can be selected.
   *
   * Non-selectable rows/cells:
   * - Don't respond to click/keyboard selection
   * - Are excluded from "select all" operations
   * - Have visual indicator (muted styling via `[data-selectable="false"]`)
   * - Remain focusable for navigation
   *
   * @example
   * ```ts
   * // Prevent selection of locked rows
   * new SelectionPlugin({
   *   mode: 'row',
   *   isSelectable: (row) => row.status !== 'locked',
   * })
   *
   * // Prevent selection of specific columns (cell/range mode)
   * new SelectionPlugin({
   *   mode: 'cell',
   *   isSelectable: (row, rowIndex, col) => col?.field !== 'id',
   * })
   * ```
   */
  isSelectable?: SelectableCallback<T>;
}

/** Internal state managed by the selection plugin */
export interface SelectionState {
  /** Set of selected row indices */
  selected: Set<number>;
  /** Last selected row index (for keyboard navigation) */
  lastSelected: number | null;
  /** Anchor row for shift+click range selection */
  anchor: number | null;
}

// #region Cell/Range Selection Types

/** Internal representation of a rectangular cell range */
export interface InternalCellRange {
  /** Starting row index */
  startRow: number;
  /** Starting column index */
  startCol: number;
  /** Ending row index */
  endRow: number;
  /** Ending column index */
  endCol: number;
}

/** Public representation of a cell range (for events) */
export interface CellRange {
  /** Starting cell coordinates */
  from: { row: number; col: number };
  /** Ending cell coordinates */
  to: { row: number; col: number };
}

/**
 * Unified event detail emitted when selection changes (all modes).
 * Provides a consistent structure for consumers to handle selection state.
 */
export interface SelectionChangeDetail {
  /** The selection mode that triggered this event */
  mode: SelectionMode;
  /** Selected cell ranges. For cell mode, contains a single-cell range. For row mode, contains full-row ranges. */
  ranges: CellRange[];
}

/**
 * Unified selection result returned by getSelection().
 * Provides a consistent interface regardless of selection mode.
 *
 * @example
 * ```ts
 * const selection = plugin.getSelection();
 * if (selection.ranges.length > 0) {
 *   const firstRange = selection.ranges[0];
 *   console.log(`Selected from (${firstRange.from.row}, ${firstRange.from.col}) to (${firstRange.to.row}, ${firstRange.to.col})`);
 * }
 * ```
 */
export interface SelectionResult {
  /** The current selection mode */
  mode: SelectionMode;
  /** All selected ranges. Empty if nothing is selected. */
  ranges: CellRange[];
  /** The anchor cell for range extension (Shift+click/arrow). Null if no anchor is set. */
  anchor: { row: number; col: number } | null;
}

/** Internal state for selection plugin */
export interface SelectionPluginState extends SelectionState {
  /** All selected cell ranges (for range mode) - uses internal format */
  ranges: InternalCellRange[];
  /** The currently active (most recent) range */
  activeRange: InternalCellRange | null;
  /** Anchor cell for range extension */
  cellAnchor: { row: number; col: number } | null;
  /** Whether a range drag is in progress */
  isDragging: boolean;
  /** Selected cell (for cell mode) */
  selectedCell: { row: number; col: number } | null;
}

// #endregion
