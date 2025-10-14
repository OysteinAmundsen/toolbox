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

/**
 * Compute the range of rows that are fully or partially visible in the viewport.
 * This is the range without overscan - just what the user can actually see.
 *
 * @param scrollTop - Current scroll position
 * @param viewportHeight - Height of the viewport
 * @param rowHeight - Height of each row
 * @param totalRows - Total number of rows
 * @returns Object with first and last visible row indices
 */
export function getVisibleRowRange(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  totalRows: number
): { first: number; last: number } {
  const first = Math.floor(scrollTop / rowHeight);
  let last = Math.ceil((scrollTop + viewportHeight) / rowHeight) - 1;
  if (last >= totalRows) last = totalRows - 1;
  if (first > last) return { first: 0, last: 0 };
  return { first, last };
}

/**
 * Check if a row is currently rendered in the virtual window.
 *
 * @param rowIndex - Row index to check
 * @param windowStart - Start of the render window
 * @param windowEnd - End of the render window
 * @returns True if the row is rendered
 */
export function isRowRendered(rowIndex: number, windowStart: number, windowEnd: number): boolean {
  return rowIndex >= windowStart && rowIndex < windowEnd;
}

/**
 * Clamp a row index to valid bounds.
 *
 * @param rowIndex - Row index to clamp
 * @param totalRows - Total number of rows
 * @returns Clamped row index (0 to totalRows - 1)
 */
export function clampRowIndex(rowIndex: number, totalRows: number): number {
  if (totalRows === 0) return 0;
  if (rowIndex < 0) return 0;
  if (rowIndex >= totalRows) return totalRows - 1;
  return rowIndex;
}

/**
 * Compute the scroll position needed to bring a row into view.
 *
 * @param rowIndex - Row index to scroll to
 * @param rowHeight - Height of each row
 * @param viewportHeight - Height of the viewport
 * @param currentScrollTop - Current scroll position
 * @returns New scroll position, or null if row is already visible
 */
export function computeScrollToRow(
  rowIndex: number,
  rowHeight: number,
  viewportHeight: number,
  currentScrollTop: number
): number | null {
  const rowTop = rowIndex * rowHeight;
  const rowBottom = rowTop + rowHeight;

  // Row is above viewport
  if (rowTop < currentScrollTop) {
    return rowTop;
  }

  // Row is below viewport
  if (rowBottom > currentScrollTop + viewportHeight) {
    return rowBottom - viewportHeight;
  }

  // Row is already visible
  return null;
}
