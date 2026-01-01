/**
 * Row Virtualization Core Logic
 *
 * Pure functions for vertical row virtualization operations.
 * Manages which rows are rendered based on scroll position and viewport size.
 */

/** Result of computing a virtual window */
export interface VirtualWindow {
  /** First row index to render (inclusive) */
  start: number;
  /** Last row index to render (exclusive) */
  end: number;
  /** Pixel offset to apply to the rows container (translateY) */
  offsetY: number;
  /** Total height of the scrollable content */
  totalHeight: number;
}

/** Parameters for computing the virtual window */
export interface VirtualWindowParams {
  /** Total number of rows */
  totalRows: number;
  /** Height of the viewport in pixels */
  viewportHeight: number;
  /** Current scroll top position */
  scrollTop: number;
  /** Height of each row in pixels */
  rowHeight: number;
  /** Number of extra rows to render above/below viewport */
  overscan: number;
  /** Previous scroll position for velocity calculation */
  prevScrollTop?: number;
}

/**
 * Compute the virtual row window based on scroll position and viewport.
 * Uses directional overscan - renders more rows in the scroll direction.
 *
 * @param params - Parameters for computing the window
 * @returns VirtualWindow with start/end indices and transforms
 */
export function computeVirtualWindow(params: VirtualWindowParams): VirtualWindow {
  const { totalRows, viewportHeight, scrollTop, rowHeight, overscan } = params;

  // Simple approach: render a large fixed window centered on current position
  // This is more predictable than velocity-based sizing
  const visibleRows = Math.ceil(viewportHeight / rowHeight);

  // Render overscan rows in each direction (total window = visible + 2*overscan)
  let start = Math.floor(scrollTop / rowHeight) - overscan;
  if (start < 0) start = 0;

  let end = start + visibleRows + overscan * 2;
  if (end > totalRows) end = totalRows;

  // Ensure start is adjusted if we hit the end
  if (end === totalRows && start > 0) {
    start = Math.max(0, end - visibleRows - overscan * 2);
  }

  return {
    start,
    end,
    offsetY: start * rowHeight,
    totalHeight: totalRows * rowHeight,
  };
}

/**
 * Determine if virtualization should be bypassed for small datasets.
 * When there are very few items, the overhead of virtualization isn't worth it.
 *
 * @param totalRows - Total number of items
 * @param threshold - Bypass threshold (skip virtualization if totalRows <= threshold)
 * @returns True if virtualization should be bypassed
 */
export function shouldBypassVirtualization(totalRows: number, threshold: number): boolean {
  return totalRows <= threshold;
}

/**
 * Compute the row index from a Y pixel position.
 *
 * @param y - Y position in pixels (relative to content top)
 * @param rowHeight - Height of each row
 * @returns Row index at that position
 */
export function getRowIndexFromY(y: number, rowHeight: number): number {
  return Math.floor(y / rowHeight);
}

/**
 * Compute the Y offset for a given row index.
 *
 * @param rowIndex - Row index
 * @param rowHeight - Height of each row
 * @returns Y position in pixels
 */
export function getRowOffsetY(rowIndex: number, rowHeight: number): number {
  return rowIndex * rowHeight;
}
