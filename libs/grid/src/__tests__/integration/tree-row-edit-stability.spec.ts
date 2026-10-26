/**
 * Integration tests: row-mode editing of NESTED tree rows survives re-renders (#570).
 *
 * EditingPlugin's `processRows` runs LAST (priority 50, after Tree/GroupingRows' 10
 * and Filtering/MultiSort's 0), so it sees the final flattened rows and moves the
 * edit index before the row DOM is reconciled. Nested rows are swapped in by
 * HierarchyPlugin. Whether a row is gone is decided in `afterRender`.
 */
import { afterEach, describe, expect, it } from 'vitest';

import '../../index';
import '../../lib/features/editing';
import '../../lib/features/filtering';
import '../../lib/features/tree';
import { nextFrame, waitUpgrade } from '../../../test/helpers';

interface Row {
  id: string;
  a?: string;
  b?: string;
  children?: Row[];
}

const settle = async () => {
  await nextFrame(2);
  // Let any scheduled `cancelActiveRowEdit` (setTimeout) run.
  await new Promise((r) => setTimeout(r, 20));
  await nextFrame();
};

const TREE_FEATURES = {
  tree: { childrenField: 'children', defaultExpanded: true },
  editing: { mode: 'row', editOn: 'dblclick' },
};

async function createGrid(rows: Row[], features: object = TREE_FEATURES) {
  const grid = document.createElement('tbw-grid') as any;
  grid.gridConfig = {
    features,
    getRowId: (r: Row) => r.id,
    columns: [
      { field: 'id', header: 'ID' },
      { field: 'a', header: 'A', editable: true },
      { field: 'b', header: 'B', editable: true },
    ],
  };
  grid.rows = rows;
  document.body.appendChild(grid);
  await waitUpgrade(grid);
  return grid;
}

function makeRows(): Row[] {
  return [
    { id: 'p1', children: [{ id: 'c1', a: 'one', b: 'two' }] },
    { id: 'p2', a: 'x', b: 'y' },
  ];
}

const editorCount = (grid: HTMLElement) => grid.querySelectorAll('.cell.editing').length;

/** The rendered row element currently bound to `row`. */
const rowElOf = (grid: HTMLElement, row: Row) =>
  [...grid.querySelectorAll('.data-grid-row')].find((el) => (el as any).__rowDataRef === row) as
    HTMLElement | undefined;

/**
 * Type an uncommitted draft into the edit row's column-`a` editor (input event only, no change/blur).
 * Returns the editor so tests can assert the draft is carried across an index move (#572).
 */
function typeDraft(grid: HTMLElement, row: Row, value: string): HTMLInputElement {
  const input = rowElOf(grid, row)?.querySelector('.cell.editing[data-col="1"] input') as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return input;
}

/** Both editors sit on `row`'s element, the live draft editor survived, and no other row has it. */
function expectEditorsOnlyOn(grid: HTMLElement, row: Row, draft: string, input: HTMLInputElement): void {
  expect(rowElOf(grid, row)?.querySelectorAll('.cell.editing').length).toBe(2);
  expect(editorCount(grid)).toBe(2);
  expect(rowElOf(grid, row)?.querySelector('.cell.editing[data-col="1"] input')).toBe(input);
  expect(input.value).toBe(draft);
  for (const el of grid.querySelectorAll('.data-grid-row')) {
    const data = (el as any).__rowDataRef as Row;
    if (data === row) continue;
    expect(el.querySelector('input')).toBeNull();
    expect(el.textContent).not.toContain(draft);
    expect(data.a).not.toBe(draft);
  }
}

