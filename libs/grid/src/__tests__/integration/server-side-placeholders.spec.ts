/**
 * Integration tests: ServerSide loading placeholders use the core row-loading
 * state and never reach consumer callbacks (issue #508).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import '../../index';
import '../../lib/features/context-menu';
import '../../lib/features/editing';
import '../../lib/features/filtering';
import '../../lib/features/multi-sort';
import '../../lib/features/responsive';
import '../../lib/features/server-side';
import '../../lib/features/tree';
import { BaseGridPlugin } from '../../lib/core/plugin';
import { isLoadingPlaceholder } from '../../lib/plugins/server-side';
import type { GetRowsParams, GetRowsResult, ServerSideConfig } from '../../lib/plugins/server-side';

interface Row {
  id: number;
  name: string;
}

const TOTAL = 10;

/** Data source whose blocks resolve only when the test calls `flush()`. */
function createDeferredDataSource() {
  const pending: Array<{ params: GetRowsParams; resolve: (r: GetRowsResult) => void }> = [];
  const getRows = vi.fn(
    (params: GetRowsParams) =>
      new Promise<GetRowsResult>((resolve) => {
        pending.push({ params, resolve });
      }),
  );
  const flush = () => {
    for (const { params, resolve } of pending.splice(0)) {
      const rows: Row[] = [];
      for (let i = params.startNode; i < Math.min(params.endNode, TOTAL); i++) rows.push({ id: i, name: `Row ${i}` });
      resolve({ rows, totalNodeCount: TOTAL });
    }
  };
  return { dataSource: { getRows }, flush, pending };
}

async function createServerSideGrid(serverSide: Partial<ServerSideConfig>, extra: Record<string, unknown> = {}) {
  const ds = createDeferredDataSource();
  const seen = { getRowId: [] as unknown[], renderer: [] as unknown[], rowClass: [] as unknown[] };
  const { features: extraFeatures, ...extraConfig } = extra as { features?: Record<string, unknown> };
  const grid = document.createElement('tbw-grid') as any;
  grid.gridConfig = {
    columns: [
      {
        field: 'name',
        header: 'Name',
        renderer: ({ row }: { row: unknown }) => {
          seen.renderer.push(row);
          return (row as Row).name ?? '';
        },
      },
      { field: 'id', header: 'Id' },
    ],
    getRowId: (row: Row) => {
      seen.getRowId.push(row);
      return String(row.id);
    },
    rowClass: (row: Row) => {
      seen.rowClass.push(row);
      return [];
    },
    features: { serverSide: { pageSize: 5, dataSource: ds.dataSource, ...serverSide }, ...extraFeatures },
    ...extraConfig,
  };
  document.body.appendChild(grid);
  await grid.ready();
  return { grid, ds, seen };
}

/** Resolve block 0, then wait until rows 5–9 render as placeholders. */
async function loadFirstBlock(grid: any, ds: ReturnType<typeof createDeferredDataSource>) {
  await vi.waitFor(() => expect(ds.pending.length).toBeGreaterThan(0));
  ds.flush();
  await vi.waitFor(() => expect(grid._rows.length).toBe(TOTAL));
  await vi.waitFor(() => expect(grid.querySelector('.data-grid-row.tbw-row-loading')).not.toBeNull());
}

const placeholderRows = (grid: HTMLElement) => [...grid.querySelectorAll('.data-grid-row.tbw-row-loading')];

