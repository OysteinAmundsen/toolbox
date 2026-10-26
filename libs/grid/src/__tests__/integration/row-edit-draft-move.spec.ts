/**
 * Integration tests: an uncommitted row-edit draft survives the edit row moving to another index (#572).
 *
 * The row pool is positional (`_rowPool[i]` renders `_rows[start + i]`), so before the fix a moved
 * edit row landed on a different element and Editing re-injected editors from the committed row
 * data. `renderVisibleRows` now moves the element holding the live editors to the row's new slot.
 */
import { afterEach, describe, expect, it } from 'vitest';

import '../../index';
import '../../lib/features/editing';
import { nextFrame, waitUpgrade } from '../../../test/helpers';

interface Row {
  id: string;
  name: string;
}

const settle = async () => {
  await nextFrame(2);
  // Let any scheduled `cancelActiveRowEdit` (setTimeout) run.
  await new Promise((r) => setTimeout(r, 20));
  await nextFrame();
};

async function createGrid(rows: Row[], getRowId: (r: Row) => string | undefined = (r) => r.id) {
  const grid = document.createElement('tbw-grid') as any;
  grid.gridConfig = {
    features: { editing: { mode: 'row' } },
    getRowId,
    columns: [
      { field: 'id', header: 'ID' },
      { field: 'name', header: 'Name', editable: true },
    ],
  };
  grid.rows = rows;
  document.body.appendChild(grid);
  await waitUpgrade(grid);
  return grid;
}

/** The rendered row element currently bound to `row`. */
const rowElOf = (grid: HTMLElement, row: Row) =>
  [...grid.querySelectorAll('.data-grid-row')].find((el) => (el as any).__rowDataRef === row) as
    HTMLElement | undefined;

const nameInputOf = (grid: HTMLElement, row: Row) =>
  rowElOf(grid, row)?.querySelector('.cell.editing[data-col="1"] input') as HTMLInputElement | null;

/** Start a row edit on `index` and type an uncommitted draft (input event only — no change/blur). */
async function editWithDraft(grid: any, index: number, draft: string): Promise<HTMLInputElement> {
  // The click that starts an edit puts the focus cursor on that row (beginBulkEdit alone doesn't).
  grid._focusRow = index;
  grid.getPluginByName('editing').beginBulkEdit(index);
  await settle();
  const input = nameInputOf(grid, grid._rows[index])!;
  expect(input).toBeTruthy();
  input.focus();
  input.value = draft;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return input;
}

/** The draft editor is the same live element, on `row`, at `index`, and no other row has an editor. */
function expectDraftOn(grid: any, row: Row, index: number, input: HTMLInputElement, draft: string): void {
  expect(grid._activeEditRows).toBe(index);
  expect(grid._rows[index]).toBe(row);
  expect(nameInputOf(grid, row)).toBe(input);
  expect(input.value).toBe(draft);
  expect(grid.querySelectorAll('.cell.editing').length).toBe(1);
  // Every cell — editing ones included — reports the new index to click handling.
  const cellRows = [...rowElOf(grid, row)!.querySelectorAll('.cell')].map((c) => c.getAttribute('data-row'));
  expect(new Set(cellRows)).toEqual(new Set([String(index)]));
  // Pool slot ↔ row index alignment holds for the edit row (findRenderedRowElement relies on it).
  expect(grid.findRenderedRowElement(index)).toBe(rowElOf(grid, row));
  // DOM order still matches row order.
  const ids = [...grid.querySelectorAll('.data-grid-row')].map(
    (el) => el.querySelector('.cell[data-col="0"]')?.textContent,
  );
  expect(ids).toEqual(grid._rows.map((r: Row) => r.id));
}

/** A grid over rows `a`, `b` (in that order). */
async function abGrid() {
  const a: Row = { id: 'a', name: 'A' };
  const b: Row = { id: 'b', name: 'B' };
  return { a, b, grid: await createGrid([a, b]) };
}

/** Edit `a` (index 0) with an uncommitted draft, then reassign `rows` as `[b, a]`. */
async function editAThenSwap() {
  const { a, b, grid } = await abGrid();
  const input = await editWithDraft(grid, 0, 'draft');
  grid.rows = [b, a];
  await settle();
  return { a, b, grid, input };
}

