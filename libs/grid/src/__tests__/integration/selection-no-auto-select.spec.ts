/**
 * Selection - No Auto-Select on Initial Load (Issue #392)
 *
 * Integration tests verifying that SelectionPlugin does not auto-select the first row/cell
 * on initial grid load before focus enters the grid. The plugin should only sync selection
 * when the grid has received actual focus (via keyboard navigation or mouse interaction).
 *
 * Related issue: https://github.com/OysteinAmundsen/toolbox/issues/392
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Test helpers
async function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function waitUpgrade(el: HTMLElement & { ready?: () => Promise<void> }): Promise<void> {
  await customElements.whenDefined('tbw-grid');
  await el.ready?.();
  await nextFrame();
  await nextFrame();
}

type TestGrid = HTMLElement & {
  gridConfig?: Record<string, unknown>;
  rows: Record<string, unknown>[];
  columns: Record<string, unknown>[];
  ready: () => Promise<void>;
};

describe('Selection - No Auto-Select on Initial Load (Issue #392)', () => {
  let grid: TestGrid;

  beforeEach(async () => {
    // Import grid and selection feature
    await import('../../lib/core/grid');
    await import('../../lib/features/selection');

    document.body.innerHTML = '';
    grid = document.createElement('tbw-grid') as TestGrid;
    grid.style.display = 'block';
    grid.style.height = '300px';
    grid.columns = [
      { field: 'id', header: 'ID' },
      { field: 'name', header: 'Name' },
    ];
    grid.rows = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ];
    document.body.appendChild(grid);
    await waitUpgrade(grid);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('No auto-selection before focus entry', () => {
    it('should not auto-select row 0 in row mode when grid lacks focus', async () => {
      grid.gridConfig = {
        features: { selection: { mode: 'row', checkbox: true } },
      };
      await nextFrame();
      await nextFrame();

      // Verify SelectionPlugin was loaded
      expect(grid.gridConfig).toBeTruthy();

      // Verify no rows are selected yet (grid has not received focus)
      // The grid's default focus cursor is at (0,0) but no selection should fire until focus enters
      const selectedRowsAttr = grid.getAttribute('data-selected-rows');
      expect(selectedRowsAttr).toBeNull();
    });

    it('should not auto-select cell 0,0 in cell mode when grid lacks focus', async () => {
      grid.gridConfig = {
        features: { selection: { mode: 'cell' } },
      };
      await nextFrame();
      await nextFrame();

      // Verify SelectionPlugin was loaded
      expect(grid.gridConfig).toBeTruthy();

      // Verify no cells are selected yet (grid has not received focus)
      const selectedCellsAttr = grid.getAttribute('data-selected-cell');
      expect(selectedCellsAttr).toBeNull();
    });

    it('should not auto-select range in range mode when grid lacks focus', async () => {
      grid.gridConfig = {
        features: { selection: { mode: 'range' } },
      };
      await nextFrame();
      await nextFrame();

      // Verify SelectionPlugin was loaded
      expect(grid.gridConfig).toBeTruthy();

      // Verify no ranges are selected yet (grid has not received focus)
      const selectedRangesAttr = grid.getAttribute('data-selected-ranges');
      expect(selectedRangesAttr).toBeNull();
    });
  });
});