describe('ServerSide loading placeholders (#508)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders placeholders with the core row-loading state', async () => {
    const { grid, ds } = await createServerSideGrid({ maxConcurrentRequests: 1 });
    await loadFirstBlock(grid, ds);

    const loading = placeholderRows(grid);
    expect(loading.length).toBeGreaterThan(0);
    for (const rowEl of loading) {
      expect(rowEl.getAttribute('aria-busy')).toBe('true');
      expect(rowEl.querySelector('.tbw-row-loading-overlay .tbw-row-loading-spinner')).not.toBeNull();
      // One full-width cell, not a cell per column.
      expect(rowEl.querySelectorAll('.cell').length).toBe(1);
    }
  });

  it('never passes placeholders to getRowId, cell renderers or rowClass', async () => {
    const { grid, ds, seen } = await createServerSideGrid({ maxConcurrentRequests: 1 });
    await loadFirstBlock(grid, ds);

    expect(seen.renderer.length).toBeGreaterThan(0);
    expect(seen.renderer.some(isLoadingPlaceholder)).toBe(false);
    expect(seen.rowClass.some(isLoadingPlaceholder)).toBe(false);
    expect(seen.getRowId.some(isLoadingPlaceholder)).toBe(false);

    // Placeholders still resolve to a stable internal id.
    const placeholder = grid._rows.find(isLoadingPlaceholder);
    expect(grid.getRowId(placeholder)).toBe(`__loading:${placeholder.__index}`);
  });

  it('clears the loading state when the block arrives', async () => {
    const { grid, ds } = await createServerSideGrid({ maxConcurrentRequests: 1 });
    await loadFirstBlock(grid, ds);

    await vi.waitFor(() => expect(ds.pending.length).toBeGreaterThan(0));
    ds.flush();

    await vi.waitFor(() => expect(grid._rows.some(isLoadingPlaceholder)).toBe(false));
    await vi.waitFor(() => expect(placeholderRows(grid)).toHaveLength(0));
    expect(grid.querySelector('.data-grid-row[aria-busy]')).toBeNull();
    expect(grid.querySelector('.tbw-row-loading-overlay')).toBeNull();
  });

  it('rebuilds the row when a single-column grid swaps a placeholder for data', async () => {
    const { grid, ds } = await createServerSideGrid(
      { maxConcurrentRequests: 1 },
      { columns: [{ field: 'name', header: 'Name' }] },
    );
    await loadFirstBlock(grid, ds);

    await vi.waitFor(() => expect(ds.pending.length).toBeGreaterThan(0));
    ds.flush();

    await vi.waitFor(() => expect(placeholderRows(grid)).toHaveLength(0));
    const cells = [...grid.querySelectorAll('.data-grid-row .cell[data-col="0"]')].map((c) => c.textContent);
    expect(cells).toContain('Row 9');
  });

  it("placeholderRendering: 'columns' passes placeholders to consumer renderers", async () => {
    const { grid, ds, seen } = await createServerSideGrid({
      maxConcurrentRequests: 1,
      placeholderRendering: 'columns',
    });
    await vi.waitFor(() => expect(ds.pending.length).toBeGreaterThan(0));
    ds.flush();
    await vi.waitFor(() => expect(seen.renderer.some(isLoadingPlaceholder)).toBe(true));

    expect(placeholderRows(grid)).toHaveLength(0);
    // The stable internal id still applies in this mode.
    expect(seen.getRowId.some(isLoadingPlaceholder)).toBe(false);
  });
});

/** A column whose accessor and filter extractor throw on any row without a `name` — i.e. a placeholder. */
function upperColumn(spies: { accessor: ReturnType<typeof vi.fn>; filterValue?: ReturnType<typeof vi.fn> }) {
  return {
    field: 'upper',
    header: 'Upper',
    sortable: true,
    valueAccessor: spies.accessor,
    ...(spies.filterValue ? { filterValue: spies.filterValue } : {}),
  };
}
const throwingAccessor = () => vi.fn(({ row }: { row: Row }) => row.name.toUpperCase());
const sawPlaceholder = (spy: ReturnType<typeof vi.fn>, argIndex: number, pick: (arg: any) => unknown) =>
  spy.mock.calls.some((call) => isLoadingPlaceholder(pick(call[argIndex])));

