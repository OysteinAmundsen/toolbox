/**
 * Column Virtualization Plugin Types
 *
 * Type definitions for horizontal column virtualization feature.
 */

/** Configuration options for the column virtualization plugin */
export interface ColumnVirtualizationConfig {
  /** Auto-enable when column count exceeds threshold (default: true) */
  autoEnable?: boolean;
  /** Column count threshold for auto-enabling (default: 30) */
  threshold?: number;
  /** Extra columns to render on each side for smooth scrolling (default: 3) */
  overscan?: number;
}

/** Internal state managed by the column virtualization plugin */
export interface ColumnVirtualizationState {
  /** Whether virtualization is currently active */
  isVirtualized: boolean;
  /** Index of first visible column */
  startCol: number;
  /** Index of last visible column */
  endCol: number;
  /** Current horizontal scroll position */
  scrollLeft: number;
  /** Total width of all columns */
  totalWidth: number;
  /** Array of individual column widths (px) */
  columnWidths: number[];
  /** Array of column left offsets (px) */
  columnOffsets: number[];
}

/** Viewport information for visible columns */
export interface ColumnVirtualizationViewport {
  /** Index of first visible column */
  startCol: number;
  /** Index of last visible column */
  endCol: number;
  /** Array of visible column indices */
  visibleColumns: number[];
}
