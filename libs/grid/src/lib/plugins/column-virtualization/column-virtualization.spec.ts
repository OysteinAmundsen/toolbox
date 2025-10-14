import { describe, it, expect } from 'vitest';
import {
  parseColumnWidth,
  getColumnWidths,
  computeColumnOffsets,
  computeTotalWidth,
  getVisibleColumnRange,
  shouldVirtualize,
} from './column-virtualization';
import type { ColumnConfig } from '../../core/types';

describe('columnVirtualization', () => {
  describe('parseColumnWidth', () => {
    it('should return default width for undefined', () => {
      expect(parseColumnWidth(undefined)).toBe(100);
    });

    it('should return default width for null', () => {
      expect(parseColumnWidth(null as unknown as undefined)).toBe(100);
    });

    it('should return numeric value directly', () => {
      expect(parseColumnWidth(150)).toBe(150);
      expect(parseColumnWidth(0)).toBe(0);
      expect(parseColumnWidth(50.5)).toBe(50.5);
    });

    it('should parse numeric strings', () => {
      expect(parseColumnWidth('200')).toBe(200);
      expect(parseColumnWidth('150px')).toBe(150);
      expect(parseColumnWidth('75.5')).toBe(75.5);
    });

    it('should return default for non-numeric strings', () => {
      expect(parseColumnWidth('auto')).toBe(100);
      expect(parseColumnWidth('')).toBe(100);
    });
  });

  describe('getColumnWidths', () => {
    it('should return empty array for no columns', () => {
      expect(getColumnWidths([])).toEqual([]);
    });

    it('should return array of widths', () => {
      const columns: ColumnConfig[] = [
        { field: 'a', width: 100 },
        { field: 'b', width: 150 },
        { field: 'c', width: 200 },
      ];
      expect(getColumnWidths(columns)).toEqual([100, 150, 200]);
    });

    it('should use default width when not specified', () => {
      const columns: ColumnConfig[] = [{ field: 'a' }, { field: 'b', width: 150 }, { field: 'c' }];
      expect(getColumnWidths(columns)).toEqual([100, 150, 100]);
    });

    it('should handle string widths', () => {
      const columns: ColumnConfig[] = [
        { field: 'a', width: '120' },
        { field: 'b', width: '80px' },
      ];
      expect(getColumnWidths(columns)).toEqual([120, 80]);
    });
  });

  describe('computeColumnOffsets', () => {
    it('should return empty array for no columns', () => {
      expect(computeColumnOffsets([])).toEqual([]);
    });

    it('should compute cumulative offsets', () => {
      const columns: ColumnConfig[] = [
        { field: 'a', width: 100 },
        { field: 'b', width: 150 },
        { field: 'c', width: 200 },
      ];
      expect(computeColumnOffsets(columns)).toEqual([0, 100, 250]);
    });

    it('should use default width in offset calculation', () => {
      const columns: ColumnConfig[] = [
        { field: 'a' }, // default 100
        { field: 'b', width: 50 },
        { field: 'c' }, // default 100
      ];
      expect(computeColumnOffsets(columns)).toEqual([0, 100, 150]);
    });

    it('should handle single column', () => {
      const columns: ColumnConfig[] = [{ field: 'a', width: 120 }];
      expect(computeColumnOffsets(columns)).toEqual([0]);
    });
  });

  describe('computeTotalWidth', () => {
    it('should return 0 for no columns', () => {
      expect(computeTotalWidth([])).toBe(0);
    });

    it('should sum all column widths', () => {
      const columns: ColumnConfig[] = [
        { field: 'a', width: 100 },
        { field: 'b', width: 150 },
        { field: 'c', width: 200 },
      ];
      expect(computeTotalWidth(columns)).toBe(450);
    });

    it('should include default widths in sum', () => {
      const columns: ColumnConfig[] = [
        { field: 'a' }, // 100
        { field: 'b', width: 50 },
        { field: 'c' }, // 100
      ];
      expect(computeTotalWidth(columns)).toBe(250);
    });
  });

  describe('getVisibleColumnRange', () => {
    const offsets = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900];
    const widths = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100];

    it('should return empty for no columns', () => {
      const result = getVisibleColumnRange(0, 400, [], [], 2);
      expect(result).toEqual({ startCol: 0, endCol: 0, visibleColumns: [] });
    });

    it('should return all columns when viewport is wider than total', () => {
      const result = getVisibleColumnRange(0, 2000, offsets, widths, 0);
      expect(result.startCol).toBe(0);
      expect(result.endCol).toBe(9);
      expect(result.visibleColumns).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('should return first columns when scrolled to start', () => {
      const result = getVisibleColumnRange(0, 350, offsets, widths, 0);
      expect(result.startCol).toBe(0);
      expect(result.endCol).toBe(3);
      expect(result.visibleColumns).toEqual([0, 1, 2, 3]);
    });

    it('should return middle columns when scrolled to middle', () => {
      const result = getVisibleColumnRange(300, 350, offsets, widths, 0);
      expect(result.startCol).toBe(3);
      expect(result.endCol).toBe(6);
      expect(result.visibleColumns).toEqual([3, 4, 5, 6]);
    });

    it('should return last columns when scrolled to end', () => {
      const result = getVisibleColumnRange(600, 400, offsets, widths, 0);
      expect(result.startCol).toBe(6);
      expect(result.endCol).toBe(9);
      expect(result.visibleColumns).toEqual([6, 7, 8, 9]);
    });

    it('should include overscan columns', () => {
      const result = getVisibleColumnRange(300, 200, offsets, widths, 2);
      // Without overscan: cols 3-4 visible (300-500)
      // With overscan of 2: start = max(0, 3-2) = 1, end = min(9, 4+2) = 6
      expect(result.startCol).toBe(1);
      expect(result.endCol).toBe(6);
      expect(result.visibleColumns).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('should clamp overscan at start boundary', () => {
      const result = getVisibleColumnRange(0, 200, offsets, widths, 5);
      expect(result.startCol).toBe(0);
      expect(result.visibleColumns[0]).toBe(0);
    });

    it('should clamp overscan at end boundary', () => {
      const result = getVisibleColumnRange(700, 400, offsets, widths, 5);
      expect(result.endCol).toBe(9);
      expect(result.visibleColumns[result.visibleColumns.length - 1]).toBe(9);
    });

    it('should handle single column', () => {
      const result = getVisibleColumnRange(0, 200, [0], [100], 2);
      expect(result).toEqual({ startCol: 0, endCol: 0, visibleColumns: [0] });
    });

    it('should handle variable column widths', () => {
      const varOffsets = [0, 50, 200, 250, 400];
      const varWidths = [50, 150, 50, 150, 100];
      // Viewport: 100-300, should see columns 1 (50-200) and 2 (200-250)
      const result = getVisibleColumnRange(100, 200, varOffsets, varWidths, 0);
      expect(result.visibleColumns).toContain(1);
      expect(result.visibleColumns).toContain(2);
    });
  });

  describe('shouldVirtualize', () => {
    it('should return false when autoEnable is false', () => {
      expect(shouldVirtualize(50, 30, false)).toBe(false);
      expect(shouldVirtualize(100, 30, false)).toBe(false);
    });

    it('should return false when below threshold', () => {
      expect(shouldVirtualize(20, 30, true)).toBe(false);
      expect(shouldVirtualize(30, 30, true)).toBe(false);
    });

    it('should return true when above threshold', () => {
      expect(shouldVirtualize(31, 30, true)).toBe(true);
      expect(shouldVirtualize(100, 30, true)).toBe(true);
    });

    it('should respect custom threshold', () => {
      expect(shouldVirtualize(15, 10, true)).toBe(true);
      expect(shouldVirtualize(45, 50, true)).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(shouldVirtualize(0, 30, true)).toBe(false);
      expect(shouldVirtualize(1, 0, true)).toBe(true);
    });
  });
});