describe('ServerSide placeholders never reach value extractors while a block is pending (PR #511)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it("core sort under sortMode: 'local' pins placeholders without calling the accessor on them", async () => {
    const accessor = throwingAccessor();
    const { grid, ds } = await createServerSideGrid(
      { maxConcurrentRequests: 1, sortMode: 'local' },
      { columns: [upperColumn({ accessor }), { field: 'name', header: 'Name' }] },
    );
    await loadFirstBlock(grid, ds);
    expect(ds.pending.length).toBeGreaterThan(0); // block 1 is still in flight

    grid.sort('upper', 'desc');

    await vi.waitFor(() => expect(grid._rows[0]?.name).toBe('Row 4'));
    expect(grid._rows.slice(5).every(isLoadingPlaceholder)).toBe(true);
    expect(sawPlaceholder(accessor, 0, (ctx) => ctx.row)).toBe(false);
  });

  it("MultiSort under sortMode: 'local' extracts keys without calling the accessor on placeholders", async () => {
    const accessor = throwingAccessor();
    const { grid, ds } = await createServerSideGrid(
      { maxConcurrentRequests: 1, sortMode: 'local' },
      { columns: [upperColumn({ accessor }), { field: 'name', header: 'Name' }], features: { multiSort: true } },
    );
    await loadFirstBlock(grid, ds);

    grid.getPluginByName('multiSort').setSortModel([{ field: 'upper', direction: 'desc' }]);

    await vi.waitFor(() => expect(grid._rows[0]?.name).toBe('Row 4'));
    expect(grid._rows.slice(5).every(isLoadingPlaceholder)).toBe(true);
    expect(sawPlaceholder(accessor, 0, (ctx) => ctx.row)).toBe(false);
  });

  it("filterMode: 'local' calls neither valueAccessor nor filterValue on placeholders", async () => {
    const accessor = throwingAccessor();
    const filterValue = vi.fn((_v: unknown, row: Row) => row.name.toLowerCase());
    const { grid, ds } = await createServerSideGrid(
      { maxConcurrentRequests: 1, filterMode: 'local' },
      {
        columns: [upperColumn({ accessor }), { field: 'name', header: 'Name', filterValue }],
        features: { filtering: true },
      },
    );
    await loadFirstBlock(grid, ds);
    const filtering = grid.getPluginByName('filtering');

    filtering.setFilter('upper', { type: 'text', operator: 'contains', value: 'ROW 1' });
    await vi.waitFor(() => expect(grid._rows.map((r: Row) => r.name)).toEqual(['Row 1']));
    filtering.setFilter('upper', null);
    filtering.setFilter('name', { type: 'text', operator: 'contains', value: 'row 2' });
    await vi.waitFor(() => expect(grid._rows.map((r: Row) => r.name)).toEqual(['Row 2']));

    expect(sawPlaceholder(accessor, 0, (ctx) => ctx.row)).toBe(false);
    expect(filterValue).toHaveBeenCalled();
    expect(sawPlaceholder(filterValue, 1, (row) => row)).toBe(false);
  });
});

describe('ServerSide placeholders hand over cleanly to other row renderers (PR #511)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  /** Stand-in for Responsive's `cardRenderer`: replaces children and className, nothing else. */
  class CardRowPlugin extends BaseGridPlugin {
    readonly name = 'cardRowTest';
    override renderRow(row: unknown, rowEl: HTMLElement): boolean {
      if (isLoadingPlaceholder(row)) return false;
      rowEl.replaceChildren();
      rowEl.className = 'data-grid-row card';
      const card = document.createElement('div');
      card.setAttribute('role', 'gridcell');
      card.textContent = (row as Row).name;
      rowEl.appendChild(card);
      return true;
    }
  }

  it('clears placeholder loading state before a custom renderer takes the element', async () => {
    const { grid, ds } = await createServerSideGrid({ maxConcurrentRequests: 1 }, { plugins: [new CardRowPlugin()] });
    await loadFirstBlock(grid, ds);
    expect(grid.querySelectorAll('.data-grid-row[aria-busy="true"]').length).toBeGreaterThan(0);

    await vi.waitFor(() => expect(ds.pending.length).toBeGreaterThan(0));
    ds.flush();

    await vi.waitFor(() =>
      expect([...grid.querySelectorAll('.card')].some((c) => c.textContent === 'Row 9')).toBe(true),
    );
    expect(grid.querySelector('.data-grid-row[aria-busy]')).toBeNull();
    expect(grid.querySelector('.tbw-row-loading-overlay')).toBeNull();
  });

  it('keeps independently requested row loading on a custom-rendered row', async () => {
    const { grid, ds } = await createServerSideGrid({ maxConcurrentRequests: 1 }, { plugins: [new CardRowPlugin()] });
    await loadFirstBlock(grid, ds);
    await vi.waitFor(() => expect(ds.pending.length).toBeGreaterThan(0));
    ds.flush();
    await vi.waitFor(() => expect(placeholderRows(grid)).toHaveLength(0));

    grid.setRowLoading('7', true);
    grid.requestRender();
    await vi.waitFor(() => expect(grid.querySelectorAll('.data-grid-row[aria-busy="true"]').length).toBe(1));
  });
});

