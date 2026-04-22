import { afterEach, describe, expect, it } from 'vitest';
import '../../lib/core/grid';
import { MultiSortPlugin } from '../../lib/plugins/multi-sort/MultiSortPlugin';

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

describe('columnState width-only fast path', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('width-only change updates CSS template without bumping row render epoch', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.appendChild(grid);
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', width: 80 },
        { field: 'name', header: 'Name', width: 120 },
      ],
      fitMode: 'fixed',
    };
    grid.rows = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
    await waitUpgrade(grid);

    const epochBefore = grid.__rowRenderEpoch;

    // Apply width-only change via columnState
    const state = grid.getColumnState();
    state.columns[0].width = 200;
    grid.applyColumnState(state);
    await nextFrame();

    // Epoch should NOT have been bumped (no full row rebuild)
    expect(grid.__rowRenderEpoch).toBe(epochBefore);

    // CSS template should reflect the new width
    const template = grid.style.getPropertyValue('--tbw-column-template');
    expect(template).toContain('200px');
  }, 20000);

  it('visibility change falls back to full setup (bumps epoch)', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.appendChild(grid);
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', width: 80 },
        { field: 'name', header: 'Name', width: 120 },
      ],
      fitMode: 'fixed',
    };
    grid.rows = [{ id: 1, name: 'Alice' }];
    await waitUpgrade(grid);

    const epochBefore = grid.__rowRenderEpoch;

    // Hide a column via columnState
    const state = grid.getColumnState();
    state.columns[1].visible = false;
    grid.applyColumnState(state);
    await nextFrame();

    // Epoch SHOULD have been bumped (structural change)
    expect(grid.__rowRenderEpoch).toBeGreaterThan(epochBefore);
  }, 20000);

  it('order change falls back to full setup', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.appendChild(grid);
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', width: 80 },
        { field: 'name', header: 'Name', width: 120 },
      ],
      fitMode: 'fixed',
    };
    grid.rows = [{ id: 1, name: 'Alice' }];
    await waitUpgrade(grid);

    const epochBefore = grid.__rowRenderEpoch;

    // Reorder columns
    const state = grid.getColumnState();
    state.columns[0].order = 1;
    state.columns[1].order = 0;
    grid.applyColumnState(state);
    await nextFrame();

    // Epoch SHOULD have been bumped (structural change)
    expect(grid.__rowRenderEpoch).toBeGreaterThan(epochBefore);
  }, 20000);

  it('width-only change preserves column order and visibility', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.appendChild(grid);
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', width: 80 },
        { field: 'name', header: 'Name', width: 120 },
        { field: 'email', header: 'Email', width: 150 },
      ],
      fitMode: 'fixed',
    };
    grid.rows = [{ id: 1, name: 'Alice', email: 'a@b.c' }];
    await waitUpgrade(grid);

    // Apply width change only
    const state = grid.getColumnState();
    state.columns[2].width = 300;
    grid.applyColumnState(state);
    await nextFrame();

    // Columns should still be in same order
    const fields = grid._visibleColumns.map((c: any) => c.field);
    expect(fields).toEqual(['id', 'name', 'email']);

    // Width should be updated
    const emailCol = grid._visibleColumns.find((c: any) => c.field === 'email');
    expect(emailCol.width).toBe(300);
  }, 20000);

  it('exposes applyColumnState() as a public method (mirrors columnState setter)', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.appendChild(grid);
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', width: 80 },
        { field: 'name', header: 'Name', width: 120 },
      ],
      fitMode: 'fixed',
    };
    grid.rows = [{ id: 1, name: 'Alice' }];
    await waitUpgrade(grid);

    expect(typeof grid.applyColumnState).toBe('function');

    const state = grid.getColumnState();
    state.columns[0].width = 250;
    grid.applyColumnState(state);
    await nextFrame();

    const idCol = grid._visibleColumns.find((c: any) => c.field === 'id');
    expect(idCol.width).toBe(250);
  }, 20000);

  it('applying state with sort entries restores plugin sort and re-sorts rows', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.appendChild(grid);
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', width: 80, sortable: true },
        { field: 'name', header: 'Name', width: 120, sortable: true },
      ],
      fitMode: 'fixed',
      plugins: [new MultiSortPlugin()],
    };
    grid.rows = [
      { id: 2, name: 'Bob' },
      { id: 1, name: 'Alice' },
      { id: 3, name: 'Charlie' },
    ];
    await waitUpgrade(grid);

    // Apply state that asks for ascending sort on `id`.
    const state = grid.getColumnState();
    state.columns[0].sort = { direction: 'asc', priority: 0 };
    grid.applyColumnState(state);
    await nextFrame();

    // Behavioral assertion: processed rows are in ascending id order.
    // `_rows` is the output of processRows() — the data path MultiSortPlugin
    // sorts. If the fast path skips processRows when it shouldn't, this array
    // stays in input order [2, 1, 3].
    const visibleIds = grid._rows.map((r: any) => r.id);
    expect(visibleIds).toEqual([1, 2, 3]);
  }, 20000);

  it('applying state that clears sort empties the plugin model and broadcasts the change', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.appendChild(grid);
    const sortPlugin = new MultiSortPlugin();
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', width: 80, sortable: true },
        { field: 'name', header: 'Name', width: 120, sortable: true },
      ],
      fitMode: 'fixed',
      plugins: [sortPlugin],
    };
    grid.rows = [
      { id: 2, name: 'Bob' },
      { id: 1, name: 'Alice' },
      { id: 3, name: 'Charlie' },
    ];
    await waitUpgrade(grid);

    // First apply a sort — plugin model becomes non-empty.
    const sortedState = grid.getColumnState();
    sortedState.columns[0].sort = { direction: 'asc', priority: 0 };
    grid.applyColumnState(sortedState);
    await nextFrame();
    expect(sortPlugin.sortModel.length).toBe(1);

    // Listen for the sort-change broadcast that fires after sort clears.
    const sortChangeEvents: any[] = [];
    grid.addEventListener('sort-change', (e: any) => sortChangeEvents.push(e.detail));

    // Apply state with no sort entries — sort must clear.
    const clearedState = grid.getColumnState();
    clearedState.columns.forEach((c: any) => delete c.sort);
    grid.applyColumnState(clearedState);
    await nextFrame();

    // Behavioral assertions that this PR's fix guarantees:
    //  1. The plugin's sort model is now empty.
    //  2. Exactly one batched sort-change event fired with the empty model
    //     (proves `requestRender()` path ran: the plugin's microtask both
    //     broadcasts and requests a render — they're emitted together).
    expect(sortPlugin.sortModel).toEqual([]);
    expect(sortChangeEvents).toHaveLength(1);
    expect(sortChangeEvents[0].sortModel).toEqual([]);
  }, 20000);

  it('reassigning columns after applyColumnState resets to defaults on the first attempt', async () => {
    // Regression: after applyColumnState() on an initialized grid, the saved
    // state was stored in #initialColumnState and re-applied by the next
    // #setup() (triggered by `grid.columns = [...]`), making the first reset
    // appear to be a no-op. The reset only worked on the second click because
    // #setup() cleared the stale state during the first (silent) re-application.
    const defaultColumns = [
      { field: 'id', header: 'ID', width: 60 },
      { field: 'name', header: 'Name', width: 160 },
    ];

    const grid: any = document.createElement('tbw-grid');
    document.body.appendChild(grid);
    grid.columns = defaultColumns;
    grid.rows = [{ id: 1, name: 'Alice' }];
    await waitUpgrade(grid);

    // Capture initial state, then simulate user resize by applying a width-changed state.
    const savedState = grid.getColumnState();
    savedState.columns[0].width = 200;
    grid.applyColumnState(savedState);
    await nextFrame();
    expect(grid._visibleColumns.find((c: any) => c.field === 'id').width).toBe(200);

    // First reset — must restore the default 60px width.
    grid.columns = [...defaultColumns];
    await nextFrame();
    expect(grid._visibleColumns.find((c: any) => c.field === 'id').width).toBe(60);
  }, 20000);
});
