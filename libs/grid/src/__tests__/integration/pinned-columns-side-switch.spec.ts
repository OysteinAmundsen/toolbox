/**
 * PinnedColumnsPlugin: a column pinned to one side, then switched to the other (by pin value or
 * by text direction), ends up sticky on exactly ONE side (#619), and an unpinned column loses its
 * sticky styling even while other pins remain (#621), including a cell with an active editor,
 * which core skips in `afterCellRender` (PR #630).
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createGrid, stickySides, waitUpgrade } from '../../../test/helpers';
import '../../lib/core/grid';
import type { DataGridElement } from '../../lib/core/grid';
import { EditingPlugin } from '../../lib/plugins/editing/editing-plugin';
import { PinnedColumnsPlugin } from '../../lib/plugins/pinned-columns/pinned-columns-plugin';
import type { PinnedPosition } from '../../lib/plugins/pinned-columns/types';

async function setup(withEditing?: 'pinned-first' | 'editing-first') {
  const pinned = new PinnedColumnsPlugin();
  const editing = new EditingPlugin();
  const grid = createGrid();
  grid.gridConfig = {
    columns: ['c0', 'c1', 'c2', 'c3'].map((field) => ({ field, header: field, width: 100, editable: !!withEditing })),
    plugins: !withEditing ? [pinned] : withEditing === 'pinned-first' ? [pinned, editing] : [editing, pinned],
  };
  grid.rows = [{ c0: 1, c1: 2, c2: 3, c3: 4 }];
  await waitUpgrade(grid);
  return { grid, pinned, editing };
}

/** Sticky sides of the header and body cell of `field`. */
const sides = (grid: DataGridElement, field: string) => stickySides(grid, '.cell', field);

/** Body cell of `field` in the first data row. */
const bodyCell = (grid: DataGridElement, field: string) =>
  [...grid.querySelectorAll<HTMLElement>('.data-grid-row .cell[data-field]')].find(
    (c) => c.getAttribute('data-field') === field,
  )!;

describe('PinnedColumns side switch (#619)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it.each<[PinnedPosition, PinnedPosition, string]>([
    ['left', 'right', 'R0px'],
    ['right', 'left', 'L0px'],
  ])('re-pinning %s → %s leaves one sticky side', async (from, to, expected) => {
    const { grid, pinned } = await setup();
    pinned.setPinPosition('c1', from);
    await waitUpgrade(grid);

    pinned.setPinPosition('c1', to);
    await waitUpgrade(grid);

    expect(sides(grid, 'c1')).toEqual([expected, expected]);
  });

  it.each<[PinnedPosition, PinnedPosition, string]>([
    ['left', 'right', 'L0px'],
    ['right', 'left', 'R0px'],
  ])('re-pinning %s → %s never replays the old side before the re-measure', async (from, to, stale) => {
    const { grid, pinned } = await setup();
    pinned.setPinPosition('c1', from);
    await waitUpgrade(grid);

    // The core `render` event fires before PinnedColumns' post-render microtask re-measure.
    const seen: string[] = [];
    grid.addEventListener('render', () => seen.push(...stickySides(grid, '.data-grid-row .cell', 'c1')));
    pinned.setPinPosition('c1', to);
    await waitUpgrade(grid);

    expect(seen.length).toBeGreaterThan(0);
    expect(seen).not.toContain(stale);
  });

  it('unpinning while another pin remains clears the body cells (#621)', async () => {
    const { grid, pinned } = await setup();
    pinned.setPinPosition('c1', 'right');
    await waitUpgrade(grid);
    pinned.setPinPosition('c3', 'left');
    await waitUpgrade(grid);

    pinned.setPinPosition('c1', undefined);
    await waitUpgrade(grid);

    expect(sides(grid, 'c1')).toEqual(['-', '-']);
    const cell = bodyCell(grid, 'c1');
    expect([cell.style.position, cell.style.left, cell.style.right]).toEqual(['', '', '']);
    expect(sides(grid, 'c3')).toEqual(['L0px', 'L0px']);
  });

  it.each(['pinned-first', 'editing-first'] as const)(
    'unpinning a cell with an active editor clears its sticky styling and keeps the editor (%s)',
    async (order) => {
      const { grid, pinned, editing } = await setup(order);
      pinned.setPinPosition('c1', 'right');
      await waitUpgrade(grid);
      pinned.setPinPosition('c3', 'left');
      await waitUpgrade(grid);
      editing.beginCellEdit(0, 'c1');
      await waitUpgrade(grid);
      const editor = bodyCell(grid, 'c1').querySelector('input');
      expect(editor).not.toBeNull();

      pinned.setPinPosition('c1', undefined);
      await waitUpgrade(grid);

      const cell = bodyCell(grid, 'c1');
      expect(cell.querySelector('input')).toBe(editor);
      expect(sides(grid, 'c1')).toEqual(['-', '-']);
      expect([cell.style.position, cell.style.left, cell.style.right]).toEqual(['', '', '']);
    },
  );

  it('a logical pin follows a direction switch to one sticky side', async () => {
    const { grid, pinned } = await setup();
    pinned.setPinPosition('c1', 'start');
    await waitUpgrade(grid);

    grid.setAttribute('dir', 'rtl');
    grid.requestRender();
    await waitUpgrade(grid);

    expect(sides(grid, 'c1')).toEqual(['R0px', 'R0px']);
  });
});