describe('ServerSide placeholders and the keyboard context menu (PR #511)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  const shiftF10 = () => ({ key: 'F10', shiftKey: true, preventDefault: vi.fn() }) as unknown as KeyboardEvent;

  it('Shift+F10 on a loading row opens no menu and never passes the placeholder to items()', async () => {
    const items = vi.fn((_params: { row: unknown }) => [{ id: 'x', name: 'X' }]);
    const { grid, ds } = await createServerSideGrid(
      { maxConcurrentRequests: 1 },
      { features: { contextMenu: { items } } },
    );
    await loadFirstBlock(grid, ds);
    const menu = grid.getPluginByName('contextMenu');

    grid._focusRow = 7;
    grid._focusCol = 0;
    const event = shiftF10();
    expect(menu.onKeyDown(event)).toBeUndefined();
    expect(event.preventDefault).toHaveBeenCalled(); // native menu still suppressed
    expect(items).not.toHaveBeenCalled();
    expect(document.querySelector('.tbw-context-menu')).toBeNull();

    // Control: a loaded row still opens the menu.
    grid._focusRow = 1;
    expect(menu.onKeyDown(shiftF10())).toBe(true);
    expect(items).toHaveBeenCalledTimes(1);
    expect((items.mock.calls[0][0].row as Row).name).toBe('Row 1');
  });
});

describe('ServerSide placeholders occupy the slot virtualization reserves (PR #511)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  const placeholderIndices = (grid: any): number[] =>
    grid._rows.flatMap((r: unknown, i: number) => (isLoadingPlaceholder(r) ? [i] : []));

  it('Responsive cardRenderer + fixed cardRowHeight: placeholders render at the reserved card height', async () => {
    const { grid, ds } = await createServerSideGrid(
      { maxConcurrentRequests: 1 },
      {
        features: {
          responsive: {
            breakpoint: 1,
            cardRowHeight: 120,
            cardRenderer: (row: Row) => {
              const card = document.createElement('div');
              card.textContent = row.name;
              return card;
            },
          },
        },
      },
    );
    await loadFirstBlock(grid, ds);
    grid.getPluginByName('responsive').setResponsive(true);

    await vi.waitFor(() => expect(grid.querySelector('.data-grid-row.responsive-card')).not.toBeNull());
    const placeholders = placeholderRows(grid) as HTMLElement[];
    expect(placeholders.length).toBeGreaterThan(0);
    for (const el of placeholders) {
      expect(el.classList.contains('placeholder-row')).toBe(true);
      expect(el.classList.contains('responsive-card')).toBe(false);
      expect(el.style.height).toBe('120px');
    }
    // The DOM height above is the height virtualization reserved for those rows.
    const cache = grid._virtualization.positionCache;
    for (const i of placeholderIndices(grid)) expect(cache[i].height).toBe(120);
  });

  it('a consumer rowHeight function never receives a placeholder; placeholders keep the default height', async () => {
    const rowHeight = vi.fn((row: Row) => (row.name.length > 0 ? 70 : undefined));
    const { grid, ds } = await createServerSideGrid({ maxConcurrentRequests: 1 }, { rowHeight });
    await loadFirstBlock(grid, ds);

    expect(rowHeight).toHaveBeenCalled();
    expect(rowHeight.mock.calls.some(([row]) => isLoadingPlaceholder(row))).toBe(false);

    const cache = grid._virtualization.positionCache;
    expect(cache[0].height).toBe(70);
    for (const i of placeholderIndices(grid)) expect(cache[i].height).not.toBe(70);
    for (const el of placeholderRows(grid) as HTMLElement[]) {
      expect(el.style.getPropertyValue('--tbw-row-height')).toBe('');
    }
  });

  it("placeholderRendering: 'columns' also keeps the consumer rowHeight function away from placeholders", async () => {
    const rowHeight = vi.fn((row: Row) => (row.name.length > 0 ? 70 : undefined));
    const { ds, seen } = await createServerSideGrid(
      { maxConcurrentRequests: 1, placeholderRendering: 'columns' },
      { rowHeight },
    );
    await vi.waitFor(() => expect(ds.pending.length).toBeGreaterThan(0));
    ds.flush();
    await vi.waitFor(() => expect(seen.renderer.some(isLoadingPlaceholder)).toBe(true));

    expect(rowHeight.mock.calls.some(([row]) => isLoadingPlaceholder(row))).toBe(false);
  });
});

