import { afterEach, describe, expect, it, vi } from 'vitest';
import { rafDebounce, withDispatchPath } from '../../../../test/helpers';
import {
  booleanCellHTML,
  clearCellFocus,
  decodeAriaRowIndex,
  formatDateValue,
  getColIndexFromCell,
  getDirection,
  getRowIndexFromCell,
  getRowIndexFromRow,
  isDevelopment,
  isOwnTarget,
  isRTL,
  resolveInlinePosition,
} from './utils';

describe('utils', () => {
  describe('isOwnTarget (#585)', () => {
    function nestedFixture() {
      const parent = document.createElement('tbw-grid');
      const parentCell = document.createElement('div');
      parentCell.className = 'cell';
      const child = document.createElement('div');
      child.setAttribute('data-tbw-grid', '');
      const childCell = document.createElement('div');
      childCell.className = 'cell';
      child.appendChild(childCell);
      parent.append(parentCell, child);
      return { parent, parentCell, child, childCell };
    }

    it('accepts the host itself and elements whose nearest grid is the host', () => {
      const { parent, parentCell } = nestedFixture();
      expect(isOwnTarget(parent, parent)).toBe(true);
      expect(isOwnTarget(parent, parentCell)).toBe(true);
    });

    it('rejects a nested grid host and anything inside it', () => {
      const { parent, child, childCell } = nestedFixture();
      expect(isOwnTarget(parent, child)).toBe(false);
      expect(isOwnTarget(parent, childCell)).toBe(false);
      // From the child's perspective its own cell is own.
      expect(isOwnTarget(child, childCell)).toBe(true);
    });

    it('rejects an element in an unrelated grid', () => {
      const { parent } = nestedFixture();
      const other = document.createElement('tbw-grid');
      const otherCell = document.createElement('div');
      other.appendChild(otherCell);
      expect(isOwnTarget(parent, otherCell)).toBe(false);
    });

    it('walks through shadow roots: a control inside a nested grid shadow-DOM editor is the child’s', () => {
      // `closest()` stops at the shadow boundary; `composedPath()[0]` is the
      // inner input, so without the walk the input has "no grid ancestor" and
      // would be accepted by the parent.
      const { parent, child, childCell, parentCell } = nestedFixture();
      const makeShadowInput = (slot: HTMLElement) => {
        const editorHost = document.createElement('div');
        slot.appendChild(editorHost);
        const input = document.createElement('input');
        editorHost.attachShadow({ mode: 'open' }).appendChild(input);
        return input;
      };
      const childInput = makeShadowInput(childCell);
      const parentInput = makeShadowInput(parentCell);

      expect(childInput.closest('tbw-grid, [data-tbw-grid]')).toBeNull();
      expect(isOwnTarget(parent, childInput)).toBe(false);
      expect(isOwnTarget(child, childInput)).toBe(true);
      expect(isOwnTarget(parent, parentInput)).toBe(true);
    });

    it('accepts targets with no grid ancestor, missing targets and non-element targets', () => {
      const { parent } = nestedFixture();
      expect(isOwnTarget(parent, document.createElement('div'))).toBe(true);
      expect(isOwnTarget(parent, null)).toBe(true);
      expect(isOwnTarget(parent, undefined)).toBe(true);
      expect(isOwnTarget(parent, document)).toBe(true);
      expect(isOwnTarget(undefined, document.createElement('div'))).toBe(true);
    });

    describe('event form (composedPath)', () => {
      /** Dispatch `type` from `from` and capture `isOwnTarget(host, e)` as seen by a listener on `host`. */
      function ownershipSeenBy(host: Element, from: Element, type = 'keydown', detachFirstOn?: Element): boolean {
        let seen = false;
        let called = false;
        const ac = new AbortController();
        if (detachFirstOn) {
          // The nested grid's own handler runs before the parent's and tears the target out.
          detachFirstOn.addEventListener(type, (e) => (e.target as Element).remove(), { signal: ac.signal });
        }
        host.addEventListener(
          type,
          (e) => {
            called = true;
            seen = isOwnTarget(host, e);
          },
          { signal: ac.signal },
        );
        from.dispatchEvent(withDispatchPath(new Event(type, { bubbles: true, composed: true }), from));
        ac.abort();
        expect(called).toBe(true);
        return seen;
      }

      it('resolves ownership from the dispatch-time path', () => {
        const { parent, parentCell, child, childCell } = nestedFixture();
        document.body.appendChild(parent);
        expect(ownershipSeenBy(parent, parentCell)).toBe(true);
        expect(ownershipSeenBy(parent, childCell)).toBe(false);
        expect(ownershipSeenBy(child, childCell)).toBe(true);
        parent.remove();
      });

      it('still rejects a child event whose target an earlier listener detached', () => {
        const { parent, child, childCell } = nestedFixture();
        document.body.appendChild(parent);
        expect(ownershipSeenBy(parent, childCell, 'keydown', child)).toBe(false);
        // The element form cannot know any more — this is why handlers pass the event.
        expect(childCell.isConnected).toBe(false);
        expect(isOwnTarget(parent, childCell)).toBe(true);
        parent.remove();
      });

      it('crosses shadow roots without an explicit host walk', () => {
        const { parent, childCell } = nestedFixture();
        document.body.appendChild(parent);
        const editorHost = document.createElement('div');
        childCell.appendChild(editorHost);
        const input = document.createElement('input');
        editorHost.attachShadow({ mode: 'open' }).appendChild(input);
        expect(ownershipSeenBy(parent, input)).toBe(false);
        parent.remove();
      });

      it('accepts an event that has not been dispatched or whose path holds no grid', () => {
        const { parent } = nestedFixture();
        expect(isOwnTarget(parent, new Event('keydown'))).toBe(true);
        const bare = document.createElement('div');
        document.body.appendChild(bare);
        expect(ownershipSeenBy(bare, bare)).toBe(true);
        bare.remove();
      });
    });
  });

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
      // The decoder must use the SAME value the stamp used (the host cache), never a
      // fresh DOM probe — within a frame the two can disagree between the ROWS pass
      // and the afterRender sync (#583).
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

  describe('getRowIndexFromRow', () => {
    it('reads the first cell data-row', () => {
      const row = document.createElement('div');
      row.className = 'data-grid-row';
      row.setAttribute('aria-rowindex', '99');
      row.innerHTML = '<div class="cell"></div><div class="cell" data-row="7"></div>';
      expect(getRowIndexFromRow(row)).toBe(7);
    });

    it('decodes aria-rowindex with the host cached header count when no cell has data-row', () => {
      const host = document.createElement('div');
      host.setAttribute('data-tbw-grid', '');
      // Responsive card mode: header hidden, zero header rows counted.
      Object.assign(host, { __cachedHeaderRowCount: 0 });
      const row = document.createElement('div');
      row.className = 'data-grid-row';
      row.setAttribute('aria-rowindex', '4');
      host.appendChild(row);
      expect(getRowIndexFromRow(row)).toBe(3);
    });

    it('returns -1 without data-row or aria-rowindex', () => {
      const row = document.createElement('div');
      row.className = 'data-grid-row';
      expect(getRowIndexFromRow(row)).toBe(-1);
    });
  });

  describe('decodeAriaRowIndex', () => {
    it('ignores content data-row and decodes the grid-stamped aria-rowindex', () => {
      const host = document.createElement('div');
      host.setAttribute('data-tbw-grid', '');
      Object.assign(host, { __cachedHeaderRowCount: 1 });
      const row = document.createElement('div');
      row.className = 'data-grid-row';
      row.setAttribute('aria-rowindex', '4'); // data index 2
      // A custom card root claiming data-row="0" belongs to the renderer.
      row.innerHTML = '<div class="cell" data-row="0"></div>';
      host.appendChild(row);
      expect(decodeAriaRowIndex(row)).toBe(2);
      expect(getRowIndexFromRow(row)).toBe(0);
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
