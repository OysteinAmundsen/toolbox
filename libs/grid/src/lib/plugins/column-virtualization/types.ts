/**
 * Column Virtualization Plugin Types
 *
 * Type definitions for horizontal column virtualization feature.
 */

/**
 * Configuration for horizontal (column) virtualization.
 *
 * When enabled, only the columns visible in the viewport (plus an overscan buffer)
 * are rendered to the DOM. This dramatically improves performance for grids with
 * many columns (50+), as only a small subset of column cells exist at any time.
 *
 * By default, virtualization auto-enables when the column count exceeds `threshold`.
 * Set `autoEnable: false` to control activation manually.
 *
 * @example
 * ```typescript
 * new ColumnVirtualizationPlugin({
 *   threshold: 20,   // activate earlier than default
 *   overscan: 5,     // render 5 extra columns on each side
 * })
 * ```
 * @since 0.1.1
 */
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

/**
 * Describes the currently visible column range.
 *
 * Returned by viewport queries; used internally to determine which column
 * cells to render and which to skip during horizontal scroll updates.
 */
export interface ColumnVirtualizationViewport {
  /** Index of first visible column */
  startCol: number;
  /** Index of last visible column */
  endCol: number;
  /** Array of visible column indices */
  visibleColumns: number[];
}

// Module Augmentation - Register plugin name for type-safe getPluginByName()
declare module '../../core/types' {
  interface PluginNameMap {
    columnVirtualization: import('./ColumnVirtualizationPlugin').ColumnVirtualizationPlugin;
  }
}
