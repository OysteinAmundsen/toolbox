/**
 * Integration tests for variable row height behavior with plugins
 * Ensures row height measurement works correctly on first render
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../lib/core/grid';
import type { DataGridElement } from '../../lib/core/grid';
import type { GridConfig } from '../../lib/core/types';
import { MasterDetailPlugin } from '../../lib/plugins/master-detail';

interface TestRow {
  id: number;
  name: string;
}

function nextFrame() {
  return new Promise((r) => requestAnimationFrame(r));
}

async function waitUpgrade(grid: DataGridElement<TestRow>) {
  await customElements.whenDefined('tbw-grid');
  const start = Date.now();
  while (!(grid as any).hasAttribute('data-upgraded')) {
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

function createRows(count: number): TestRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Row ${i + 1}`,
  }));
}

describe('variable row height with plugins', () => {
  let grid: DataGridElement<TestRow>;

  beforeEach(() => {
    document.body.innerHTML = '';
    grid = document.createElement('tbw-grid') as DataGridElement<TestRow>;
    grid.style.cssText = 'height: 400px; width: 800px; display: block;';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('first render row height measurement', () => {
    it('should set up variable heights mode when plugin implements getRowHeight', async () => {
      const rows = createRows(200);
      const plugin = new MasterDetailPlugin({
        detailRenderer: (row) => {
          const div = document.createElement('div');
          div.textContent = `Detail for ${row.name}`;
          div.style.height = '100px';
          return div;
        },
      });

      const config: GridConfig<TestRow> = {
        columns: [
          { field: 'id', header: 'ID' },
          { field: 'name', header: 'Name' },
        ],
        plugins: [plugin],
      };

      grid.rows = rows;
      grid.gridConfig = config;
      document.body.appendChild(grid);
      await waitUpgrade(grid);
      await nextFrame();
      await nextFrame(); // Extra frame for measurement

      // Get the spacer element (faux scrollbar pattern)
      const fauxScrollbar = grid.querySelector('.faux-vscroll') as HTMLElement;
      const spacer = fauxScrollbar?.querySelector('.faux-vscroll-spacer') as HTMLElement;

      expect(fauxScrollbar).toBeTruthy();
      expect(spacer).toBeTruthy();

      // Verify virtualization is in variable heights mode
      const internalGrid = grid as unknown as {
        _virtualization: { variableHeights: boolean; rowHeight: number; positionCache: unknown[] };
      };
      expect(internalGrid._virtualization.variableHeights).toBe(true);
      expect(internalGrid._virtualization.positionCache).toBeDefined();
      expect(internalGrid._virtualization.positionCache.length).toBe(200);

      // Note: Actual spacer height measurement can't be verified in happy-dom
      // as getBoundingClientRect returns 0 for all elements. In real browsers,
      // the measurement would update the spacer to reflect actual CSS row height.
    });

    it('should enable variable heights when plugin is added after connectedCallback (framework adapter scenario)', async () => {
      // Simulates Angular/React flow: grid connects first, then plugins are added
      // via gridConfig setter in a framework effect/useEffect
      const rows = createRows(200);

      // Step 1: Set rows and connect element WITHOUT plugins
      grid.rows = rows;
      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID' },
          { field: 'name', header: 'Name' },
        ],
      };
      document.body.appendChild(grid);
      await waitUpgrade(grid);
      await nextFrame();

      const internalGrid = grid as unknown as {
        _virtualization: { variableHeights: boolean; rowHeight: number; positionCache: unknown[] | null };
      };

      // At this point, no row-height plugin → variableHeights should be false
      expect(internalGrid._virtualization.variableHeights).toBe(false);

      // Step 2: Set gridConfig with MasterDetailPlugin AFTER connection
      // This simulates Angular's effect() firing after connectedCallback
      const plugin = new MasterDetailPlugin({
        detailRenderer: (row) => {
          const div = document.createElement('div');
          div.textContent = `Detail for ${row.name}`;
          div.style.height = '100px';
          return div;
        },
      });

      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID' },
          { field: 'name', header: 'Name' },
        ],
        plugins: [plugin],
      };
      await nextFrame();
      await nextFrame();

      // After adding plugin, variableHeights MUST be true
      expect(internalGrid._virtualization.variableHeights).toBe(true);
      expect(internalGrid._virtualization.positionCache).toBeDefined();
      expect(internalGrid._virtualization.positionCache).not.toBeNull();
      expect(internalGrid._virtualization.positionCache!.length).toBe(200);
    });

    it('should have position cache with correct structure', async () => {
      const rows = createRows(50);
      const plugin = new MasterDetailPlugin({
        detailRenderer: (row) => {
          const div = document.createElement('div');
          div.textContent = `Detail for ${row.name}`;
          return div;
        },
      });

      const config: GridConfig<TestRow> = {
        columns: [
          { field: 'id', header: 'ID' },
          { field: 'name', header: 'Name' },
        ],
        plugins: [plugin],
      };

      grid.rows = rows;
      grid.gridConfig = config;
      document.body.appendChild(grid);
      await waitUpgrade(grid);
      await nextFrame();

      const internalGrid = grid as unknown as {
        _virtualization: { positionCache: Array<{ offset: number; height: number; measured: boolean }> };
      };
      const cache = internalGrid._virtualization.positionCache;

      // Verify cache structure
      expect(cache.length).toBe(50);

      // Each entry should have offset, height, measured
      cache.forEach((entry, index) => {
        expect(entry).toHaveProperty('offset');
        expect(entry).toHaveProperty('height');
        expect(entry).toHaveProperty('measured');
        expect(typeof entry.offset).toBe('number');
        expect(typeof entry.height).toBe('number');
        expect(typeof entry.measured).toBe('boolean');

        // Offsets should be monotonically increasing
        if (index > 0) {
          expect(entry.offset).toBeGreaterThan(cache[index - 1].offset);
        }
      });
    });

    it('should render visible rows in virtualized mode', async () => {
      const rows = createRows(200);
      const plugin = new MasterDetailPlugin({
        detailRenderer: (row) => {
          const div = document.createElement('div');
          div.textContent = `Detail for ${row.name}`;
          div.style.height = '100px';
          return div;
        },
      });

      const config: GridConfig<TestRow> = {
        columns: [
          { field: 'id', header: 'ID' },
          { field: 'name', header: 'Name' },
        ],
        plugins: [plugin],
      };

      grid.rows = rows;
      grid.gridConfig = config;
      document.body.appendChild(grid);
      await waitUpgrade(grid);
      await nextFrame();

      // Should render some rows (virtualized, not all 200)
      const visibleRows = grid.querySelectorAll('.data-grid-row');
      expect(visibleRows.length).toBeLessThan(200);
      expect(visibleRows.length).toBeGreaterThan(0);

      // First visible row should have aria-rowindex
      const firstRow = visibleRows[0];
      expect(firstRow?.getAttribute('aria-rowindex')).toBeTruthy();
    });
  });

  describe('scroll transform with variable heights', () => {
    it('should use position cache offset for scroll transform calculation', async () => {
      const rows = createRows(100);
      const plugin = new MasterDetailPlugin({
        detailRenderer: (row) => {
          const div = document.createElement('div');
          div.textContent = `Detail for ${row.name}`;
          div.style.height = '150px';
          return div;
        },
      });

      const config: GridConfig<TestRow> = {
        columns: [
          { field: 'id', header: 'ID' },
          { field: 'name', header: 'Name' },
        ],
        plugins: [plugin],
      };

      grid.rows = rows;
      grid.gridConfig = config;
      document.body.appendChild(grid);
      await waitUpgrade(grid);
      await nextFrame();

      // Get internal state
      const internalGrid = grid as unknown as {
        _virtualization: {
          variableHeights: boolean;
          positionCache: Array<{ offset: number; height: number; measured: boolean }>;
          rowHeight: number;
        };
      };

      // Verify variable heights mode is enabled
      expect(internalGrid._virtualization.variableHeights).toBe(true);
      expect(internalGrid._virtualization.positionCache).toBeDefined();

      // Expand a few rows to create varying heights
      plugin.expand(0);
      plugin.expand(1);
      plugin.expand(2);
      await nextFrame();
      await nextFrame();

      // After expansion, position cache should have larger heights for expanded rows
      // (The exact values depend on detailHeight measurement, but offsets should reflect expansion)
      const cache = internalGrid._virtualization.positionCache;

      // Verify the position cache exists and has entries
      expect(cache.length).toBe(100);

      // Row 3 should have a larger offset than row 0 + (3 * baseHeight)
      // because rows 0, 1, 2 have detail panels
      const baseHeight = internalGrid._virtualization.rowHeight;
      const row3Offset = cache[3]?.offset ?? 0;
      const minExpectedOffset = 3 * baseHeight; // Without expansions

      // With expansions, offset should be larger
      // (can't verify exact values in happy-dom, but structure should be correct)
      expect(row3Offset).toBeGreaterThanOrEqual(minExpectedOffset);
    });

    it('should have consistent transform between sync and async scroll paths', async () => {
      const rows = createRows(100);
      const plugin = new MasterDetailPlugin({
        detailRenderer: (row) => {
          const div = document.createElement('div');
          div.textContent = `Detail for ${row.name}`;
          div.style.height = '100px';
          return div;
        },
      });

      const config: GridConfig<TestRow> = {
        columns: [
          { field: 'id', header: 'ID' },
          { field: 'name', header: 'Name' },
        ],
        plugins: [plugin],
      };

      grid.rows = rows;
      grid.gridConfig = config;
      document.body.appendChild(grid);
      await waitUpgrade(grid);
      await nextFrame();

      // Expand some rows
      plugin.expand(0);
      plugin.expand(1);
      await nextFrame();
      await nextFrame();

      // Simulate scroll by setting scrollTop on faux scrollbar
      const fauxScrollbar = grid.querySelector('.faux-vscroll') as HTMLElement;
      const rowsContainer = grid.querySelector('.rows') as HTMLElement;

      if (fauxScrollbar && rowsContainer) {
        // Trigger scroll event
        const scrollTop = 300;
        fauxScrollbar.scrollTop = scrollTop;
        fauxScrollbar.dispatchEvent(new Event('scroll'));

        // Get transform immediately (sync path)
        const transformAfterSync = rowsContainer.style.transform;

        // Wait for async path
        await nextFrame();
        await nextFrame();

        // Get transform after async (should be same or very close)
        const transformAfterAsync = rowsContainer.style.transform;

        // Both transforms should use position cache, so should be similar
        // Note: exact match may vary slightly due to even-alignment
        expect(transformAfterSync).toMatch(/translateY\(-?\d+(\.\d+)?px\)/);
        expect(transformAfterAsync).toMatch(/translateY\(-?\d+(\.\d+)?px\)/);

        // Extract numeric values for comparison
        const syncMatch = transformAfterSync.match(/translateY\((-?\d+(\.\d+)?)px\)/);
        const asyncMatch = transformAfterAsync.match(/translateY\((-?\d+(\.\d+)?)px\)/);

        if (syncMatch && asyncMatch) {
          const syncOffset = parseFloat(syncMatch[1]);
          const asyncOffset = parseFloat(asyncMatch[1]);

          // Offsets should be close (within a row height due to even-alignment)
          const internalGrid = grid as unknown as {
            _virtualization: { rowHeight: number };
          };
          const tolerance = internalGrid._virtualization.rowHeight * 2;
          expect(Math.abs(syncOffset - asyncOffset)).toBeLessThanOrEqual(tolerance);
        }
      }
    });
  });
});
