import { afterEach, describe, expect, it } from 'vitest';
import '../../lib/core/grid';

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
    grid.columnState = state;
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
    grid.columnState = state;
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
    grid.columnState = state;
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
    grid.columnState = state;
    await nextFrame();

    // Columns should still be in same order
    const fields = grid._visibleColumns.map((c: any) => c.field);
    expect(fields).toEqual(['id', 'name', 'email']);

    // Width should be updated
    const emailCol = grid._visibleColumns.find((c: any) => c.field === 'email');
    expect(emailCol.width).toBe(300);
  }, 20000);
});
