/**
 * Column Virtualization Core Logic
 *
 * Pure functions for horizontal column virtualization operations.
 */

import type { ColumnConfig } from '../../core/types';
import type { ColumnVirtualizationViewport } from './types';

/** Default column width when not specified */
const DEFAULT_COLUMN_WIDTH = 100;

/**
 * Parse a column width value to pixels.
 * Handles number (px) and string formats.
 *
 * @param width - The width value from column config
 * @returns Width in pixels
 */
export function parseColumnWidth(width: string | number | undefined): number {
  if (width === undefined || width === null) {
    return DEFAULT_COLUMN_WIDTH;
  }

  if (typeof width === 'number') {
    return width;
  }

  // Handle string values - extract numeric part
  const numeric = parseFloat(width);
  if (!isNaN(numeric)) {
    return numeric;
  }

  return DEFAULT_COLUMN_WIDTH;
}

/**
 * Get array of column widths in pixels.
 *
 * @param columns - Column configurations
 * @returns Array of widths in pixels
 */
export function getColumnWidths(columns: readonly ColumnConfig[]): number[] {
  return columns.map((col) => parseColumnWidth(col.width));
}

/**
 * Compute cumulative left offsets for each column.
 *
 * @param columns - Column configurations
 * @returns Array of left offsets in pixels
 */
export function computeColumnOffsets(columns: readonly ColumnConfig[]): number[] {
  const offsets: number[] = [];
  let offset = 0;

  for (const col of columns) {
    offsets.push(offset);
    offset += parseColumnWidth(col.width);
  }

  return offsets;
}

/**
 * Compute total width of all columns.
 *
 * @param columns - Column configurations
 * @returns Total width in pixels
 */
export function computeTotalWidth(columns: readonly ColumnConfig[]): number {
  return columns.reduce((sum, col) => sum + parseColumnWidth(col.width), 0);
}

/**
 * Find the visible column range based on scroll position.
 * Uses binary search for efficient lookup in large column sets.
 *
 * @param scrollLeft - Current horizontal scroll position
 * @param viewportWidth - Width of the visible viewport
 * @param columnOffsets - Array of column left offsets
 * @param columnWidths - Array of column widths
 * @param overscan - Number of extra columns to render on each side
 * @returns Viewport information with visible column indices
 */
export function getVisibleColumnRange(
  scrollLeft: number,
  viewportWidth: number,
  columnOffsets: number[],
  columnWidths: number[],
  overscan: number
): ColumnVirtualizationViewport {
  const columnCount = columnOffsets.length;

  if (columnCount === 0) {
    return { startCol: 0, endCol: 0, visibleColumns: [] };
  }

  // Binary search for first visible column
  let startCol = binarySearchFirstVisible(scrollLeft, columnOffsets, columnWidths);
  startCol = Math.max(0, startCol - overscan);

  // Find last visible column (without overscan first)
  const rightEdge = scrollLeft + viewportWidth;
  let endCol = startCol;

  for (let i = startCol; i < columnCount; i++) {
    if (columnOffsets[i] >= rightEdge) {
      endCol = i - 1;
      break;
    }
    endCol = i;
  }

  // Apply overscan to end (only once)
  endCol = Math.min(columnCount - 1, endCol + overscan);

  // Build array of visible column indices
  const visibleColumns: number[] = [];
  for (let i = startCol; i <= endCol; i++) {
    visibleColumns.push(i);
  }

  return { startCol, endCol, visibleColumns };
}

/**
 * Binary search to find the first column that is visible.
 *
 * @param scrollLeft - Current scroll position
 * @param columnOffsets - Array of column offsets
 * @param columnWidths - Array of column widths
 * @returns Index of first visible column
 */
function binarySearchFirstVisible(scrollLeft: number, columnOffsets: number[], columnWidths: number[]): number {
  let low = 0;
  let high = columnOffsets.length - 1;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const colRight = columnOffsets[mid] + columnWidths[mid];

    if (colRight <= scrollLeft) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

/**
 * Determine if column virtualization should be active.
 *
 * @param columnCount - Number of columns
 * @param threshold - Column count threshold
 * @param autoEnable - Whether auto-enable is configured
 * @returns True if virtualization should be active
 */
export function shouldVirtualize(columnCount: number, threshold: number, autoEnable: boolean): boolean {
  if (!autoEnable) return false;
  return columnCount > threshold;
}
