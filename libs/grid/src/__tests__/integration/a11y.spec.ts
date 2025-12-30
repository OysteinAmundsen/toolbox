import { describe, expect, it } from 'vitest';
import '../../lib/core/grid';

function nextFrame() {
  return new Promise((r) => requestAnimationFrame(r));
}

describe('tbw-grid accessibility', () => {
  it('sets grid role and aria counts on inner grid element', async () => {
    const grid = document.createElement('tbw-grid') as any;
    grid.rows = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ];
    grid.columns = [{ field: 'id' }, { field: 'name' }];
    document.body.appendChild(grid);
    await nextFrame();
    // role="grid" is on inner .rows-body element (not host) to keep shell chrome outside grid semantics
    const innerGrid = grid.shadowRoot!.querySelector('.rows-body');
    expect(innerGrid?.getAttribute('role')).toBe('grid');
    // virtualization may update counts after frame
    await nextFrame();
    expect(Number(innerGrid?.getAttribute('aria-rowcount'))).toBe(2);
    expect(Number(innerGrid?.getAttribute('aria-colcount'))).toBe(2);
  });

  it('header cells have columnheader role', async () => {
    const grid = document.createElement('tbw-grid') as any;
    grid.rows = [{ id: 1 }];
    grid.columns = [{ field: 'id' }];
    document.body.appendChild(grid);
    await nextFrame();
    const headerCell = grid.shadowRoot!.querySelector('.header-row .cell');
    expect(headerCell?.getAttribute('role')).toBe('columnheader');
  });

  it('focusable host for keyboard nav', async () => {
    const grid = document.createElement('tbw-grid') as any;
    document.body.appendChild(grid);
    await nextFrame();
    const tabindex = grid.getAttribute('tabindex');
    expect(tabindex === '0' || tabindex === '1').toBe(true);
  });

  it('sortable headers expose baseline aria-sort and update through cycle', async () => {
    const grid = document.createElement('tbw-grid') as any;
    grid.rows = [{ id: 2 }, { id: 1 }];
    grid.columns = [{ field: 'id', sortable: true }];
    document.body.appendChild(grid);
    if (typeof grid.ready === 'function') await grid.ready();

    // Poll until header cell present (accounts for async setup + virtualization)
    const waitForHeader = async (): Promise<HTMLElement> => {
      for (let i = 0; i < 12; i++) {
        await nextFrame();
        const h = grid.shadowRoot!.querySelector('.header-row .cell.sortable[data-field="id"]') as HTMLElement | null;
        if (h) return h;
      }
      throw new Error('Header cell not rendered in time');
    };

    let header = await waitForHeader();
    expect(header.getAttribute('aria-sort')).toBe('none');

    header.click();
    await nextFrame();
    await nextFrame();
    header = await waitForHeader();
    expect(header.getAttribute('aria-sort')).toBe('ascending');

    header.click();
    await nextFrame();
    await nextFrame();
    header = await waitForHeader();
    expect(header.getAttribute('aria-sort')).toBe('descending');

    header.click();
    await nextFrame();
    await nextFrame();
    header = await waitForHeader();
    expect(header.getAttribute('aria-sort')).toBe('none');
  });

  it('boolean cells use checkbox semantics and toggle state', async () => {
    const grid = document.createElement('tbw-grid') as any;
    grid.rows = [{ ok: false }];
    grid.columns = [{ field: 'ok', type: 'boolean', editable: true }];
    document.body.appendChild(grid);
    await grid.ready?.();
    await nextFrame();
    await nextFrame();
    const cell = grid.shadowRoot!.querySelector('.data-grid-row .cell') as HTMLElement;
    // Checkbox semantics are on inner span (cell remains gridcell for ARIA compliance)
    const checkboxEl = cell.querySelector('[role="checkbox"]') as HTMLElement | null;
    expect(checkboxEl).toBeTruthy();
    expect(checkboxEl?.getAttribute('aria-checked')).toBe('false');
    cell.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await nextFrame();
    await nextFrame();
    const updatedCheckboxEl = cell.querySelector('[role="checkbox"]') as HTMLElement | null;
    expect(updatedCheckboxEl?.getAttribute('aria-checked')).toBe('true');
  });

  it('focused cell gains aria-selected', async () => {
    const grid = document.createElement('tbw-grid') as any;
    grid.rows = [{ id: 1, name: 'A' }];
    grid.columns = [{ field: 'id' }, { field: 'name' }];
    document.body.appendChild(grid);
    await nextFrame();
    await nextFrame();
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await nextFrame();
    await nextFrame();
    const selected = grid.shadowRoot!.querySelector('[aria-selected="true"]');
    expect(selected).toBeTruthy();
  });
});
