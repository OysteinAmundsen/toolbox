/**
 * PinnedColumnsPlugin: a column pinned to one side, then switched to the other (by pin value or
 * by text direction), ends up sticky on exactly ONE side (#619).
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createGrid, stickySides, waitUpgrade } from '../../../test/helpers';
import '../../lib/core/grid';
import type { DataGridElement } from '../../lib/core/grid';
import { PinnedColumnsPlugin } from '../../lib/plugins/pinned-columns/pinned-columns-plugin';
import type { PinnedPosition } from '../../lib/plugins/pinned-columns/types';

async function setup() {
  const pinned = new PinnedColumnsPlugin();
  const grid = createGrid();
  grid.gridConfig = {
    columns: ['c0', 'c1', 'c2', 'c3'].map((field) => ({ field, header: field, width: 100 })),
    plugins: [pinned],
  };
  grid.rows = [{ c0: 1, c1: 2, c2: 3, c3: 4 }];
  await waitUpgrade(grid);
  return { grid, pinned };
}

/** Sticky sides of the header and body cell of `field`. */
const sides = (grid: DataGridElement, field: string) => stickySides(grid, '.cell', field);

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