/** Press `key` in the (moved) editor and expect the row edit to close. */
async function closeWith(grid: any, input: HTMLInputElement, key: 'Enter' | 'Escape'): Promise<void> {
  input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  await settle();
  expect(grid._activeEditRows).toBe(-1);
  expect(grid.querySelectorAll('.cell.editing').length).toBe(0);
}

/** The grid's focus cursor and its single `cell-focus` ring are on `row` at `index`. */
function expectFocusCursorOn(grid: any, row: Row, index: number): void {
  expect(grid._focusRow).toBe(index);
  const ring = [...grid.querySelectorAll('.cell-focus')];
  expect(ring.length).toBe(1);
  expect(ring[0].closest('.data-grid-row')).toBe(rowElOf(grid, row));
}

describe('row-edit draft survives an index move (#572)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps the draft when grid.rows is reassigned in a different order', async () => {
    const { a, b, grid, input } = await editAThenSwap();

    expectDraftOn(grid, a, 1, input, 'draft');
    expect(document.activeElement).toBe(input);
    expectFocusCursorOn(grid, a, 1);
    expect(a.name).toBe('A');
    expect(rowElOf(grid, b)?.textContent).toContain('B');
  });

  it('keeps the draft when the edit row moves up', async () => {
    const rows: Row[] = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ];
    const grid = await createGrid(rows);
    const c = rows[2];
    const input = await editWithDraft(grid, 2, 'draft');

    grid.rows = [c, rows[0], rows[1]];
    await settle();

    expectDraftOn(grid, c, 0, input, 'draft');
  });

  it('keeps the draft when a row is inserted above via insertRow()', async () => {
    const { a, grid } = await abGrid();
    const input = await editWithDraft(grid, 0, 'draft');

    const c: Row = { id: 'c', name: 'C' };
    await grid.insertRow(0, c, false);
    await settle();

    expectDraftOn(grid, a, 1, input, 'draft');
    expectFocusCursorOn(grid, a, 1);
    expect(rowElOf(grid, c)?.querySelector('input')).toBeNull();
  });

  it('keeps the draft when a row above is removed via removeRow()', async () => {
    const { b, grid } = await abGrid();
    const input = await editWithDraft(grid, 1, 'draft');

    await grid.removeRow(0, false);
    await settle();

    expectDraftOn(grid, b, 0, input, 'draft');
    expectFocusCursorOn(grid, b, 0);
  });

  it('keeps the edit on the moved row when its editor is clicked', async () => {
    const { a, b, grid, input } = await editAThenSwap();

    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();

    expectDraftOn(grid, a, 1, input, 'draft');
    expect(b.name).toBe('B');
  });

  it('commits with the moved index when the row has no id', async () => {
    const a: Row = { id: 'a', name: 'A' };
    const b: Row = { id: 'b', name: 'B' };
    const grid = await createGrid([a, b], () => undefined);
    const input = await editWithDraft(grid, 0, 'draft');
    grid.rows = [b, a];
    await settle();
    const commits: number[] = [];
    grid.on('cell-commit', (detail: { rowIndex: number }) => commits.push(detail.rowIndex));

    input.dispatchEvent(new FocusEvent('blur'));

    expect(commits).toEqual([1]);
    expect(a.name).toBe('draft');
    expect(rowElOf(grid, a)?.classList.contains('changed')).toBe(true);
    expect(rowElOf(grid, b)?.classList.contains('changed')).toBe(false);
  });

  it('commits the draft to the moved row on Enter and restores focus to it', async () => {
    const { a, b, grid, input } = await editAThenSwap();

    await closeWith(grid, input, 'Enter');

    expect(a.name).toBe('draft');
    expect(b.name).toBe('B');
    expectFocusCursorOn(grid, a, 1);
    expect(rowElOf(grid, a)?.contains(document.activeElement)).toBe(true);
  });

  it('reverts the moved row on Escape', async () => {
    const { a, b, grid, input } = await editAThenSwap();

    await closeWith(grid, input, 'Escape');

    expect(a.name).toBe('A');
    expect(b.name).toBe('B');
  });
});
