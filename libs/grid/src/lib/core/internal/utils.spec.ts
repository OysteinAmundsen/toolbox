import { afterEach, describe, expect, it, vi } from 'vitest';
import { rafDebounce } from '../../../../test/helpers';
import {
  booleanCellHTML,
  clearCellFocus,
  formatDateValue,
  getColIndexFromCell,
  getDirection,
  getRowIndexFromCell,
  isDevelopment,
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

    it('falls back to a sibling cell data-row, never to the DOM position', () => {
      // Virtualized window starting at row 40: DOM position 0 must not read as index 0.
      const body = document.createElement('div');
      const row = document.createElement('div');
      row.className = 'data-grid-row';
      const first = document.createElement('div');
      first.className = 'cell';
      first.setAttribute('data-row', '40');
      const custom = document.createElement('div');
      custom.className = 'cell';
      row.append(first, custom);
      body.appendChild(row);

      expect(getRowIndexFromCell(custom)).toBe(40);
    });

    it('returns -1 when no cell in the row carries data-row', () => {
      const row = document.createElement('div');
      row.className = 'data-grid-row';
      const custom = document.createElement('div');
      custom.className = 'cell';
      row.appendChild(custom);
      expect(getRowIndexFromCell(custom)).toBe(-1);
    });

    it('falls back to the row aria-rowindex for plugin-rendered rows (group headers)', () => {
      // `renderVisibleRows` writes aria-rowindex = rowIndex + headerRowCount + 1
      // before the renderRow hook, so a group row's cells (data-col only) resolve.
      const rowsBody = document.createElement('div');
      rowsBody.className = 'rows-body';
      const header = document.createElement('div');
      header.className = 'header';
      rowsBody.appendChild(header);
      const row = document.createElement('div');
      row.className = 'data-grid-row group-row';
      row.setAttribute('aria-rowindex', '42'); // data index 40 with one header row
      const groupCell = document.createElement('div');
      groupCell.className = 'cell group-full';
      groupCell.setAttribute('data-col', '0');
      row.appendChild(groupCell);
      rowsBody.appendChild(row);
      expect(getRowIndexFromCell(groupCell)).toBe(40);

      // A column-group header row adds a second header row.
      const groupHeaderRow = document.createElement('div');
      groupHeaderRow.className = 'header-group-row';
      header.appendChild(groupHeaderRow);
      expect(getRowIndexFromCell(groupCell)).toBe(39);
    });

    it('decodes aria-rowindex with the host cached header count, not a fresh DOM count', () => {
      // rows.ts caches __cachedHeaderRowCount once, BEFORE GroupingColumns inserts its
      // header row, so the stamped aria-rowindex is offset by the cached value (1) even
      // though the DOM now shows two header rows.
      const host = document.createElement('div');
      host.setAttribute('data-tbw-grid', '');
      Object.assign(host, { __cachedHeaderRowCount: 1 });
      const rowsBody = document.createElement('div');
      rowsBody.className = 'rows-body';
      const header = document.createElement('div');
      header.className = 'header';
      header.innerHTML = '<div class="header-group-row"></div>';
      rowsBody.appendChild(header);
      const row = document.createElement('div');
      row.className = 'data-grid-row group-row';
      row.setAttribute('aria-rowindex', '5'); // data index 3 with the cached count of 1
      const groupCell = document.createElement('div');
      groupCell.className = 'cell group-full';
      groupCell.setAttribute('data-col', '0');
      row.appendChild(groupCell);
      rowsBody.appendChild(row);
      host.appendChild(rowsBody);

      expect(getRowIndexFromCell(groupCell)).toBe(3);
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

    it('should remove cell-focus class from cells of own rows', () => {
      const body = document.createElement('div');
      body.innerHTML = `
        <div class="data-grid-row">
          <div class="cell cell-focus" data-row="0" data-col="0"></div>
          <div class="cell" data-row="0" data-col="1"></div>
        </div>
        <div class="data-grid-row">
          <div class="cell cell-focus" data-row="1" data-col="0"></div>
        </div>
      `;
      clearCellFocus(body);
      expect(body.querySelectorAll('.cell-focus').length).toBe(0);
    });

    it('should leave a nested grid inside a detail row or cell untouched (#581)', () => {
      const body = document.createElement('div');
      body.innerHTML = `
        <div class="data-grid-row">
          <div class="cell cell-focus" data-row="0" data-col="0">
            <div class="rows"><div class="data-grid-row"><div class="cell cell-focus" data-row="0" data-col="0"></div></div></div>
          </div>
        </div>
        <div class="detail-row">
          <div class="rows"><div class="data-grid-row"><div class="cell cell-focus" data-row="0" data-col="0"></div></div></div>
        </div>
      `;
      clearCellFocus(body);
      const remaining = body.querySelectorAll('.cell-focus');
      expect(remaining.length).toBe(2);
      for (const cell of remaining) expect(cell.closest('.rows')).not.toBeNull();
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

  describe('isDevelopment', () => {
    const originalWindow = globalThis.window;
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      // Restore NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
      // Restore window
      if (originalWindow) {
        globalThis.window = originalWindow;
      }
    });

    it('should return true for localhost', () => {
      // Mock window.location.hostname as localhost
      vi.stubGlobal('window', {
        location: { hostname: 'localhost' },
      });
      process.env.NODE_ENV = 'production';
      expect(isDevelopment()).toBe(true);
      vi.unstubAllGlobals();
    });

    it('should return true for 127.0.0.1', () => {
      vi.stubGlobal('window', {
        location: { hostname: '127.0.0.1' },
      });
      process.env.NODE_ENV = 'production';
      expect(isDevelopment()).toBe(true);
      vi.unstubAllGlobals();
    });

    it('should return true when NODE_ENV is not production', () => {
      vi.stubGlobal('window', {
        location: { hostname: 'example.com' },
      });
      process.env.NODE_ENV = 'development';
      expect(isDevelopment()).toBe(true);
      vi.unstubAllGlobals();
    });

    it('should return false in production with non-localhost', () => {
      vi.stubGlobal('window', {
        location: { hostname: 'example.com' },
      });
      process.env.NODE_ENV = 'production';
      expect(isDevelopment()).toBe(false);
      vi.unstubAllGlobals();
    });
  });
});
