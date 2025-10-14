import { describe, it, expect } from 'vitest';
import {
  normalizeRange,
  isCellInRange,
  isCellInAnyRange,
  getCellsInRange,
  getAllCellsInRanges,
  createRangeFromAnchor,
  mergeRanges,
  getRangeCellCount,
  rangesEqual,
  isSingleCell,
} from './range-selection';
import type { CellRange } from './types';

describe('range-selection', () => {
  describe('normalizeRange', () => {
    it('should return same range when already normalized', () => {
      const range: CellRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 3 };
      const result = normalizeRange(range);
      expect(result).toEqual({ startRow: 0, startCol: 0, endRow: 2, endCol: 3 });
    });

    it('should normalize inverted row coordinates', () => {
      const range: CellRange = { startRow: 5, startCol: 0, endRow: 2, endCol: 3 };
      const result = normalizeRange(range);
      expect(result).toEqual({ startRow: 2, startCol: 0, endRow: 5, endCol: 3 });
    });

    it('should normalize inverted column coordinates', () => {
      const range: CellRange = { startRow: 0, startCol: 5, endRow: 2, endCol: 1 };
      const result = normalizeRange(range);
      expect(result).toEqual({ startRow: 0, startCol: 1, endRow: 2, endCol: 5 });
    });

    it('should normalize both inverted row and column coordinates', () => {
      const range: CellRange = { startRow: 5, startCol: 5, endRow: 2, endCol: 1 };
      const result = normalizeRange(range);
      expect(result).toEqual({ startRow: 2, startCol: 1, endRow: 5, endCol: 5 });
    });

    it('should handle single cell range', () => {
      const range: CellRange = { startRow: 3, startCol: 2, endRow: 3, endCol: 2 };
      const result = normalizeRange(range);
      expect(result).toEqual({ startRow: 3, startCol: 2, endRow: 3, endCol: 2 });
    });
  });

  describe('isCellInRange', () => {
    const range: CellRange = { startRow: 1, startCol: 2, endRow: 4, endCol: 5 };

    it('should return true for cell inside range', () => {
      expect(isCellInRange(2, 3, range)).toBe(true);
      expect(isCellInRange(3, 4, range)).toBe(true);
    });

    it('should return true for cells on range boundaries', () => {
      // Corners
      expect(isCellInRange(1, 2, range)).toBe(true); // top-left
      expect(isCellInRange(1, 5, range)).toBe(true); // top-right
      expect(isCellInRange(4, 2, range)).toBe(true); // bottom-left
      expect(isCellInRange(4, 5, range)).toBe(true); // bottom-right

      // Edges
      expect(isCellInRange(1, 3, range)).toBe(true); // top edge
      expect(isCellInRange(4, 3, range)).toBe(true); // bottom edge
      expect(isCellInRange(2, 2, range)).toBe(true); // left edge
      expect(isCellInRange(2, 5, range)).toBe(true); // right edge
    });

    it('should return false for cells outside range', () => {
      expect(isCellInRange(0, 3, range)).toBe(false); // above
      expect(isCellInRange(5, 3, range)).toBe(false); // below
      expect(isCellInRange(2, 1, range)).toBe(false); // left
      expect(isCellInRange(2, 6, range)).toBe(false); // right
      expect(isCellInRange(0, 0, range)).toBe(false); // diagonal outside
    });

    it('should handle inverted range coordinates', () => {
      const invertedRange: CellRange = { startRow: 4, startCol: 5, endRow: 1, endCol: 2 };
      expect(isCellInRange(2, 3, invertedRange)).toBe(true);
      expect(isCellInRange(0, 0, invertedRange)).toBe(false);
    });
  });

  describe('isCellInAnyRange', () => {
    const ranges: CellRange[] = [
      { startRow: 0, startCol: 0, endRow: 1, endCol: 1 },
      { startRow: 3, startCol: 3, endRow: 4, endCol: 4 },
    ];

    it('should return true for cell in first range', () => {
      expect(isCellInAnyRange(0, 0, ranges)).toBe(true);
      expect(isCellInAnyRange(1, 1, ranges)).toBe(true);
    });

    it('should return true for cell in second range', () => {
      expect(isCellInAnyRange(3, 3, ranges)).toBe(true);
      expect(isCellInAnyRange(4, 4, ranges)).toBe(true);
    });

    it('should return false for cell not in any range', () => {
      expect(isCellInAnyRange(2, 2, ranges)).toBe(false);
      expect(isCellInAnyRange(5, 5, ranges)).toBe(false);
    });

    it('should return false for empty ranges array', () => {
      expect(isCellInAnyRange(0, 0, [])).toBe(false);
    });
  });

  describe('getCellsInRange', () => {
    it('should return all cells in a range', () => {
      const range: CellRange = { startRow: 0, startCol: 0, endRow: 1, endCol: 2 };
      const cells = getCellsInRange(range);

      expect(cells).toHaveLength(6); // 2 rows * 3 cols
      expect(cells).toContainEqual({ row: 0, col: 0 });
      expect(cells).toContainEqual({ row: 0, col: 1 });
      expect(cells).toContainEqual({ row: 0, col: 2 });
      expect(cells).toContainEqual({ row: 1, col: 0 });
      expect(cells).toContainEqual({ row: 1, col: 1 });
      expect(cells).toContainEqual({ row: 1, col: 2 });
    });

    it('should return single cell for 1x1 range', () => {
      const range: CellRange = { startRow: 3, startCol: 2, endRow: 3, endCol: 2 };
      const cells = getCellsInRange(range);

      expect(cells).toHaveLength(1);
      expect(cells[0]).toEqual({ row: 3, col: 2 });
    });

    it('should handle inverted coordinates', () => {
      const range: CellRange = { startRow: 1, startCol: 2, endRow: 0, endCol: 0 };
      const cells = getCellsInRange(range);

      expect(cells).toHaveLength(6); // 2 rows * 3 cols
    });

    it('should return cells in row-major order', () => {
      const range: CellRange = { startRow: 0, startCol: 0, endRow: 1, endCol: 1 };
      const cells = getCellsInRange(range);

      expect(cells[0]).toEqual({ row: 0, col: 0 });
      expect(cells[1]).toEqual({ row: 0, col: 1 });
      expect(cells[2]).toEqual({ row: 1, col: 0 });
      expect(cells[3]).toEqual({ row: 1, col: 1 });
    });
  });

  describe('getAllCellsInRanges', () => {
    it('should return all cells from multiple non-overlapping ranges', () => {
      const ranges: CellRange[] = [
        { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        { startRow: 2, startCol: 2, endRow: 2, endCol: 2 },
      ];
      const cells = getAllCellsInRanges(ranges);

      expect(cells).toHaveLength(2);
      expect(cells).toContainEqual({ row: 0, col: 0 });
      expect(cells).toContainEqual({ row: 2, col: 2 });
    });

    it('should deduplicate overlapping cells', () => {
      const ranges: CellRange[] = [
        { startRow: 0, startCol: 0, endRow: 1, endCol: 1 },
        { startRow: 1, startCol: 1, endRow: 2, endCol: 2 },
      ];
      const cells = getAllCellsInRanges(ranges);

      // First range: (0,0), (0,1), (1,0), (1,1) = 4 cells
      // Second range: (1,1), (1,2), (2,1), (2,2) = 4 cells
      // Overlap at (1,1), so total unique = 7
      expect(cells).toHaveLength(7);
    });

    it('should return empty array for no ranges', () => {
      const cells = getAllCellsInRanges([]);
      expect(cells).toHaveLength(0);
    });
  });

  describe('createRangeFromAnchor', () => {
    it('should create range from anchor to current (down-right)', () => {
      const anchor = { row: 1, col: 1 };
      const current = { row: 3, col: 4 };
      const range = createRangeFromAnchor(anchor, current);

      expect(range).toEqual({
        startRow: 1,
        startCol: 1,
        endRow: 3,
        endCol: 4,
      });
    });

    it('should create range from anchor to current (up-left)', () => {
      const anchor = { row: 5, col: 5 };
      const current = { row: 2, col: 1 };
      const range = createRangeFromAnchor(anchor, current);

      // Should preserve direction (not normalized)
      expect(range).toEqual({
        startRow: 5,
        startCol: 5,
        endRow: 2,
        endCol: 1,
      });
    });

    it('should create single cell range when anchor equals current', () => {
      const anchor = { row: 3, col: 2 };
      const current = { row: 3, col: 2 };
      const range = createRangeFromAnchor(anchor, current);

      expect(range).toEqual({
        startRow: 3,
        startCol: 2,
        endRow: 3,
        endCol: 2,
      });
    });
  });

  describe('mergeRanges', () => {
    it('should return ranges as-is (simple implementation)', () => {
      const ranges: CellRange[] = [
        { startRow: 0, startCol: 0, endRow: 1, endCol: 1 },
        { startRow: 2, startCol: 2, endRow: 3, endCol: 3 },
      ];
      const result = mergeRanges(ranges);

      expect(result).toEqual(ranges);
    });
  });

  describe('getRangeCellCount', () => {
    it('should return 1 for single cell range', () => {
      const range: CellRange = { startRow: 0, startCol: 0, endRow: 0, endCol: 0 };
      expect(getRangeCellCount(range)).toBe(1);
    });

    it('should calculate correct count for rectangular range', () => {
      const range: CellRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 3 };
      // 3 rows * 4 cols = 12
      expect(getRangeCellCount(range)).toBe(12);
    });

    it('should handle inverted coordinates', () => {
      const range: CellRange = { startRow: 2, startCol: 3, endRow: 0, endCol: 0 };
      expect(getRangeCellCount(range)).toBe(12);
    });
  });

  describe('rangesEqual', () => {
    it('should return true for identical ranges', () => {
      const a: CellRange = { startRow: 1, startCol: 2, endRow: 3, endCol: 4 };
      const b: CellRange = { startRow: 1, startCol: 2, endRow: 3, endCol: 4 };
      expect(rangesEqual(a, b)).toBe(true);
    });

    it('should return true for equivalent inverted ranges', () => {
      const a: CellRange = { startRow: 1, startCol: 2, endRow: 3, endCol: 4 };
      const b: CellRange = { startRow: 3, startCol: 4, endRow: 1, endCol: 2 };
      expect(rangesEqual(a, b)).toBe(true);
    });

    it('should return false for different ranges', () => {
      const a: CellRange = { startRow: 1, startCol: 2, endRow: 3, endCol: 4 };
      const b: CellRange = { startRow: 0, startCol: 2, endRow: 3, endCol: 4 };
      expect(rangesEqual(a, b)).toBe(false);
    });
  });

  describe('isSingleCell', () => {
    it('should return true for 1x1 range', () => {
      const range: CellRange = { startRow: 5, startCol: 3, endRow: 5, endCol: 3 };
      expect(isSingleCell(range)).toBe(true);
    });

    it('should return false for multi-cell range', () => {
      const range: CellRange = { startRow: 0, startCol: 0, endRow: 1, endCol: 1 };
      expect(isSingleCell(range)).toBe(false);
    });

    it('should handle inverted single cell coordinates', () => {
      const range: CellRange = { startRow: 5, startCol: 3, endRow: 5, endCol: 3 };
      expect(isSingleCell(range)).toBe(true);
    });
  });
});
