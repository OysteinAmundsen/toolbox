import { describe, expect, it } from 'vitest';
import { computeVirtualWindow, getRowIndexFromY, getRowOffsetY, shouldBypassVirtualization } from './virtualization';

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
});