describe('ServerSide placeholders with other plugins and loadingRenderer (PR #511, round 3)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('Tree keeps the placeholder-owned aria-busy on unloaded rows and never passes them to hasChildren', async () => {
    // Real rows are parents (lazy), so Tree is active and records metadata for placeholder roots too.
    const hasChildren = vi.fn((row: Row) => row.name.startsWith('Row'));
    const { grid, ds } = await createServerSideGrid(
      { maxConcurrentRequests: 1 },
      { features: { tree: { hasChildren, treeColumn: 'id' } } },
    );
    await loadFirstBlock(grid, ds);
    await vi.waitFor(() => expect(grid.querySelector('.tree-toggle')).not.toBeNull()); // Tree is active

    grid.requestRender(); // run Tree's afterRender over the placeholder rows again
    await new Promise((r) => setTimeout(r, 50));

    const loading = placeholderRows(grid);
    expect(loading.length).toBeGreaterThan(0);
    for (const el of loading) expect(el.getAttribute('aria-busy')).toBe('true');
    expect(hasChildren.mock.calls.some(([row]) => isLoadingPlaceholder(row))).toBe(false);
  });

  it('dirty tracking captures baselines only for loaded rows, not placeholders', async () => {
    const counts: number[] = [];
    const { grid, ds } = await createServerSideGrid(
      { maxConcurrentRequests: 1 },
      { features: { editing: { dirtyTracking: true } } },
    );
    grid.on('baselines-captured', (detail: { count: number }) => counts.push(detail.count));
    await loadFirstBlock(grid, ds);
    grid.requestRender();
    await vi.waitFor(() => expect(counts.length).toBeGreaterThan(0));

    expect(Math.max(...counts)).toBe(5); // block 0 only — the 5 unloaded slots are not snapshotted
  });

  it('placeholders and grid.setRowLoading() use loadingRenderer({ size: "small" })', async () => {
    const loadingRenderer = vi.fn((_ctx: { size: 'large' | 'small' }) => {
      const el = document.createElement('span');
      el.className = 'my-row-loader';
      return el;
    });
    const { grid, ds } = await createServerSideGrid({ maxConcurrentRequests: 1 }, { loadingRenderer });
    await loadFirstBlock(grid, ds);

    for (const el of placeholderRows(grid)) {
      expect(el.querySelector('.tbw-row-loading-overlay .my-row-loader')).not.toBeNull();
      expect(el.querySelector('.tbw-row-loading-spinner')).toBeNull();
    }
    expect(loadingRenderer).toHaveBeenCalledWith({ size: 'small' });

    // Core row loading on a loaded row honours the same renderer.
    grid.setRowLoading('1', true);
    const rowEl = [...grid.querySelectorAll('.data-grid-row')].find((el) => el.getAttribute('aria-rowindex') === '3');
    expect(rowEl?.querySelector('.tbw-row-loading-overlay .my-row-loader')).not.toBeNull();
  });
});
