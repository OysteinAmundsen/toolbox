import { describe, it, expect } from 'vitest';
import {
  computeVirtualWindow,
  shouldBypassVirtualization,
  getRowIndexFromY,
  getRowOffsetY,
  getVisibleRowRange,
  isRowRendered,
  clampRowIndex,
  computeScrollToRow,
} from './virtualization';

describe('virtualization', () => {
  describe('computeVirtualWindow', () => {
    it('computes window at top of grid', () => {
      const result = computeVirtualWindow({
        totalRows: 1000,
        viewportHeight: 300,
        scrollTop: 0,
        rowHeight: 32,
        overscan: 5,
      });

      expect(result.start).toBe(0);
      // 300/32 ≈ 9.375 → ceil = 10, plus 2*5 overscan = 20
      expect(result.end).toBe(20);
      expect(result.offsetY).toBe(0);
      expect(result.totalHeight).toBe(32000);
    });

    it('computes window when scrolled down', () => {
      const result = computeVirtualWindow({
        totalRows: 1000,
        viewportHeight: 300,
        scrollTop: 1600, // 50 rows down
        rowHeight: 32,
        overscan: 5,
      });

      // 1600/32 = 50, minus 5 overscan = 45
      expect(result.start).toBe(45);
      // 45 + 20 visible = 65
      expect(result.end).toBe(65);
      expect(result.offsetY).toBe(45 * 32);
    });

    it('clamps start to 0 when scroll near top', () => {
      const result = computeVirtualWindow({
        totalRows: 1000,
        viewportHeight: 300,
        scrollTop: 64, // 2 rows
        rowHeight: 32,
        overscan: 5,
      });

      expect(result.start).toBe(0); // Can't go negative
      expect(result.offsetY).toBe(0);
    });

    it('clamps end to totalRows', () => {
      const result = computeVirtualWindow({
        totalRows: 100,
        viewportHeight: 300,
        scrollTop: 3000, // Near end
        rowHeight: 32,
        overscan: 5,
      });

      expect(result.end).toBeLessThanOrEqual(100);
    });

    it('handles small datasets', () => {
      const result = computeVirtualWindow({
        totalRows: 5,
        viewportHeight: 300,
        scrollTop: 0,
        rowHeight: 32,
        overscan: 5,
      });

      expect(result.start).toBe(0);
      expect(result.end).toBe(5);
      expect(result.totalHeight).toBe(160);
    });

    it('handles empty dataset', () => {
      const result = computeVirtualWindow({
        totalRows: 0,
        viewportHeight: 300,
        scrollTop: 0,
        rowHeight: 32,
        overscan: 5,
      });

      expect(result.start).toBe(0);
      expect(result.end).toBe(0);
      expect(result.totalHeight).toBe(0);
    });
  });

  describe('shouldBypassVirtualization', () => {
    it('returns true when totalRows <= threshold', () => {
      expect(shouldBypassVirtualization(10, 24)).toBe(true);
      expect(shouldBypassVirtualization(24, 24)).toBe(true);
    });

    it('returns false when totalRows > threshold', () => {
      expect(shouldBypassVirtualization(25, 24)).toBe(false);
      expect(shouldBypassVirtualization(100, 24)).toBe(false);
    });

    it('works with different threshold values', () => {
      expect(shouldBypassVirtualization(50, 50)).toBe(true);
      expect(shouldBypassVirtualization(51, 50)).toBe(false);
    });
  });

  describe('getRowIndexFromY', () => {
    it('returns correct row index', () => {
      expect(getRowIndexFromY(0, 32)).toBe(0);
      expect(getRowIndexFromY(31, 32)).toBe(0);
      expect(getRowIndexFromY(32, 32)).toBe(1);
      expect(getRowIndexFromY(64, 32)).toBe(2);
      expect(getRowIndexFromY(100, 32)).toBe(3);
    });

    it('handles different row heights', () => {
      expect(getRowIndexFromY(0, 50)).toBe(0);
      expect(getRowIndexFromY(49, 50)).toBe(0);
      expect(getRowIndexFromY(50, 50)).toBe(1);
      expect(getRowIndexFromY(150, 50)).toBe(3);
    });
  });

  describe('getRowOffsetY', () => {
    it('returns correct offset', () => {
      expect(getRowOffsetY(0, 32)).toBe(0);
      expect(getRowOffsetY(1, 32)).toBe(32);
      expect(getRowOffsetY(10, 32)).toBe(320);
    });

    it('handles different row heights', () => {
      expect(getRowOffsetY(5, 50)).toBe(250);
    });
  });

  describe('getVisibleRowRange', () => {
    it('returns visible range at top', () => {
      const range = getVisibleRowRange(0, 300, 32, 1000);
      expect(range.first).toBe(0);
      expect(range.last).toBe(9); // ceil(300/32) - 1 = 9
    });

    it('returns visible range when scrolled', () => {
      const range = getVisibleRowRange(320, 300, 32, 1000);
      expect(range.first).toBe(10);
      expect(range.last).toBe(19);
    });

    it('clamps to totalRows', () => {
      const range = getVisibleRowRange(0, 1000, 32, 10);
      expect(range.first).toBe(0);
      expect(range.last).toBe(9);
    });

    it('handles empty dataset', () => {
      const range = getVisibleRowRange(0, 300, 32, 0);
      expect(range.first).toBe(0);
      expect(range.last).toBe(0);
    });
  });

  describe('isRowRendered', () => {
    it('returns true for rows in window', () => {
      expect(isRowRendered(10, 5, 20)).toBe(true);
      expect(isRowRendered(5, 5, 20)).toBe(true);
      expect(isRowRendered(19, 5, 20)).toBe(true);
    });

    it('returns false for rows outside window', () => {
      expect(isRowRendered(4, 5, 20)).toBe(false);
      expect(isRowRendered(20, 5, 20)).toBe(false);
      expect(isRowRendered(0, 5, 20)).toBe(false);
    });
  });

  describe('clampRowIndex', () => {
    it('clamps negative to 0', () => {
      expect(clampRowIndex(-1, 100)).toBe(0);
      expect(clampRowIndex(-100, 100)).toBe(0);
    });

    it('clamps above max to last row', () => {
      expect(clampRowIndex(100, 100)).toBe(99);
      expect(clampRowIndex(150, 100)).toBe(99);
    });

    it('returns valid index unchanged', () => {
      expect(clampRowIndex(50, 100)).toBe(50);
      expect(clampRowIndex(0, 100)).toBe(0);
      expect(clampRowIndex(99, 100)).toBe(99);
    });

    it('handles empty dataset', () => {
      expect(clampRowIndex(0, 0)).toBe(0);
      expect(clampRowIndex(5, 0)).toBe(0);
    });
  });

  describe('computeScrollToRow', () => {
    it('returns scroll position when row is above viewport', () => {
      // Row 5 is at y=160, viewport shows y=320-620
      const scroll = computeScrollToRow(5, 32, 300, 320);
      expect(scroll).toBe(160);
    });

    it('returns scroll position when row is below viewport', () => {
      // Row 20 ends at y=672, viewport shows y=0-300
      const scroll = computeScrollToRow(20, 32, 300, 0);
      expect(scroll).toBe(672 - 300); // 372
    });

    it('returns null when row is visible', () => {
      // Row 5 is at y=160-192, viewport shows y=100-400
      const scroll = computeScrollToRow(5, 32, 300, 100);
      expect(scroll).toBeNull();
    });

    it('handles edge case at top of viewport', () => {
      // Row at exactly the top of viewport
      const scroll = computeScrollToRow(10, 32, 300, 320);
      expect(scroll).toBeNull();
    });

    it('handles edge case at bottom of viewport', () => {
      // Row ends exactly at bottom of viewport
      const scroll = computeScrollToRow(0, 32, 300, 0);
      expect(scroll).toBeNull();
    });
  });
});
