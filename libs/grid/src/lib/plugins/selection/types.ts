/**
 * Selection Plugin Types
 *
 * Type definitions for the selection feature.
 */

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
 * Selection trigger type.
 *
 * Controls whether selection is activated on single-click or double-click:
 *
 * | Trigger | Single Click | Double Click |
 * |---------|--------------|--------------|
 * | `'click'` (default) | Selects cell/row | No additional action |
 * | `'dblclick'` | Focuses only | Selects cell/row |
 *
 * Use `'dblclick'` in data-entry grids where navigation should not
 * accidentally change the selection state.
 *
 * @example
 * ```ts
 * // Double-click to select (single-click only focuses)
 * new SelectionPlugin({ mode: 'row', triggerOn: 'dblclick' })
 * ```
 */
export type SelectionTrigger = 'click' | 'dblclick';

/** Configuration options for the selection plugin */
export interface SelectionConfig {
  /** Selection mode (default: 'cell') */
  mode: SelectionMode;

  /**
   * Selection trigger type.
   *
   * - `'click'` (default): Single-click selects cells/rows
   * - `'dblclick'`: Single-click only focuses, double-click selects
   *
   * **Note:** Only applies to `'cell'` and `'row'` modes. Range mode uses
   * drag selection (mousedown → mousemove), which is unaffected by this setting.
   *
   * @default 'click'
   */
  triggerOn?: SelectionTrigger;
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
