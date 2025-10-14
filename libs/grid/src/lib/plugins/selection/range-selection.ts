/**
 * Cell Range Selection Core Logic
 *
 * Pure functions for cell range selection operations.
 */

import type { InternalCellRange, CellRange } from './types';

/**
 * Normalize a range so startRow/startCol are always <= endRow/endCol.
 * This handles cases where user drags from bottom-right to top-left.
 *
 * @param range - The range to normalize
 * @returns Normalized range with start <= end for both dimensions
 */
export function normalizeRange(range: InternalCellRange): InternalCellRange {
  return {
    startRow: Math.min(range.startRow, range.endRow),
    startCol: Math.min(range.startCol, range.endCol),
    endRow: Math.max(range.startRow, range.endRow),
    endCol: Math.max(range.startCol, range.endCol),
  };
}

/**
 * Convert an internal range to the public event format.
 *
 * @param range - The internal range to convert
 * @returns Public CellRange format with from/to coordinates
 */
export function toPublicRange(range: InternalCellRange): CellRange {
  const normalized = normalizeRange(range);
  return {
    from: { row: normalized.startRow, col: normalized.startCol },
    to: { row: normalized.endRow, col: normalized.endCol },
  };
}

/**
 * Convert multiple internal ranges to public format.
 *
 * @param ranges - Array of internal ranges
 * @returns Array of public CellRange format
 */
export function toPublicRanges(ranges: InternalCellRange[]): CellRange[] {
  return ranges.map(toPublicRange);
}

/**
 * Check if a cell is within a specific range.
 *
 * @param row - The row index to check
 * @param col - The column index to check
 * @param range - The range to check against
 * @returns True if the cell is within the range
 */
export function isCellInRange(row: number, col: number, range: InternalCellRange): boolean {
  const normalized = normalizeRange(range);
  return (
    row >= normalized.startRow && row <= normalized.endRow && col >= normalized.startCol && col <= normalized.endCol
  );
}

/**
 * Check if a cell is within any of the provided ranges.
 *
 * @param row - The row index to check
 * @param col - The column index to check
 * @param ranges - Array of ranges to check against
 * @returns True if the cell is within any range
 */
export function isCellInAnyRange(row: number, col: number, ranges: InternalCellRange[]): boolean {
  return ranges.some((range) => isCellInRange(row, col, range));
}

/**
 * Get all cells within a range as an array of {row, col} objects.
 *
 * @param range - The range to enumerate
 * @returns Array of all cell coordinates in the range
 */
export function getCellsInRange(range: InternalCellRange): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];
  const normalized = normalizeRange(range);

  for (let row = normalized.startRow; row <= normalized.endRow; row++) {
    for (let col = normalized.startCol; col <= normalized.endCol; col++) {
      cells.push({ row, col });
    }
  }

  return cells;
}

/**
 * Get all unique cells across multiple ranges.
 * Deduplicates cells that appear in overlapping ranges.
 *
 * @param ranges - Array of ranges to enumerate
 * @returns Array of unique cell coordinates
 */
export function getAllCellsInRanges(ranges: InternalCellRange[]): Array<{ row: number; col: number }> {
  const cellMap = new Map<string, { row: number; col: number }>();

  for (const range of ranges) {
    for (const cell of getCellsInRange(range)) {
      cellMap.set(`${cell.row},${cell.col}`, cell);
    }
  }

  return [...cellMap.values()];
}

/**
 * Merge overlapping or adjacent ranges into fewer ranges.
 * Simple implementation - returns ranges as-is for now.
 * More complex merging logic can be added later for optimization.
 *
 * @param ranges - Array of ranges to merge
 * @returns Merged array of ranges
 */
export function mergeRanges(ranges: InternalCellRange[]): InternalCellRange[] {
  // Simple implementation - more complex merging can be added later
  return ranges;
}

/**
 * Create a range from an anchor cell to a current cell position.
 * The range is not normalized - it preserves the direction of selection.
 *
 * @param anchor - The anchor cell (where selection started)
 * @param current - The current cell (where selection ends)
 * @returns An InternalCellRange from anchor to current
 */
export function createRangeFromAnchor(
  anchor: { row: number; col: number },
  current: { row: number; col: number }
): InternalCellRange {
  return {
    startRow: anchor.row,
    startCol: anchor.col,
    endRow: current.row,
    endCol: current.col,
  };
}

/**
 * Calculate the number of cells in a range.
 *
 * @param range - The range to measure
 * @returns Total number of cells in the range
 */
export function getRangeCellCount(range: InternalCellRange): number {
  const normalized = normalizeRange(range);
  const rowCount = normalized.endRow - normalized.startRow + 1;
  const colCount = normalized.endCol - normalized.startCol + 1;
  return rowCount * colCount;
}

/**
 * Check if two ranges are equal (same boundaries).
 *
 * @param a - First range
 * @param b - Second range
 * @returns True if ranges have same boundaries after normalization
 */
export function rangesEqual(a: InternalCellRange, b: InternalCellRange): boolean {
  const normA = normalizeRange(a);
  const normB = normalizeRange(b);
  return (
    normA.startRow === normB.startRow &&
    normA.startCol === normB.startCol &&
    normA.endRow === normB.endRow &&
    normA.endCol === normB.endCol
  );
}

/**
 * Check if a range is a single cell (1x1).
 *
 * @param range - The range to check
 * @returns True if the range is exactly one cell
 */
export function isSingleCell(range: InternalCellRange): boolean {
  const normalized = normalizeRange(range);
  return normalized.startRow === normalized.endRow && normalized.startCol === normalized.endCol;
}