describe('row-mode editing of nested tree rows (#570)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps a nested row in edit across requestRender()', async () => {
    const grid = await createGrid(makeRows());
    const editing = grid.getPluginByName('editing');
    const child = grid._rows[1];
    expect(child.id).toBe('c1');

    editing.beginBulkEdit(1);
    await settle();
    expect(editorCount(grid)).toBe(2);
    expect(grid._activeEditRows).toBe(1);

    grid.requestRender();
    await settle();

    expect(grid._rows[1]).toBe(child);
    expect(editorCount(grid)).toBe(2);
    expect(grid._activeEditRows).toBe(1);
  });

  it('keeps a nested row in edit when a cell-commit handler re-renders', async () => {
    const grid = await createGrid(makeRows());
    const editing = grid.getPluginByName('editing');

    grid.on('cell-commit', () => queueMicrotask(() => grid.requestRender()));

    editing.beginBulkEdit(1);
    await settle();

    const input = grid.querySelector('.cell.editing[data-col="1"] input') as HTMLInputElement;
    expect(input).toBeTruthy();
    input.value = 'changed';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    await settle();

    expect(grid._rows[1].a).toBe('changed');
    expect(editorCount(grid)).toBe(2);
    expect(grid._activeEditRows).toBe(1);
  });

  it('keeps a nested row in edit when rows are replaced with new objects (same ids)', async () => {
    const grid = await createGrid(makeRows());
    const editing = grid.getPluginByName('editing');
    const inProgress = grid._rows[1];

    editing.beginBulkEdit(1);
    await settle();
    // A committed cell value lives on the in-progress row object.
    inProgress.a = 'edited';

    // e.g. a store emits fresh objects that don't reflect the edit yet.
    grid.rows = makeRows();
    await settle();

    expect(grid._activeEditRows).toBe(1);
    expect(editorCount(grid)).toBe(2);
    expect(grid._rows[1]).toBe(inProgress);
    expect(grid._rows[1].a).toBe('edited');
    // Still rendered as a level-2 child of p1.
    const rowEl = grid.querySelector('.cell[data-row="1"]')?.closest('.data-grid-row');
    expect(rowEl?.getAttribute('aria-level')).toBe('2');
  });

  it('keeps an edited parent’s own children when its replacement has none and it was the only parent', async () => {
    const rows = makeRows();
    const grid = await createGrid(rows);
    const editing = grid.getPluginByName('editing');
    const p1 = rows[0];
    const c1 = p1.children![0];

    editing.beginBulkEdit(0);
    await settle();

    // The only parent comes back childless: Tree must still see the pinned p1 (with c1).
    grid.rows = [
      { id: 'p1', children: [] },
      { id: 'p2', a: 'x', b: 'y' },
    ];
    await settle();

    expect(grid._activeEditRows).toBe(0);
    expect(grid._rows[0]).toBe(p1);
    expect(grid._rows[1]).toBe(c1);
    expect(rowElOf(grid, p1)?.getAttribute('aria-level')).toBe('1');
    expect(rowElOf(grid, c1)?.getAttribute('aria-level')).toBe('2');
    expect(rowElOf(grid, p1)?.querySelectorAll('.cell.editing').length).toBe(2);
  });

  it('closes the editor when the replaced data no longer contains the nested row', async () => {
    const grid = await createGrid(makeRows());
    const editing = grid.getPluginByName('editing');

    editing.beginBulkEdit(1);
    await settle();

    grid.rows = [
      { id: 'p1', children: [{ id: 'c2', a: 'new', b: 'kid' }] },
      { id: 'p2', a: 'x', b: 'y' },
    ];
    await settle();

    expect(grid._activeEditRows).toBe(-1);
    expect(grid._rows[1].id).toBe('c2');
  });

  it('keeps the live editor off a sibling inserted before an edited nested row', async () => {
    const rows = makeRows();
    const grid = await createGrid(rows);
    const editing = grid.getPluginByName('editing');
    const child = rows[0].children![0];

    editing.beginBulkEdit(1);
    await settle();
    const input = typeDraft(grid, child, 'draft');

    const sibling: Row = { id: 'c0', a: 'sib', b: 'ling' };
    rows[0].children!.unshift(sibling);
    grid.requestRender();
    await settle();

    expect(grid._rows[2]).toBe(child);
    expect(grid._activeEditRows).toBe(2);
    expectEditorsOnlyOn(grid, child, 'draft', input);
  });

  it('keeps a top-level row editor on its row when a filter hides a row above it', async () => {
    const rows: Row[] = [
      { id: 'r1', a: 'hide', b: '1' },
      { id: 'r2', a: 'keep', b: '2' },
      { id: 'r3', a: 'keep', b: '3' },
    ];
    // `editing` listed BEFORE `filtering`: with equal priorities it used to run
    // first and keep the pre-filter index through reconciliation.
    const grid = await createGrid(rows, { editing: { mode: 'row' }, filtering: true });
    const r2 = rows[1];

    grid.getPluginByName('editing').beginBulkEdit(1);
    await settle();
    const input = typeDraft(grid, r2, 'draft');

    grid.getPluginByName('filtering').setFilter('a', { type: 'text', operator: 'equals', value: 'keep' });
    await settle();

    expect(grid._rows[0]).toBe(r2);
    expect(grid._activeEditRows).toBe(0);
    expectEditorsOnlyOn(grid, r2, 'draft', input);
  });

  it('still closes the editor when the nested row is removed from the data', async () => {
    const grid = await createGrid(makeRows());
    const editing = grid.getPluginByName('editing');

    editing.beginBulkEdit(1);
    await settle();
    expect(grid._activeEditRows).toBe(1);

    grid.rows = [
      { id: 'p1', children: [] },
      { id: 'p2', a: 'x', b: 'y' },
    ];
    await settle();

    expect(grid._activeEditRows).toBe(-1);
    expect(editorCount(grid)).toBe(0);
  });
});
