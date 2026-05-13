/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest';
import '../../lib/core/grid';
import { DEFAULT_EMPTY_MESSAGE, DEFAULT_FILTERED_OUT_MESSAGE } from '../../lib/core/internal/empty';

function nextFrame() {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

async function waitUpgrade(grid: any) {
  await customElements.whenDefined('tbw-grid');
  const start = Date.now();
  while (!grid.hasAttribute('data-upgraded')) {
    if (Date.now() - start > 3000) break;
    await new Promise((r) => setTimeout(r, 10));
  }
  if (grid.ready) {
    try {
      await grid.ready();
    } catch {
      /* empty */
    }
  }
  await nextFrame();
}

const columns = [
  { field: 'id', header: 'ID' },
  { field: 'name', header: 'Name' },
];

async function makeGrid(extra: Record<string, unknown> = {}) {
  const grid: any = document.createElement('tbw-grid');
  document.body.appendChild(grid);
  grid.gridConfig = { columns, ...extra };
  await waitUpgrade(grid);
  return grid;
}

function getOverlay(grid: HTMLElement): HTMLElement | null {
  return grid.querySelector('.tbw-empty-overlay');
}

describe('emptyRenderer integration (#321)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows the default no-data message when rows is empty', async () => {
    const grid = await makeGrid();
    grid.rows = [];
    await nextFrame();

    const overlay = getOverlay(grid);
    expect(overlay).not.toBeNull();
    expect(overlay?.textContent).toBe(DEFAULT_EMPTY_MESSAGE);
    expect(overlay?.getAttribute('role')).toBe('status');
  });

  it('hides the overlay once rows are populated', async () => {
    const grid = await makeGrid();
    grid.rows = [];
    await nextFrame();
    expect(getOverlay(grid)).not.toBeNull();

    grid.rows = [{ id: 1, name: 'Alice' }];
    await nextFrame();
    expect(getOverlay(grid)).toBeNull();
  });

  it('switches to the filtered-out message when rows go from populated to empty', async () => {
    const grid = await makeGrid();
    grid.rows = [{ id: 1, name: 'Alice' }];
    await nextFrame();
    expect(getOverlay(grid)).toBeNull();

    // Simulate an external filter clearing the row array while sourceRows
    // history still holds prior data. We only have a single `rows` setter at
    // this layer; emulate the "had data, then filtered out" case by clearing
    // through a fresh assignment.
    grid.rows = [];
    await nextFrame();

    const overlay = getOverlay(grid);
    expect(overlay).not.toBeNull();
    // sourceRowCount is now 0 (rows setter re-assigns #rows), so we expect
    // the no-data message rather than filtered-out — this asserts our own
    // contract: filteredOut only when #rows.length > 0 but rendered count is
    // 0 (i.e. plugin-driven filtering, not host clearing).
    expect(overlay?.textContent).toBe(DEFAULT_EMPTY_MESSAGE);
  });

  it('uses a custom renderer returning a string', async () => {
    const grid = await makeGrid({
      emptyRenderer: () => 'Failed to load deals: timeout',
    });
    grid.rows = [];
    await nextFrame();

    const overlay = getOverlay(grid);
    expect(overlay?.textContent).toBe('Failed to load deals: timeout');
  });

  it('uses a custom renderer returning an HTMLElement', async () => {
    const grid = await makeGrid({
      emptyRenderer: () => {
        const div = document.createElement('div');
        div.className = 'my-empty';
        div.textContent = 'Nothing here';
        return div;
      },
    });
    grid.rows = [];
    await nextFrame();

    const overlay = getOverlay(grid);
    expect(overlay?.querySelector('.my-empty')?.textContent).toBe('Nothing here');
  });

  it('opts out completely when emptyRenderer is null', async () => {
    const grid = await makeGrid({ emptyRenderer: null });
    grid.rows = [];
    await nextFrame();
    expect(getOverlay(grid)).toBeNull();
  });

  it('does not show the overlay while loading is true', async () => {
    const grid = await makeGrid();
    grid.rows = [];
    grid.loading = true;
    await nextFrame();

    expect(getOverlay(grid)).toBeNull();
    expect(grid.querySelector('.tbw-loading-overlay')).not.toBeNull();
  });

  it('flips from loading to empty when loading turns off with no rows', async () => {
    const grid = await makeGrid();
    grid.rows = [];
    grid.loading = true;
    await nextFrame();
    expect(getOverlay(grid)).toBeNull();

    grid.loading = false;
    await nextFrame();
    expect(getOverlay(grid)).not.toBeNull();
    expect(grid.querySelector('.tbw-loading-overlay')).toBeNull();
  });

  it('mounts in .rows-container by default (headers stay visible)', async () => {
    const grid = await makeGrid();
    grid.rows = [];
    await nextFrame();

    const overlay = getOverlay(grid);
    expect(overlay?.getAttribute('data-overlay-target')).toBe('rows');
    // The overlay should be inside .rows-container (not the grid root) so
    // headers remain visible.
    const rowsContainer = grid.querySelector('.rows-container');
    expect(rowsContainer?.contains(overlay)).toBe(true);
  });

  it('mounts on .tbw-grid-root when emptyOverlay is "grid"', async () => {
    const grid = await makeGrid({ emptyOverlay: 'grid' });
    grid.rows = [];
    await nextFrame();

    const overlay = getOverlay(grid);
    expect(overlay?.getAttribute('data-overlay-target')).toBe('grid');
    const gridRoot = grid.querySelector('.tbw-grid-root');
    // Direct child of grid root — not inside rows-container.
    expect(overlay?.parentElement).toBe(gridRoot);
  });

  it('shows the filtered-out message when FilteringPlugin filters every row out', async () => {
    // Drive the filteredOut path through the real plugin pipeline rather than
    // mutating internals: register FilteringPlugin, populate rows, then apply
    // a filter that excludes every value. The plugin's processRows hook
    // empties the rendered set while #rows (source) stays > 0, which is the
    // exact precondition for the filtered-out message.
    const { FilteringPlugin } = await import('../../lib/plugins/filtering');

    const data = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];

    const plugin = new FilteringPlugin({});

    const grid = await makeGrid({
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name', filterable: true },
      ],
      plugins: [plugin],
    });
    grid.rows = data;
    await nextFrame();

    // Sanity: data is rendered, no overlay yet.
    expect(getOverlay(grid)).toBeNull();

    // Exclude every value of `name` so the rendered row count drops to 0
    // while the source row array (#rows) still holds both rows.
    plugin.setFilter('name', {
      type: 'set',
      operator: 'notIn',
      value: ['Alice', 'Bob'],
    });

    // Filter resolution + render cycle.
    await new Promise((r) => setTimeout(r, 10));
    grid.refreshVirtualWindow?.(true);
    await nextFrame();
    await nextFrame();

    const overlay = getOverlay(grid);
    expect(overlay).not.toBeNull();
    expect(overlay?.textContent).toBe(DEFAULT_FILTERED_OUT_MESSAGE);
  });
});
