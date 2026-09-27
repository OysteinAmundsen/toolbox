/**
 * SelectionPlugin × core Ctrl/Cmd+Arrow long-jump.
 *
 * Core moves focus to the grid edge; SelectionPlugin's existing pending-update
 * path turns Shift+Ctrl/Cmd+Arrow into "extend selection to the edge".
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SelectionPlugin } from './selection-plugin';

async function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function waitUpgrade(el: HTMLElement & { ready?: () => Promise<void> }): Promise<void> {
  await customElements.whenDefined('tbw-grid');
  await el.ready?.();
  await nextFrame();
  await nextFrame();
}

function press(grid: HTMLElement, key: string, init: KeyboardEventInit = {}): void {
  grid.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
}

const columns = [
  { field: 'a', header: 'A' },
  { field: 'b', header: 'B' },
  { field: 'c', header: 'C' },
];
const rows = Array.from({ length: 6 }, (_, i) => ({ a: i, b: i * 10, c: i * 100 }));

describe('Selection × Ctrl/Cmd+Arrow long-jump', () => {
  let grid: any;

  beforeEach(async () => {
    await import('../../core/grid');
    document.body.innerHTML = '';
    grid = document.createElement('tbw-grid');
    document.body.appendChild(grid);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('range mode: Shift+Ctrl+ArrowDown extends the range from the anchor to the last row', async () => {
    const plugin = new SelectionPlugin({ mode: 'range' });
    grid.gridConfig = { columns, plugins: [plugin] };
    grid.rows = rows;
    await waitUpgrade(grid);

    grid._focusRow = 1;
    grid._focusCol = 1;
    press(grid, 'ArrowDown', { shiftKey: true, ctrlKey: true });
    await nextFrame();
    await nextFrame();

    expect(grid._focusRow).toBe(5);
    expect(plugin.getSelection().ranges).toEqual([{ from: { row: 1, col: 1 }, to: { row: 5, col: 1 } }]);
  });

  it('range mode: Shift+Cmd+ArrowRight extends the range to the last column', async () => {
    const plugin = new SelectionPlugin({ mode: 'range' });
    grid.gridConfig = { columns, plugins: [plugin] };
    grid.rows = rows;
    await waitUpgrade(grid);

    grid._focusRow = 2;
    grid._focusCol = 0;
    press(grid, 'ArrowRight', { shiftKey: true, metaKey: true });
    await nextFrame();
    await nextFrame();

    expect(grid._focusCol).toBe(2);
    expect(plugin.getSelection().ranges).toEqual([{ from: { row: 2, col: 0 }, to: { row: 2, col: 2 } }]);
  });

  it('row mode: Shift+Ctrl+ArrowUp selects every row from the anchor to the first row', async () => {
    const plugin = new SelectionPlugin({ mode: 'row' });
    grid.gridConfig = { columns, plugins: [plugin] };
    grid.rows = rows;
    await waitUpgrade(grid);

    grid._focusRow = 3;
    press(grid, 'ArrowUp', { shiftKey: true, ctrlKey: true });
    await nextFrame();
    await nextFrame();

    expect(grid._focusRow).toBe(0);
    expect(plugin.getSelectedRowIndices()).toEqual([0, 1, 2, 3]);
  });
});
