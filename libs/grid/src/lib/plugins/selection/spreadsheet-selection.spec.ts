/**
 * SelectionPlugin `mode: 'spreadsheet'` — range selection plus whole rows and
 * whole columns, all expressed as ranges (Excel / Google Sheets muscle memory).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import { EditingPlugin } from '../editing/editing-plugin';
import { SelectionPlugin } from './selection-plugin';
import type { SelectionChangeDetail } from './types';

async function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function settle(): Promise<void> {
  await nextFrame();
  await nextFrame();
}

async function waitUpgrade(el: HTMLElement & { ready?: () => Promise<void> }): Promise<void> {
  await customElements.whenDefined('tbw-grid');
  await el.ready?.();
  await settle();
}

function press(target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, composed: true, ...init });
  target.dispatchEvent(event);
  return event;
}

function headerCell(grid: HTMLElement, field: string): HTMLElement {
  const cell = grid.querySelector<HTMLElement>(`.header-row > .cell[data-field="${field}"]`);
  if (!cell) throw new Error(`no header cell for ${field}`);
  return cell;
}

const columns = [
  { field: 'a', header: 'A', sortable: true },
  { field: 'b', header: 'B', sortable: true },
  { field: 'c', header: 'C', sortable: true },
  { field: 'd', header: 'D', sortable: true },
];
const makeRows = (n: number) => Array.from({ length: n }, (_, i) => ({ a: i, b: i * 10, c: i * 100, d: `r${i}` }));

describe("SelectionPlugin mode: 'spreadsheet'", () => {
  let grid: any;
  let plugin: SelectionPlugin;
  let events: SelectionChangeDetail[];

  async function setup(extraPlugins: unknown[] = [], rows = makeRows(6)) {
    plugin = new SelectionPlugin({ mode: 'spreadsheet' });
    grid.gridConfig = { columns, plugins: [plugin, ...extraPlugins] };
    grid.rows = rows;
    await waitUpgrade(grid);
    events = [];
    grid.addEventListener('selection-change', (e: CustomEvent<SelectionChangeDetail>) => events.push(e.detail));
  }

  beforeEach(async () => {
    await import('../../core/grid');
    document.body.innerHTML = '';
    grid = document.createElement('tbw-grid');
    document.body.appendChild(grid);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Shift+Space — whole rows', () => {
    it('selects the focused row across every column', async () => {
      await setup();
      grid._focusRow = 2;
      grid._focusCol = 1;
      const e = press(grid, ' ', { shiftKey: true });
      await settle();

      expect(e.defaultPrevented).toBe(true);
      expect(plugin.getSelection().ranges).toEqual([{ from: { row: 2, col: 0 }, to: { row: 2, col: 3 } }]);
      expect(plugin.getSelectedRowIndices()).toEqual([2]);
      expect(events.at(-1)?.activeAxis).toBe('range');
      expect(
        grid
          .querySelector('.data-grid-row .cell[data-row="2"]')
          ?.closest('.data-grid-row')
          ?.getAttribute('aria-selected'),
      ).toBe('true');
    });

    it('expands a partial range to the whole rows it spans', async () => {
      await setup();
      plugin.setRanges([{ from: { row: 1, col: 1 }, to: { row: 3, col: 2 } }]);
      grid._focusRow = 3;
      grid._focusCol = 2;
      press(grid, ' ', { shiftKey: true });
      await settle();

      expect(plugin.getSelection().ranges).toEqual([{ from: { row: 1, col: 0 }, to: { row: 3, col: 3 } }]);
      expect(plugin.getSelectedRowIndices()).toEqual([1, 2, 3]);
    });

    it('Shift+ArrowDown afterwards extends by whole rows', async () => {
      await setup();
      grid._focusRow = 1;
      grid._focusCol = 2;
      press(grid, ' ', { shiftKey: true });
      await settle();
      press(grid, 'ArrowDown', { shiftKey: true });
      await settle();
      press(grid, 'ArrowDown', { shiftKey: true });
      await settle();

      expect(plugin.getSelection().ranges).toEqual([{ from: { row: 1, col: 0 }, to: { row: 3, col: 3 } }]);
      expect(plugin.getSelectedRowIndices()).toEqual([1, 2, 3]);
    });

    it('a plain arrow afterwards collapses back to a cell', async () => {
      await setup();
      grid._focusRow = 1;
      press(grid, ' ', { shiftKey: true });
      await settle();
      press(grid, 'ArrowDown');
      await settle();

      expect(plugin.getSelection().ranges).toEqual([]);
      expect(plugin.getSelectedRowIndices()).toEqual([]);
    });
  });

  describe('Ctrl/⌘+Space — whole columns', () => {
    it.each([{ ctrlKey: true }, { metaKey: true }])('selects every row of the focused column (%o)', async (mod) => {
      await setup();
      grid._focusRow = 2;
      grid._focusCol = 1;
      press(grid, ' ', mod);
      await settle();

      expect(plugin.getSelection().ranges).toEqual([{ from: { row: 0, col: 1 }, to: { row: 5, col: 1 } }]);
      expect(plugin.getSelectedColumns()).toEqual(['b']);
      expect(events.at(-1)?.selectedColumns).toEqual(['b']);
      expect(headerCell(grid, 'b').classList.contains('column-selected')).toBe(true);
      expect(headerCell(grid, 'a').classList.contains('column-selected')).toBe(false);
    });

    it('Shift+ArrowRight afterwards extends by whole columns', async () => {
      await setup();
      grid._focusRow = 2;
      grid._focusCol = 1;
      press(grid, ' ', { ctrlKey: true });
      await settle();
      press(grid, 'ArrowRight', { shiftKey: true });
      await settle();

      expect(plugin.getSelection().ranges).toEqual([{ from: { row: 0, col: 1 }, to: { row: 5, col: 2 } }]);
      expect(plugin.getSelectedColumns()).toEqual(['b', 'c']);
    });

    it('keeps covering rows that appear after the column was selected', async () => {
      // Stand-in for ServerSidePlugin infinite mode: processRows grows the
      // row model without replacing the host's source rows.
      class GrowingRows extends BaseGridPlugin {
        readonly name = 'growingRows';
        extra = 0;
        override processRows(rows: readonly unknown[]): unknown[] {
          return [...rows, ...Array.from({ length: this.extra }, (_, i) => ({ __loading: true, __index: i }))];
        }
      }
      const growing = new GrowingRows();
      await setup([growing]);
      grid._focusCol = 0;
      press(grid, ' ', { ctrlKey: true });
      await settle();
      expect(plugin.getSelection().ranges[0].to.row).toBe(5);

      growing.extra = 4;
      growing.requestRender();
      await settle();

      expect(grid._rows.length).toBe(10);
      expect(plugin.getSelection().ranges).toEqual([{ from: { row: 0, col: 0 }, to: { row: 9, col: 0 } }]);
    });
  });

  it('Ctrl/⌘+Shift+Space selects everything', async () => {
    await setup();
    press(grid, ' ', { ctrlKey: true, shiftKey: true });
    await settle();

    expect(plugin.getSelection().ranges).toEqual([{ from: { row: 0, col: 0 }, to: { row: 5, col: 3 } }]);
    expect(plugin.getSelectedColumns()).toEqual(['a', 'b', 'c', 'd']);
    expect(plugin.getSelectedRowIndices()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  describe('header chords', () => {
    it('Ctrl+click toggles a whole column; plain click still sorts', async () => {
      await setup();
      headerCell(grid, 'c').dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
      await settle();
      expect(plugin.getSelectedColumns()).toEqual(['c']);
      expect(grid._sortState).toBeFalsy();

      headerCell(grid, 'c').dispatchEvent(new MouseEvent('click', { bubbles: true, metaKey: true }));
      await settle();
      expect(plugin.getSelectedColumns()).toEqual([]);

      headerCell(grid, 'a').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      expect(plugin.getSelectedColumns()).toEqual([]);
      expect(grid._sortState?.field).toBe('a');
    });

    it('Ctrl+click adds columns; Ctrl+Shift+click extends from the anchor column', async () => {
      await setup();
      headerCell(grid, 'a').dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
      headerCell(grid, 'c').dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
      await settle();
      expect(plugin.getSelectedColumns()).toEqual(['a', 'c']);

      headerCell(grid, 'd').dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true, shiftKey: true }));
      await settle();
      expect(plugin.getSelectedColumns()).toEqual(['a', 'c', 'd']);
      expect(plugin.getSelection().ranges.at(-1)).toEqual({ from: { row: 0, col: 2 }, to: { row: 5, col: 3 } });
    });
  });

  describe('does not steal Space from editing', () => {
    it('Shift+Space from a form field is left alone', async () => {
      await setup();
      const input = document.createElement('input');
      grid.querySelector('.rows-body')?.appendChild(input);
      const e = press(input, ' ', { shiftKey: true });
      await settle();

      expect(e.defaultPrevented).toBe(false);
      expect(plugin.getSelection().ranges).toEqual([]);
    });

    it('Shift+Space on a boolean cell selects the row instead of toggling the value', async () => {
      const editing = new EditingPlugin();
      const rows = makeRows(3).map((r) => ({ ...r, flag: false }));
      plugin = new SelectionPlugin({ mode: 'spreadsheet' });
      // Editing first, so it would see the key before selection if it didn't bail.
      grid.gridConfig = {
        columns: [...columns, { field: 'flag', type: 'boolean', editable: true }],
        plugins: [editing, plugin],
      };
      grid.rows = rows;
      await waitUpgrade(grid);
      grid._focusRow = 1;
      grid._focusCol = 4;
      press(grid, ' ', { shiftKey: true });
      await settle();

      expect(rows[1].flag).toBe(false);
      expect(plugin.getSelectedRowIndices()).toEqual([1]);
    });
  });

  it('regular range behavior is intact (Shift+Arrow extends a cell range)', async () => {
    await setup();
    grid._focusRow = 0;
    grid._focusCol = 0;
    press(grid, 'ArrowRight', { shiftKey: true });
    await settle();
    expect(plugin.getSelection().ranges).toEqual([{ from: { row: 0, col: 0 }, to: { row: 0, col: 1 } }]);
    expect(plugin.getSelectedColumns()).toEqual([]);
    expect(plugin.getSelectedRowIndices()).toEqual([]);
  });

  it('warns nothing and sets the range selection-mode attribute for CSS', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await setup();
    expect(grid.getAttribute('data-selection-mode')).toBe('range');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
