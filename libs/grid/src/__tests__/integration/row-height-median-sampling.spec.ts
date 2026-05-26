/**
 * Integration test for the multi-row median sampling in #measureRowHeight.
 *
 * Background: previously the grid measured ONLY the first rendered row and
 * ratcheted `_virtualization.rowHeight` upward to match. A single outlier
 * row (e.g. one in editing mode with framework form-field chrome inflating
 * its height) would poison the global default and shrink the virtual
 * window for every other row.
 *
 * The fix: sample every visible row and use the MEDIAN — an outlier minority
 * cannot move the median.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../lib/core/grid';
import type { DataGridElement } from '../../lib/core/grid';
import type { GridConfig } from '../../lib/core/types';

interface Row {
  id: number;
  name: string;
}

// Capture every ResizeObserver instance so the test can trigger callbacks.
const resizeObservers: MockResizeObserver[] = [];

class MockResizeObserver implements ResizeObserver {
  callback: ResizeObserverCallback;
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  constructor(cb: ResizeObserverCallback) {
    this.callback = cb;
    resizeObservers.push(this);
  }
}

vi.stubGlobal('ResizeObserver', MockResizeObserver);

function nextFrame() {
  return new Promise<void>((r) => requestAnimationFrame(() => r()));
}

async function waitUpgrade(grid: DataGridElement<Row>) {
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
}

function setRowHeights(grid: DataGridElement<Row>, heights: number[]) {
  const rows = Array.from(grid._bodyEl.querySelectorAll<HTMLElement>('.data-grid-row'));
  for (let i = 0; i < rows.length && i < heights.length; i++) {
    const h = heights[i];
    Object.defineProperty(rows[i], 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ height: h, width: 800, top: 0, left: 0, right: 800, bottom: h, x: 0, y: 0, toJSON: () => ({}) }),
    });
    rows[i].querySelectorAll('.cell').forEach((cell) => {
      Object.defineProperty(cell, 'offsetHeight', { configurable: true, value: h });
    });
  }
}

function triggerRowResize() {
  // The grid's own row-height observer is the most recently created one
  // (after any plugin observers). Trigger ALL of them — non-grid ones
  // will ignore the entry.
  for (const obs of resizeObservers) {
    obs.callback([], obs);
  }
}

describe('#measureRowHeight median sampling', () => {
  let grid: DataGridElement<Row>;

  beforeEach(() => {
    resizeObservers.length = 0;
    document.body.innerHTML = '';
    grid = document.createElement('tbw-grid') as DataGridElement<Row>;
    grid.style.cssText = 'height: 400px; width: 800px; display: block;';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    resizeObservers.length = 0;
  });

  it('uses the median of all visible row heights so a single inflated row does not ratchet rowHeight up', async () => {
    const rows: Row[] = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }));
    const config: GridConfig<Row> = {
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name' },
      ],
    };
    grid.rows = rows;
    grid.gridConfig = config;
    document.body.appendChild(grid);
    await waitUpgrade(grid);
    await nextFrame();
    await nextFrame();

    const baseline = grid._virtualization.rowHeight;

    // Simulate compact mode where every row is 14px EXCEPT the first row,
    // which is inflated to 35px (editing-mode mat-form-field chrome).
    const heights = [35, ...Array.from({ length: 29 }, () => 14)];
    setRowHeights(grid, heights);
    triggerRowResize();
    await nextFrame();

    // With median sampling the rowHeight should reflect 14 (the majority),
    // not 35 (the single outlier). It must NOT be ratcheted up past the
    // original baseline because the median is <= baseline.
    expect(grid._virtualization.rowHeight).toBeLessThanOrEqual(baseline);
    expect(grid._virtualization.rowHeight).toBeLessThan(35);
  });

  it('ratchets rowHeight up when the MAJORITY of rows are taller (legitimate content growth)', async () => {
    const rows: Row[] = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }));
    const config: GridConfig<Row> = {
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name' },
      ],
    };
    grid.rows = rows;
    grid.gridConfig = config;
    document.body.appendChild(grid);
    await waitUpgrade(grid);
    await nextFrame();
    await nextFrame();

    // Every row is 50px — legitimate global height increase.
    const heights = Array.from({ length: 30 }, () => 50);
    setRowHeights(grid, heights);
    triggerRowResize();
    await nextFrame();

    // Median = 50 → ratchet kicks in.
    expect(grid._virtualization.rowHeight).toBeGreaterThanOrEqual(50);
  });

  it('excludes rows with an inline --tbw-row-height override from the sample', async () => {
    const rows: Row[] = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }));
    const config: GridConfig<Row> = {
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name' },
      ],
    };
    grid.rows = rows;
    grid.gridConfig = config;
    document.body.appendChild(grid);
    await waitUpgrade(grid);
    await nextFrame();
    await nextFrame();

    // Tag the first row with an inline override and inflate it. It must
    // be skipped by the sampler so the global rowHeight tracks the rest.
    const rowEls = Array.from(grid._bodyEl.querySelectorAll<HTMLElement>('.data-grid-row'));
    rowEls[0].style.setProperty('--tbw-row-height', '100px');

    setRowHeights(grid, [100, ...Array.from({ length: 9 }, () => 20)]);
    triggerRowResize();
    await nextFrame();

    // First row is excluded → median of the other nine 20px rows → 20.
    expect(grid._virtualization.rowHeight).toBeLessThan(100);
  });
});
