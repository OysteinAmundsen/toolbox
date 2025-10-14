/**
 * Sticky Columns Plugin Unit Tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyStickyOffsets,
  calculateLeftStickyOffsets,
  calculateRightStickyOffsets,
  clearStickyOffsets,
  getColumnStickyPosition,
  getLeftStickyColumns,
  getRightStickyColumns,
  hasStickyColumns,
} from './pinned-columns';

describe('sticky-columns', () => {
  describe('hasStickyColumns', () => {
    it('returns false for empty columns', () => {
      expect(hasStickyColumns([])).toBe(false);
    });

    it('returns false when no sticky columns', () => {
      const cols = [{ field: 'a' }, { field: 'b' }];
      expect(hasStickyColumns(cols)).toBe(false);
    });

    it('returns true for left sticky column', () => {
      const cols = [{ field: 'a', sticky: 'left' }, { field: 'b' }];
      expect(hasStickyColumns(cols)).toBe(true);
    });

    it('returns true for right sticky column', () => {
      const cols = [{ field: 'a' }, { field: 'b', sticky: 'right' }];
      expect(hasStickyColumns(cols)).toBe(true);
    });

    it('returns true for both left and right sticky', () => {
      const cols = [{ field: 'a', sticky: 'left' }, { field: 'b' }, { field: 'c', sticky: 'right' }];
      expect(hasStickyColumns(cols)).toBe(true);
    });
  });

  describe('getLeftStickyColumns', () => {
    it('returns empty array for no sticky columns', () => {
      const cols = [{ field: 'a' }, { field: 'b' }];
      expect(getLeftStickyColumns(cols)).toEqual([]);
    });

    it('returns only left sticky columns', () => {
      const cols = [
        { field: 'a', sticky: 'left' },
        { field: 'b' },
        { field: 'c', sticky: 'right' },
        { field: 'd', sticky: 'left' },
      ];
      const result = getLeftStickyColumns(cols);
      expect(result).toHaveLength(2);
      expect(result[0].field).toBe('a');
      expect(result[1].field).toBe('d');
    });
  });

  describe('getRightStickyColumns', () => {
    it('returns empty array for no sticky columns', () => {
      const cols = [{ field: 'a' }, { field: 'b' }];
      expect(getRightStickyColumns(cols)).toEqual([]);
    });

    it('returns only right sticky columns', () => {
      const cols = [
        { field: 'a', sticky: 'left' },
        { field: 'b', sticky: 'right' },
        { field: 'c' },
        { field: 'd', sticky: 'right' },
      ];
      const result = getRightStickyColumns(cols);
      expect(result).toHaveLength(2);
      expect(result[0].field).toBe('b');
      expect(result[1].field).toBe('d');
    });
  });

  describe('getColumnStickyPosition', () => {
    it('returns null for non-sticky column', () => {
      expect(getColumnStickyPosition({ field: 'a' })).toBe(null);
    });

    it('returns left for left sticky', () => {
      expect(getColumnStickyPosition({ field: 'a', sticky: 'left' })).toBe('left');
    });

    it('returns right for right sticky', () => {
      expect(getColumnStickyPosition({ field: 'a', sticky: 'right' })).toBe('right');
    });
  });

  describe('calculateLeftStickyOffsets', () => {
    it('returns empty map for no sticky columns', () => {
      const cols = [{ field: 'a' }, { field: 'b' }];
      const result = calculateLeftStickyOffsets(cols, () => 100);
      expect(result.size).toBe(0);
    });

    it('calculates cumulative offsets for left sticky columns', () => {
      const cols = [
        { field: 'a', sticky: 'left' },
        { field: 'b', sticky: 'left' },
        { field: 'c' },
        { field: 'd', sticky: 'left' },
      ];
      const widths: Record<string, number> = { a: 100, b: 150, c: 200, d: 80 };
      const result = calculateLeftStickyOffsets(cols, (f) => widths[f]);

      expect(result.get('a')).toBe(0);
      expect(result.get('b')).toBe(100);
      expect(result.get('d')).toBe(250);
      expect(result.has('c')).toBe(false);
    });
  });

  describe('calculateRightStickyOffsets', () => {
    it('returns empty map for no sticky columns', () => {
      const cols = [{ field: 'a' }, { field: 'b' }];
      const result = calculateRightStickyOffsets(cols, () => 100);
      expect(result.size).toBe(0);
    });

    it('calculates cumulative offsets from right for sticky columns', () => {
      const cols = [
        { field: 'a', sticky: 'right' },
        { field: 'b' },
        { field: 'c', sticky: 'right' },
        { field: 'd', sticky: 'right' },
      ];
      const widths: Record<string, number> = { a: 100, b: 150, c: 120, d: 80 };
      const result = calculateRightStickyOffsets(cols, (f) => widths[f]);

      // Processed in reverse: d(0), c(80), a(200)
      expect(result.get('d')).toBe(0);
      expect(result.get('c')).toBe(80);
      expect(result.get('a')).toBe(200);
      expect(result.has('b')).toBe(false);
    });
  });

  describe('applyStickyOffsets', () => {
    let host: HTMLElement;

    beforeEach(() => {
      host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      // Header cells use data-field, body cells use data-col (column index)
      shadow.innerHTML = `
        <div class="header-row">
          <div class="cell" data-field="a">A</div>
          <div class="cell" data-field="b">B</div>
          <div class="cell" data-field="c">C</div>
        </div>
        <div class="data-grid-row">
          <div class="cell" data-col="0">1</div>
          <div class="cell" data-col="1">2</div>
          <div class="cell" data-col="2">3</div>
        </div>
      `;
      document.body.appendChild(host);
    });

    afterEach(() => {
      document.body.removeChild(host);
    });

    it('applies sticky-left class and offset to left sticky columns', () => {
      const cols = [{ field: 'a', sticky: 'left' }, { field: 'b' }, { field: 'c' }];
      applyStickyOffsets(host, cols);

      const headerCell = host.shadowRoot!.querySelector('.header-row .cell[data-field="a"]') as HTMLElement;
      expect(headerCell.classList.contains('sticky-left')).toBe(true);
      expect(headerCell.style.left).toBe('0px');

      // Body cell uses data-col="0" for the first column
      const bodyCell = host.shadowRoot!.querySelector('.data-grid-row .cell[data-col="0"]') as HTMLElement;
      expect(bodyCell.classList.contains('sticky-left')).toBe(true);
    });

    it('applies sticky-right class and offset to right sticky columns', () => {
      const cols = [{ field: 'a' }, { field: 'b' }, { field: 'c', sticky: 'right' }];
      applyStickyOffsets(host, cols);

      const headerCell = host.shadowRoot!.querySelector('.header-row .cell[data-field="c"]') as HTMLElement;
      expect(headerCell.classList.contains('sticky-right')).toBe(true);
      expect(headerCell.style.right).toBe('0px');

      // Body cell uses data-col="2" for the third column
      const bodyCell = host.shadowRoot!.querySelector('.data-grid-row .cell[data-col="2"]') as HTMLElement;
      expect(bodyCell.classList.contains('sticky-right')).toBe(true);
    });

    it('does nothing if no header cells found', () => {
      const emptyHost = document.createElement('div');
      emptyHost.attachShadow({ mode: 'open' });
      const cols = [{ field: 'a', sticky: 'left' }];

      // Should not throw
      expect(() => applyStickyOffsets(emptyHost, cols)).not.toThrow();
    });
  });

  describe('clearStickyOffsets', () => {
    it('removes sticky classes and styles from cells', () => {
      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = `
        <div class="cell sticky-left" style="left: 50px;">A</div>
        <div class="cell sticky-right" style="right: 100px;">B</div>
      `;
      document.body.appendChild(host);

      clearStickyOffsets(host);

      const cells = Array.from(shadow.querySelectorAll('.cell')) as HTMLElement[];
      cells.forEach((cell) => {
        expect(cell.classList.contains('sticky-left')).toBe(false);
        expect(cell.classList.contains('sticky-right')).toBe(false);
        expect(cell.style.left).toBe('');
        expect(cell.style.right).toBe('');
      });

      document.body.removeChild(host);
    });
  });
});
