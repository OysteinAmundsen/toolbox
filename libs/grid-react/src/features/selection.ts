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
import {
  type CellRange,
  type SelectionChangeDetail,
  type SelectionPlugin,
  type SelectionResult,
} from '@toolbox-web/grid/plugins/selection';
import { useCallback, useContext, useEffect, useState } from 'react';
import { GridElementContext } from '../lib/grid-element-context';

// Delegate to core feature registration
import '@toolbox-web/grid/features/selection';
// Named type re-export surfaces the core `FeatureConfig` augmentation to dist
// consumers — a bare side-effect import alone is stripped from the emitted
// `.d.ts`. See `.github/knowledge/adapters.md`.
export type { _Augmentation as _SelectionAugmentation } from '@toolbox-web/grid/features/selection';

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
   *
   * For reactive selected rows, use `selectedRows` instead.
   */
  getSelectedRows: () => TRow[];

  /**
   * Reactive selection state. Re-renders the component whenever the selection
   * changes. `null` when no SelectionPlugin is active or nothing is selected.
   *
   * @since 2.5.0
   */
  selection: SelectionResult | null;

  /**
   * Reactive selected row indices (sorted ascending). Empty in cell/range
   * modes or when nothing is selected.
   *
   * **Prefer `selectedRows`** for getting actual row objects — it handles
   * index-to-object resolution correctly regardless of sorting/filtering.
   *
   * @since 2.5.0
   */
  selectedRowIndices: number[];

  /**
   * Reactive selected row objects. Works in all selection modes.
   *
   * @since 2.5.0
   */
  selectedRows: TRow[];

  /**
   * Whether the grid has finished its first render and the selection plugin
   * has been discovered.
   *
   * @since 2.5.0
   */
  isReady: boolean;
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
 * @param selector - Optional CSS selector to target a specific grid element via
 *   DOM query instead of using React context. Use when the component contains
 *   multiple grids, e.g. `'tbw-grid.primary'` or `'#my-grid'`.
 */
export function useGridSelection<TRow = unknown>(selector?: string): SelectionMethods<TRow> {
  const gridRef = useContext(GridElementContext);

  const getGrid = useCallback((): DataGridElement<TRow> | null => {
    return (selector ? document.querySelector(selector) : gridRef?.current) as DataGridElement<TRow> | null;
  }, [gridRef, selector]);

  const getPlugin = useCallback((): SelectionPlugin | undefined => {
    return getGrid()?.getPluginByName('selection');
  }, [getGrid]);

  // ── Reactive state (parity with Angular's selection signals) ──────────
  const [isReady, setIsReady] = useState(false);
  const [selection, setSelection] = useState<SelectionResult | null>(null);
  const [selectedRowIndices, setSelectedRowIndices] = useState<number[]>([]);
  const [selectedRows, setSelectedRows] = useState<TRow[]>([]);

  useEffect(() => {
    let disposed = false;
    const grid = getGrid();
    if (!grid) return;

    // `mode` may be a single mode or an array (multi-mode selection).
    const sync = (mode?: SelectionChangeDetail['mode']) => {
      const plugin = grid.getPluginByName('selection') as SelectionPlugin | undefined;
      if (!plugin || disposed) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resolvedMode = mode ?? ((plugin as any).config?.mode as SelectionChangeDetail['mode'] | undefined);
      const isRowMode = Array.isArray(resolvedMode) ? resolvedMode.includes('row') : resolvedMode === 'row';
      setSelection(plugin.getSelection());
      setSelectedRowIndices(isRowMode ? plugin.getSelectedRowIndices() : []);
      setSelectedRows(plugin.getSelectedRows<TRow>());
    };

    const unsub = grid.on?.('selection-change', (detail: unknown) => {
      sync((detail as SelectionChangeDetail).mode);
    });

    // `ready` is optional on the element type and genuinely absent until the
    // custom element upgrades, so unwrap through `Promise.resolve`.
    Promise.resolve(grid.ready?.()).then(() => {
      if (disposed) return;
      setIsReady(true);
      sync();
    });

    return () => {
      disposed = true;
      unsub?.();
    };
  }, [getGrid]);

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
  }, [getPlugin, getGrid]);

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
    selection,
    selectedRowIndices,
    selectedRows,
    isReady,
  };
}
