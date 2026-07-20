/**
 * Tests for DataGrid ref callback behaviour.
 *
 * @vitest-environment happy-dom
 *
 * Regression: the ref callback used to assign `gridConfig`, `rows`, and `columns`
 * onto the underlying `<tbw-grid>` element on every render. React detaches and
 * re-attaches inline ref callbacks on every render, which meant any parent re-render
 * (e.g. a height-resize observer firing) would re-set `gridConfig`. That caused
 * ConfigManager to flag sources as changed, and the next merge() would rebuild
 * `effectiveConfig.columns` from the original `gridConfig.columns`, wiping
 * runtime state like `col.hidden` written by the visibility plugin or
 * `applyColumnState`. The ref callback must only sync on first attach.
 */
import type { DataGridElement, GridConfig } from '@toolbox-web/grid';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DataGrid } from './data-grid';

beforeAll(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});

type Row = { id: number; name: string };

describe('DataGrid ref callback', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('does not re-assign gridConfig on parent re-render (regression)', async () => {
    // Spy on the gridConfig setter on the grid element prototype so we count how
    // many times the ref callback writes to it across renders.
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const gridConfig: GridConfig<Row> = {
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name' },
      ],
    };
    const rows: Row[] = [{ id: 1, name: 'one' }];

    let setRenderToken!: (n: number) => void;
    function Wrapper() {
      const [renderToken, _setRenderToken] = useState(0);
      setRenderToken = _setRenderToken;
      // Pass an unstable style to simulate a parent that re-renders on resize.
      return <DataGrid<Row> rows={rows} gridConfig={gridConfig} style={{ height: 400 + renderToken }} />;
    }

    await act(async () => {
      root.render(<Wrapper />);
    });

    const gridEl = container.querySelector('tbw-grid') as DataGridElement | null;
    expect(gridEl).toBeTruthy();

    // Wrap the gridConfig setter to count writes from this point forward.
    // The initial mount has already happened; we're measuring re-render writes.
    let configWriteCount = 0;
    const proto = Object.getPrototypeOf(gridEl);
    const desc = Object.getOwnPropertyDescriptor(proto, 'gridConfig');
    expect(desc?.set).toBeTypeOf('function');
    const originalSet = desc!.set!;
    Object.defineProperty(gridEl!, 'gridConfig', {
      configurable: true,
      get: desc!.get,
      set(value) {
        configWriteCount++;
        originalSet.call(this, value);
      },
    });

    // Trigger several parent re-renders without changing gridConfig.
    await act(async () => {
      setRenderToken(1);
    });
    await act(async () => {
      setRenderToken(2);
    });
    await act(async () => {
      setRenderToken(3);
    });

    // The dedicated useEffect that syncs gridConfig only runs when
    // processedGridConfig changes (memoized on gridConfig identity), so
    // re-rendering with the same gridConfig must not re-write the setter.
    expect(configWriteCount).toBe(0);

    await act(async () => {
      root.unmount();
    });
  });
});

/**
 * Smart row diffing: when `getRowId` is configured and only values changed
 * (same count, same IDs, same order), the adapter routes through
 * `el.updateRows(..., 'sync')` instead of reassigning `el.rows`. Structural
 * changes (add / remove / reorder) fall back to the full `el.rows` replace.
 */
describe('DataGrid smart row diffing', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  async function mountWithSpies(initial: Row[]) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    // Stable config so re-renders don't re-process gridConfig.
    const gridConfig: GridConfig<Row> = {
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name' },
      ],
      getRowId: (r) => String(r.id),
    };

    let setRows!: (r: Row[]) => void;
    function Wrapper() {
      const [rows, _setRows] = useState<Row[]>(initial);
      setRows = _setRows;
      return <DataGrid<Row> rows={rows} gridConfig={gridConfig} />;
    }
    await act(async () => {
      root.render(<Wrapper />);
    });

    const gridEl = container.querySelector('tbw-grid') as DataGridElement<Row>;
    expect(gridEl).toBeTruthy();

    // Record updateRows() calls (do not call through — we only assert routing).
    const updateRowsCalls: Array<[unknown, unknown]> = [];
    (gridEl as unknown as { updateRows: unknown }).updateRows = (updates: unknown, source?: unknown) => {
      updateRowsCalls.push([updates, source]);
    };

    // Count writes to the `rows` setter from this point (post-mount).
    let rowsSetCount = 0;
    const proto = Object.getPrototypeOf(gridEl);
    const desc = Object.getOwnPropertyDescriptor(proto, 'rows')!;
    Object.defineProperty(gridEl, 'rows', {
      configurable: true,
      get: desc.get,
      set(value) {
        rowsSetCount++;
        desc.set!.call(this, value);
      },
    });

    return {
      updateRowsCalls,
      getRowsSetCount: () => rowsSetCount,
      setRows: (r: Row[]) => act(async () => setRows(r)),
      unmount: () => act(async () => root.unmount()),
    };
  }

  it("routes a value-only change through el.updateRows(..., 'sync') without reassigning el.rows", async () => {
    const h = await mountWithSpies([
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ]);

    // Same ids, same order, same length — only a value changed (new identities).
    await h.setRows([
      { id: 1, name: 'A' },
      { id: 2, name: 'b' },
    ]);

    expect(h.updateRowsCalls.length).toBe(1);
    expect(h.updateRowsCalls[0][1]).toBe('sync');
    expect(h.getRowsSetCount()).toBe(0);

    await h.unmount();
  });

  it('falls back to el.rows assignment for a structural change (reorder)', async () => {
    const h = await mountWithSpies([
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ]);

    // Same ids/length but reordered → structural → full replace.
    await h.setRows([
      { id: 2, name: 'b' },
      { id: 1, name: 'a' },
    ]);

    expect(h.updateRowsCalls.length).toBe(0);
    expect(h.getRowsSetCount()).toBeGreaterThan(0);

    await h.unmount();
  });

  it('falls back to el.rows assignment when a row is added', async () => {
    const h = await mountWithSpies([
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ]);

    await h.setRows([
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
      { id: 3, name: 'c' },
    ]);

    expect(h.updateRowsCalls.length).toBe(0);
    expect(h.getRowsSetCount()).toBeGreaterThan(0);

    await h.unmount();
  });
});
