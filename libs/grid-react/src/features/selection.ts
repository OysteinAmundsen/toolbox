/**
 * Selection feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `selection` prop on DataGrid.
 * Also exports `useGridSelection()` hook for programmatic selection control.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/selection';
 *
 * <DataGrid selection="range" />
 * ```
 *
 * @example Using the hook
 * ```tsx
 * import { useGridSelection } from '@toolbox-web/grid-react/features/selection';
 *
 * function MyComponent() {
 *   const { selectAll, clearSelection, getSelection } = useGridSelection();
 *
 *   return (
 *     <button onClick={selectAll}>Select All</button>
 *   );
 * }
 * ```
 *
 * @packageDocumentation
 */

import type { DataGridElement } from '@toolbox-web/grid';
import { SelectionPlugin, type CellRange, type SelectionResult } from '@toolbox-web/grid/plugins/selection';
import { useCallback, useContext } from 'react';
import { GridElementContext } from '../lib/data-grid';
import { registerFeature } from '../lib/feature-registry';

registerFeature('selection', (config) => {
  // Handle shorthand: 'cell', 'row', 'range'
  if (config === 'cell' || config === 'row' || config === 'range') {
    return new SelectionPlugin({ mode: config });
  }
  // Full config object
  return new SelectionPlugin(config ?? undefined);
});

/**
 * Selection methods returned from useGridSelection.
 *
 * Uses React context to access the grid ref - works reliably regardless of
 * when the grid mounts or conditional rendering.
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
 * Hook for programmatic selection control.
 *
 * Must be used within a DataGrid component tree with the selection feature enabled.
 * Uses React context, so it works reliably regardless of when the grid mounts.
 *
 * @example
 * ```tsx
 * import { useGridSelection } from '@toolbox-web/grid-react/features/selection';
 *
 * function ExportSelectedButton() {
 *   const { getSelection, clearSelection } = useGridSelection();
 *
 *   const handleExport = () => {
 *     const selection = getSelection();
 *     if (!selection) return;
 *     // Derive rows from selection.ranges and grid.rows
 *     clearSelection();
 *   };
 *
 *   return <button onClick={handleExport}>Export Selected</button>;
 * }
 * ```
 */
export function useGridSelection<TRow = unknown>(): SelectionMethods<TRow> {
  const gridRef = useContext(GridElementContext);

  const getPlugin = useCallback((): SelectionPlugin | undefined => {
    const grid = gridRef?.current as DataGridElement<TRow> | null;
    return grid?.getPlugin(SelectionPlugin);
  }, [gridRef]);

  const selectAll = useCallback(() => {
    const plugin = getPlugin();
    if (!plugin) {
      console.warn(
        `[tbw-grid:selection] SelectionPlugin not found.\n\n` +
          `  → Enable selection on the grid:\n` +
          `    <DataGrid selection="range" />`,
      );
      return;
    }
    const grid = gridRef?.current as DataGridElement<TRow> | null;
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
  }, [getPlugin, gridRef]);

  const clearSelection = useCallback(() => {
    getPlugin()?.clearSelection();
  }, [getPlugin]);

  const getSelection = useCallback((): SelectionResult | null => {
    return getPlugin()?.getSelection() ?? null;
  }, [getPlugin]);

  const isCellSelected = useCallback(
    (row: number, col: number): boolean => {
      return getPlugin()?.isCellSelected(row, col) ?? false;
    },
    [getPlugin],
  );

  const setRanges = useCallback(
    (ranges: CellRange[]) => {
      getPlugin()?.setRanges(ranges);
    },
    [getPlugin],
  );

  const getSelectedRows = useCallback((): TRow[] => {
    return getPlugin()?.getSelectedRows<TRow>() ?? [];
  }, [getPlugin]);

  return {
    selectAll,
    clearSelection,
    getSelection,
    isCellSelected,
    setRanges,
    getSelectedRows,
  };
}
