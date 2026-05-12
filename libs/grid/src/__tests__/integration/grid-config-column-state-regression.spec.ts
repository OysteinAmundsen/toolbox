/**
 * @vitest-environment happy-dom
 */
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

describe('gridConfig re-assignment preserves runtime column visibility', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps col.hidden set by applyColumnState when gridConfig is re-assigned with a new reference', async () => {
    // Regression:
    // After several filter/refetch cycles, the user-facing memoized
    // `gridConfig` ref can be rebuilt (e.g. when a React Query-backed
    // dependency refetches and returns a new data ref). When the new
    // `gridConfig.columnState` declares the same hidden columns as the
    // previously-applied state, the grid loses the hidden state because
    // `#applyGridConfigUpdate` rebuilds `effectiveConfig.columns` from the
    // unmutated source and never consumes the freshly-populated
    // `#initialColumnState`, leaving every column visible.
    const grid: any = document.createElement('tbw-grid');
    document.body.appendChild(grid);

    const columns = [
      { field: 'id', header: 'ID' },
      { field: 'name', header: 'Name' },
      { field: 'age', header: 'Age' },
    ];
    const savedState = {
      columns: [
        { field: 'id', order: 0, visible: true },
        { field: 'name', order: 1, visible: true },
        { field: 'age', order: 2, visible: false },
      ],
    };

    grid.gridConfig = { columns, columnState: savedState };
    grid.rows = [{ id: 1, name: 'Alice', age: 30 }];
    await waitUpgrade(grid);

    // Imperative apply (mirrors the cargo-list `useEffect` that re-applies
    // the saved state after every fetch).
    grid.applyColumnState(savedState);
    await nextFrame();

    expect(grid.columnState.columns.find((c: any) => c.field === 'age').visible).toBe(false);

    // Now re-assign gridConfig with a NEW reference but the same content.
    // This simulates a parent re-memoization (e.g. baseColumns rebuilt
    // because a React Query data ref changed).
    grid.gridConfig = {
      columns: columns.map((c) => ({ ...c })),
      columnState: savedState,
    };
    await nextFrame();
    await nextFrame();

    // The 'age' column must still be hidden — the new gridConfig also says so.
    const ageState = grid.columnState.columns.find((c: any) => c.field === 'age');
    expect(ageState.visible).toBe(false);
  }, 20000);

  it('reapplies core sort when gridConfig is re-assigned with a different columnState sort', async () => {
    // Validates that the #applyGridConfigUpdate path runs the core sort
    // pipeline (not just the indicators) when consuming #initialColumnState.
    // Uses core sort only — no MultiSortPlugin imported — to isolate the
    // core sort code path.
    const grid: any = document.createElement('tbw-grid');
    document.body.appendChild(grid);

    const columns = [
      { field: 'name', header: 'Name' },
      { field: 'age', header: 'Age' },
    ];
    const rows = [
      { name: 'Charlie', age: 30 },
      { name: 'Alice', age: 50 },
      { name: 'Bob', age: 20 },
    ];

    grid.gridConfig = { columns };
    grid.rows = rows;
    await waitUpgrade(grid);

    // Re-assign gridConfig with a columnState that introduces an age-desc sort.
    grid.gridConfig = {
      columns: columns.map((c) => ({ ...c })),
      columnState: {
        columns: [
          { field: 'name', order: 0, visible: true },
          { field: 'age', order: 1, visible: true, sort: { direction: 'desc', priority: 0 } },
        ],
      },
    };
    await nextFrame();
    await nextFrame();

    // _rows must be in age-desc order (50, 30, 20) — not the input order
    // and not just the indicator updated.
    const ages = grid._rows.map((r: any) => r.age);
    expect(ages).toEqual([50, 30, 20]);
  }, 20000);
});
