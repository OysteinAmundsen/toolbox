/**
 * Selection Plugin Types
 *
 * Type definitions for the selection feature.
 */

/**
 * Selection mode for the grid:
 * - 'cell': Single cell selection (default). No border, just focus highlight.
 * - 'row': Row selection. Clicking a cell selects the entire row. Uses focus outline color.
 * - 'range': Range selection. Shift+click or drag to select rectangular cell ranges. Uses success border color.
 */
export type SelectionMode = 'cell' | 'row' | 'range';

/** Configuration options for the selection plugin */
export interface SelectionConfig {
  /** Selection mode (default: 'cell') */
  mode: SelectionMode;
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

// ================= Cell/Range Selection Types =================

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
