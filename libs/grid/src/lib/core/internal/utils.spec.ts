import { describe, expect, it } from 'vitest';
import { rafDebounce } from '../../../../test/helpers';
import {
  booleanCellHTML,
  clearCellFocus,
  formatBooleanValue,
  formatDateValue,
  getColIndexFromCell,
  getDirection,
  getRowIndexFromCell,
  isRTL,
  resolveInlinePosition,
} from './utils';

describe('utils', () => {
  it('rafDebounce executes last call and supports cancel', async () => {
    const calls: number[] = [];
    const fn = rafDebounce((v: number) => calls.push(v));
    fn(1);
    fn(2); // only 2 should survive
    await new Promise((r) => requestAnimationFrame(r));
    expect(calls).toEqual([2]);
    fn(3);
    (fn as any).cancel();
    await new Promise((r) => requestAnimationFrame(r));
    expect(calls).toEqual([2]);
  });

  describe('booleanCellHTML', () => {
    it('should return checked checkbox HTML for true', () => {
      const html = booleanCellHTML(true);
      expect(html).toContain('aria-checked="true"');
      expect(html).toContain('role="checkbox"');
      expect(html).toContain('&#x1F5F9;'); // checkmark
    });

    it('should return unchecked checkbox HTML for false', () => {
      const html = booleanCellHTML(false);
      expect(html).toContain('aria-checked="false"');
      expect(html).toContain('role="checkbox"');
      expect(html).toContain('&#9744;'); // empty box
    });
  });

  describe('formatDateValue', () => {
    it('should return empty string for null/undefined', () => {
      expect(formatDateValue(null)).toBe('');
      expect(formatDateValue(undefined)).toBe('');
      expect(formatDateValue('')).toBe('');
    });

    it('should format Date objects', () => {
      const date = new Date('2024-01-15');
      const result = formatDateValue(date);
      expect(result).toMatch(/\d+/); // Contains at least some digits
    });

    it('should format timestamps', () => {
      const timestamp = new Date('2024-01-15').getTime();
      const result = formatDateValue(timestamp);
      expect(result).toMatch(/\d+/);
    });

    it('should format date strings', () => {
      const result = formatDateValue('2024-01-15');
      expect(result).toMatch(/\d+/);
    });

    it('should return empty string for invalid dates', () => {
      expect(formatDateValue('invalid')).toBe('');
      expect(formatDateValue(new Date('invalid'))).toBe('');
    });
  });

  describe('formatBooleanValue', () => {
    it('should return checkmark for truthy values', () => {
      expect(formatBooleanValue(true)).toBe('\u{1F5F9}');
      expect(formatBooleanValue(1)).toBe('\u{1F5F9}');
      expect(formatBooleanValue('yes')).toBe('\u{1F5F9}');
    });

    it('should return empty box for falsy values', () => {
      expect(formatBooleanValue(false)).toBe('\u2610');
      expect(formatBooleanValue(0)).toBe('\u2610');
      expect(formatBooleanValue('')).toBe('\u2610');
      expect(formatBooleanValue(null)).toBe('\u2610');
    });
  });

  describe('getRowIndexFromCell', () => {
    it('should return -1 for null element', () => {
      expect(getRowIndexFromCell(null)).toBe(-1);
    });

    it('should return -1 when data-row attribute is missing', () => {
      const el = document.createElement('div');
      expect(getRowIndexFromCell(el)).toBe(-1);
    });

    it('should return row index from data-row attribute', () => {
      const el = document.createElement('div');
      el.setAttribute('data-row', '5');
      expect(getRowIndexFromCell(el)).toBe(5);
    });

    it('should handle zero index', () => {
      const el = document.createElement('div');
      el.setAttribute('data-row', '0');
      expect(getRowIndexFromCell(el)).toBe(0);
    });
  });

  describe('getColIndexFromCell', () => {
    it('should return -1 for null element', () => {
      expect(getColIndexFromCell(null)).toBe(-1);
    });

    it('should return -1 when data-col attribute is missing', () => {
      const el = document.createElement('div');
      expect(getColIndexFromCell(el)).toBe(-1);
    });

    it('should return column index from data-col attribute', () => {
      const el = document.createElement('div');
      el.setAttribute('data-col', '3');
      expect(getColIndexFromCell(el)).toBe(3);
    });

    it('should handle zero index', () => {
      const el = document.createElement('div');
      el.setAttribute('data-col', '0');
      expect(getColIndexFromCell(el)).toBe(0);
    });
  });

  describe('clearCellFocus', () => {
    it('should do nothing for null root', () => {
      expect(() => clearCellFocus(null)).not.toThrow();
    });

    it('should remove cell-focus class from all elements', () => {
      const root = document.createElement('div');
      root.innerHTML = `
        <div class="cell cell-focus" data-row="0" data-col="0"></div>
        <div class="cell" data-row="0" data-col="1"></div>
        <div class="cell cell-focus" data-row="1" data-col="0"></div>
      `;
      clearCellFocus(root);
      const focused = root.querySelectorAll('.cell-focus');
      expect(focused.length).toBe(0);
    });

    it('should work with element root', () => {
      const host = document.createElement('div');
      host.innerHTML = `<div class="cell cell-focus"></div>`;
      clearCellFocus(host);
      expect(host.querySelectorAll('.cell-focus').length).toBe(0);
    });
  });

  describe('RTL utilities', () => {
    describe('getDirection', () => {
      it('should return ltr by default', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        expect(getDirection(el)).toBe('ltr');
        el.remove();
      });

      it('should detect rtl from dir attribute', () => {
        const el = document.createElement('div');
        el.setAttribute('dir', 'rtl');
        document.body.appendChild(el);
        expect(getDirection(el)).toBe('rtl');
        el.remove();
      });

      it('should inherit rtl from parent', () => {
        const parent = document.createElement('div');
        parent.setAttribute('dir', 'rtl');
        const child = document.createElement('div');
        parent.appendChild(child);
        document.body.appendChild(parent);
        expect(getDirection(child)).toBe('rtl');
        parent.remove();
      });
    });

    describe('isRTL', () => {
      it('should return false for ltr', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        expect(isRTL(el)).toBe(false);
        el.remove();
      });

      it('should return true for rtl', () => {
        const el = document.createElement('div');
        el.setAttribute('dir', 'rtl');
        document.body.appendChild(el);
        expect(isRTL(el)).toBe(true);
        el.remove();
      });
    });

    describe('resolveInlinePosition', () => {
      it('should pass through physical values unchanged', () => {
        expect(resolveInlinePosition('left', 'ltr')).toBe('left');
        expect(resolveInlinePosition('right', 'ltr')).toBe('right');
        expect(resolveInlinePosition('left', 'rtl')).toBe('left');
        expect(resolveInlinePosition('right', 'rtl')).toBe('right');
      });

      it('should resolve start/end for LTR', () => {
        expect(resolveInlinePosition('start', 'ltr')).toBe('left');
        expect(resolveInlinePosition('end', 'ltr')).toBe('right');
      });

      it('should resolve start/end for RTL (flipped)', () => {
        expect(resolveInlinePosition('start', 'rtl')).toBe('right');
        expect(resolveInlinePosition('end', 'rtl')).toBe('left');
      });
    });
  });
});
