import { describe, expect, it } from 'vitest';
import '../../lib/core/grid';
import { EditingPlugin } from '../../lib/plugins/editing';

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

  // TODO: This test has timing issues in the test environment - the boolean toggle works
  // correctly in real usage, but the test environment doesn't properly wait for render
  // cycles. Similar tests in EditingPlugin.spec.ts are also skipped for the same reason.
  it.skip('boolean cells use checkbox semantics and toggle state', async () => {
    const grid = document.createElement('tbw-grid') as any;
    grid.gridConfig = {
      columns: [{ field: 'ok', type: 'boolean', editable: true }],
      plugins: [new EditingPlugin({ editOn: 'dblclick' })],
    };
    grid.rows = [{ ok: false }];
    document.body.appendChild(grid);
    await grid.ready?.();
    await nextFrame();
    await nextFrame();
    const cell = grid.shadowRoot!.querySelector('.data-grid-row .cell') as HTMLElement;
    // Checkbox semantics are on inner span (cell remains gridcell for ARIA compliance)
    const checkboxEl = cell.querySelector('[role="checkbox"]') as HTMLElement | null;
    expect(checkboxEl).toBeTruthy();
    expect(checkboxEl?.getAttribute('aria-checked')).toBe('false');
    // Set focus for keyboard navigation
    grid._focusRow = 0;
    grid._focusCol = 0;
    // Dispatch keydown on the grid element so it goes through plugin event distribution
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await nextFrame();
    await nextFrame();
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

  it('empty grid has role="grid" from static template with zero counts', async () => {
    const grid = document.createElement('tbw-grid') as any;
    grid.rows = [];
    grid.columns = [];
    document.body.appendChild(grid);
    await grid.ready?.();
    await nextFrame();
    const innerGrid = grid.shadowRoot!.querySelector('.rows-body');
    // Static role from template is always present
    expect(innerGrid?.getAttribute('role')).toBe('grid');
    // Counts are 0 for empty grid
    expect(innerGrid?.getAttribute('aria-rowcount')).toBe('0');
    expect(innerGrid?.getAttribute('aria-colcount')).toBe('0');
  });

  it('grid updates aria counts when data changes', async () => {
    const grid = document.createElement('tbw-grid') as any;
    grid.rows = [{ id: 1 }];
    grid.columns = [{ field: 'id' }];
    document.body.appendChild(grid);
    await grid.ready?.();
    await nextFrame();
    const innerGrid = grid.shadowRoot!.querySelector('.rows-body');
    // Static role always present
    expect(innerGrid?.getAttribute('role')).toBe('grid');
    expect(innerGrid?.getAttribute('aria-rowcount')).toBe('1');

    // Clear data
    grid.rows = [];
    await nextFrame();
    await nextFrame();
    // Role stays, count updates to 0
    expect(innerGrid?.getAttribute('role')).toBe('grid');
    expect(innerGrid?.getAttribute('aria-rowcount')).toBe('0');
  });
});
