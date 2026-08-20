import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DataGridElement } from '../../lib/core/grid';

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

describe('tiny dataset virtualization bypass', () => {
  beforeEach(() => {
    // Ensure custom element is defined
    if (!customElements.get('tbw-grid')) {
      customElements.define('tbw-grid', DataGridElement);
    }
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders all rows without translateY offset when below heuristic threshold', async () => {
    const grid = document.createElement('tbw-grid') as DataGridElement;
    grid.style.display = 'block';
    grid.style.height = '300px';

    // Set columns and rows programmatically for vanilla TS component
    grid.columns = [
      { field: 'id', header: 'ID', sortable: true },
      { field: 'name', header: 'Name' },
    ];
    const rows = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }));
    grid.rows = rows;
    document.body.appendChild(grid);

    await grid.ready();

    // Allow a couple of frames for any pending autosize / layout
    await nextFrame();
    await nextFrame();

    const shadow = grid;
    const rowsContainer = shadow.querySelector('.rows') as HTMLElement;
    const renderedRows = shadow.querySelectorAll('.rows .data-grid-row');

    // Heuristic should bypass virtualization -> all rows rendered, transform either empty or translateY(0px)
    expect(renderedRows.length).toBe(rows.length);
    const transform = rowsContainer.style.transform || '';
    expect(transform === '' || transform === 'translateY(0px)').toBe(true);

    // aria-rowcount/colcount are on inner .rows-body (role=grid), not host element
    const innerGrid = shadow.querySelector('.rows-body');
    expect(innerGrid?.getAttribute('aria-rowcount')).toBe(String(rows.length));
    expect(innerGrid?.getAttribute('aria-colcount')).toBe('2');
  });

  it('preserves the scroll offset when a forced refresh happens while scrolled', async () => {
    const grid = document.createElement('tbw-grid') as DataGridElement;
    grid.style.display = 'block';
    grid.style.height = '100px';

    grid.columns = [
      { field: 'id', header: 'ID' },
      { field: 'name', header: 'Name' },
    ];
    grid.rows = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }));
    document.body.appendChild(grid);

    await grid.ready();
    await nextFrame();

    const faux = grid.querySelector('.faux-vscroll') as HTMLElement;
    const rowsContainer = grid.querySelector('.rows') as HTMLElement;
    expect(faux).not.toBeNull();

    // Simulate the user having scrolled the faux scrollbar down.
    faux.scrollTop = 120;

    // A forced re-render (what the viewport ResizeObserver and refreshColumns()
    // trigger) must re-apply the live scroll offset. Resetting to translateY(0)
    // desyncs the rows from the scrollbar and strands the bottom rows.
    grid.refreshVirtualWindow(true);

    expect(rowsContainer.style.transform).toBe('translateY(-120px)');
  });

  it('reports no window change on a non-force bypass render', async () => {
    const grid = document.createElement('tbw-grid') as DataGridElement;
    grid.style.display = 'block';
    grid.style.height = '100px';

    grid.columns = [{ field: 'id', header: 'ID' }];
    grid.rows = Array.from({ length: 20 }, (_, i) => ({ id: i + 1 }));
    document.body.appendChild(grid);

    await grid.ready();
    await nextFrame();

    // Bypass renders every row, so the window never changes on scroll. Claiming a
    // change makes #onScrollBatched re-run plugin onScrollRender() every frame.
    expect(grid.refreshVirtualWindow(false)).toBe(false);
    expect(grid.refreshVirtualWindow(true)).toBe(true);
  });
});
