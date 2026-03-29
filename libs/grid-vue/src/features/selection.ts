/**
 * Selection feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `selection` prop on TbwGrid.
 * Also exports `useGridSelection()` composable for programmatic selection control.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/selection';
 * </script>
 *
 * <template>
 *   <TbwGrid selection="range" />
 * </template>
 * ```
 *
 * @example Using the composable
 * ```vue
 * <script setup>
 * import { useGridSelection } from '@toolbox-web/grid-vue/features/selection';
 *
 * const { selectAll, clearSelection, getSelection } = useGridSelection();
 *
 * function handleSelectAll() {
 *   selectAll();
 * }
 * </script>
 * ```
 *
 * @packageDocumentation
 */

import type { DataGridElement } from '@toolbox-web/grid';
import { type CellRange, type SelectionPlugin, type SelectionResult } from '@toolbox-web/grid/plugins/selection';
import { inject, ref } from 'vue';
import { GRID_ELEMENT_KEY } from '../lib/use-grid';

// Delegate to core feature registration
import '@toolbox-web/grid/features/selection';

/**
 * Selection methods returned from useGridSelection.
 *
 * Uses the injected grid element from TbwGrid's provide/inject.
 * Methods work immediately when grid is available.
 */
export interface SelectionMethods<TRow = unknown> {
  /**
   * Select all rows (row mode) or all cells (range mode).
   */
  selectAll: () => void;

  /**
   * Clear all selection.
   */
  clearSelection: () => void;

  /**
   * Get the current selection state.
   * Use this to derive selected rows, indices, etc.
   */
  getSelection: () => SelectionResult | null;

  /**
   * Check if a specific cell is selected.
   */
  isCellSelected: (row: number, col: number) => boolean;

  /**
   * Set selection ranges programmatically.
   */
  setRanges: (ranges: CellRange[]) => void;

  /**
   * Get actual row objects for the current selection.
   * Works in all selection modes (row, cell, range) — resolves indices
   * against the grid's processed (sorted/filtered) rows.
   *
   * This is the recommended way to get selected rows. Unlike manual
   * index mapping, it correctly resolves rows even when the grid is
   * sorted or filtered.
   */
  getSelectedRows: () => TRow[];
}

/**
 * Composable for programmatic selection control.
 *
 * Must be used within a component that contains a TbwGrid with the selection feature enabled.
 * Uses Vue's provide/inject, so it works reliably regardless of when the grid renders.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useGridSelection } from '@toolbox-web/grid-vue/features/selection';
 *
 * const { selectAll, clearSelection, getSelection } = useGridSelection();
 *
 * function exportSelected() {
 *   const selection = getSelection();
 *   if (!selection) return;
 *   // Derive rows from selection.ranges and grid.rows
 * }
 * </script>
 * ```
 * @param selector - Optional CSS selector to target a specific grid element via
 *   DOM query instead of using Vue's provide/inject. Use when the component
 *   contains multiple grids, e.g. `'tbw-grid.primary'` or `'#my-grid'`.
 */
export function useGridSelection<TRow = unknown>(selector?: string): SelectionMethods<TRow> {
  const gridElement = selector ? ref(null) : inject(GRID_ELEMENT_KEY, ref(null));

  const getGrid = (): DataGridElement<TRow> | null => {
    if (selector) return document.querySelector(selector) as DataGridElement<TRow> | null;
    return gridElement.value as DataGridElement<TRow> | null;
  };

  const getPlugin = (): SelectionPlugin | undefined => {
    return getGrid()?.getPluginByName('selection');
  };

  return {
    selectAll: () => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:selection] SelectionPlugin not found.\n\n` +
            `  → Enable selection on the grid:\n` +
            `    <TbwGrid selection="range" />`,
        );
        return;
      }
      const grid = getGrid();
      // Cast to any to access protected config
      const mode = (plugin as any).config?.mode;

      if (mode === 'row') {
        const rowCount = grid?.rows?.length ?? 0;
        const allIndices = new Set<number>();
        for (let i = 0; i < rowCount; i++) allIndices.add(i);
        (plugin as any).selected = allIndices;
        (plugin as any).requestAfterRender?.();
      } else if (mode === 'range') {
        const rowCount = grid?.rows?.length ?? 0;
        const colCount = (grid as any)?._columns?.length ?? 0;
        if (rowCount > 0 && colCount > 0) {
          plugin.setRanges([{ from: { row: 0, col: 0 }, to: { row: rowCount - 1, col: colCount - 1 } }]);
        }
      }
    },

    clearSelection: () => {
      getPlugin()?.clearSelection();
    },

    getSelection: () => {
      return getPlugin()?.getSelection() ?? null;
    },

    isCellSelected: (row: number, col: number) => {
      return getPlugin()?.isCellSelected(row, col) ?? false;
    },

    setRanges: (ranges: CellRange[]) => {
      getPlugin()?.setRanges(ranges);
    },

    getSelectedRows: (): TRow[] => {
      return getPlugin()?.getSelectedRows<TRow>() ?? [];
    },
  };
}
