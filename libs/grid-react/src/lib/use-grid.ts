import type { ColumnConfig, DataGridElement, GridConfig } from '@toolbox-web/grid';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DataGridRef } from './data-grid';

/**
 * Selection convenience methods returned from useGrid.
 *
 * @deprecated These methods are deprecated and will be removed in a future version.
 * Use `useGridSelection()` from `@toolbox-web/grid-react/features/selection` instead.
 *
 * @example
 * ```tsx
 * // Old (deprecated)
 * const { selectAll, clearSelection } = useGrid();
 *
 * // New (recommended)
 * import { useGridSelection } from '@toolbox-web/grid-react/features/selection';
 * const { selectAll, clearSelection, getSelectedRows } = useGridSelection();
 * ```
 */
export interface SelectionMethods<TRow = unknown> {
  /**
   * Select all rows in the grid.
   * Requires SelectionPlugin with mode: 'row'.
   * @deprecated Use `useGridSelection()` from `@toolbox-web/grid-react/features/selection` instead.
   */
  selectAll: () => void;

  /**
   * Clear all selection.
   * Works with any SelectionPlugin mode.
   * @deprecated Use `useGridSelection()` from `@toolbox-web/grid-react/features/selection` instead.
   */
  clearSelection: () => void;

  /**
   * Get selected row indices.
   * Returns Set of selected row indices.
   * @deprecated Use `useGridSelection()` from `@toolbox-web/grid-react/features/selection` instead.
   */
  getSelectedIndices: () => Set<number>;

  /**
   * Get selected rows data.
   * Returns array of selected row objects.
   * @deprecated Use `useGridSelection()` from `@toolbox-web/grid-react/features/selection` instead.
   */
  getSelectedRows: () => TRow[];
}

/**
 * Export convenience methods returned from useGrid.
 *
 * @deprecated These methods are deprecated and will be removed in a future version.
 * Use `useGridExport()` from `@toolbox-web/grid-react/features/export` instead.
 *
 * @example
 * ```tsx
 * // Old (deprecated)
 * const { exportToCsv, exportToJson } = useGrid();
 *
 * // New (recommended)
 * import { useGridExport } from '@toolbox-web/grid-react/features/export';
 * const { exportToCsv, exportToExcel, exportToJson } = useGridExport();
 * ```
 */
export interface ExportMethods {
  /**
   * Export grid data to CSV file.
   * Requires ExportPlugin to be loaded.
   *
   * @param filename - Optional filename (defaults to 'export.csv')
   * @deprecated Use `useGridExport()` from `@toolbox-web/grid-react/features/export` instead.
   */
  exportToCsv: (filename?: string) => void;

  /**
   * Export grid data to JSON file.
   * Requires ExportPlugin to be loaded.
   *
   * @param filename - Optional filename (defaults to 'export.json')
   * @deprecated Use `useGridExport()` from `@toolbox-web/grid-react/features/export` instead.
   */
  exportToJson: (filename?: string) => void;
}

/**
 * Return type for useGrid hook.
 *
 * Note: Selection and export convenience methods are deprecated.
 * Use feature-specific hooks instead:
 * - `useGridSelection()` from `@toolbox-web/grid-react/features/selection`
 * - `useGridExport()` from `@toolbox-web/grid-react/features/export`
 */
export interface UseGridReturn<TRow = unknown> extends SelectionMethods<TRow>, ExportMethods {
  /** Ref to attach to the DataGrid component (returns DataGridRef handle) */
  ref: React.RefObject<DataGridRef<TRow> | null>;
  /** Direct access to the typed grid element (convenience for ref.current?.element) */
  element: DataGridElement<TRow> | null;
  /** Whether the grid is ready */
  isReady: boolean;
  /** Current grid configuration */
  config: GridConfig<TRow> | null;
  /** Get the effective configuration */
  getConfig: () => Promise<GridConfig<TRow> | null>;
  /** Force a layout recalculation */
  forceLayout: () => Promise<void>;
  /** Toggle a group row */
  toggleGroup: (key: string) => Promise<void>;
  /** Register custom styles */
  registerStyles: (id: string, css: string) => void;
  /** Unregister custom styles */
  unregisterStyles: (id: string) => void;
  /** Get current visible columns */
  getVisibleColumns: () => ColumnConfig<TRow>[];
}

/**
 * Hook for programmatic access to a grid instance.
 *
 * ## Usage
 *
 * ```tsx
 * import { DataGrid, useGrid } from '@toolbox-web/grid-react';
 *
 * function MyComponent() {
 *   const { ref, isReady, getConfig, forceLayout } = useGrid<Employee>();
 *
 *   const handleResize = async () => {
 *     await forceLayout();
 *   };
 *
 *   const handleExport = async () => {
 *     const config = await getConfig();
 *     console.log('Exporting with columns:', config?.columns);
 *   };
 *
 *   return (
 *     <>
 *       <button onClick={handleResize}>Force Layout</button>
 *       <button onClick={handleExport} disabled={!isReady}>Export</button>
 *       <DataGrid ref={ref} rows={rows} />
 *     </>
 *   );
 * }
 * ```
 */
export function useGrid<TRow = unknown>(): UseGridReturn<TRow> {
  const ref = useRef<DataGridRef<TRow>>(null);
  const [isReady, setIsReady] = useState(false);
  const [config, setConfig] = useState<GridConfig<TRow> | null>(null);

  // Wait for grid ready
  useEffect(() => {
    const gridRef = ref.current;
    if (!gridRef) return;

    let mounted = true;

    const checkReady = async () => {
      try {
        await gridRef.ready?.();
        if (mounted) {
          setIsReady(true);
          const effectiveConfig = await gridRef.getConfig?.();
          if (mounted && effectiveConfig) {
            setConfig(effectiveConfig as GridConfig<TRow>);
          }
        }
      } catch {
        // Grid not ready yet
      }
    };

    checkReady();

    return () => {
      mounted = false;
    };
  }, []);

  const getConfig = useCallback(async () => {
    const gridRef = ref.current;
    if (!gridRef) return null;
    const effectiveConfig = await gridRef.getConfig?.();
    return (effectiveConfig as GridConfig<TRow>) ?? null;
  }, []);

  const forceLayout = useCallback(async () => {
    const gridRef = ref.current;
    if (!gridRef) return;
    await gridRef.forceLayout?.();
  }, []);

  const toggleGroup = useCallback(async (key: string) => {
    const gridRef = ref.current;
    if (!gridRef) return;
    await gridRef.toggleGroup?.(key);
  }, []);

  const registerStyles = useCallback((id: string, css: string) => {
    ref.current?.registerStyles?.(id, css);
  }, []);

  const unregisterStyles = useCallback((id: string) => {
    ref.current?.unregisterStyles?.(id);
  }, []);

  const getVisibleColumns = useCallback(() => {
    if (!config?.columns) return [];
    return config.columns.filter((col) => !col.hidden);
  }, [config]);

  // ═══════════════════════════════════════════════════════════════════
  // SELECTION CONVENIENCE METHODS
  // ═══════════════════════════════════════════════════════════════════

  const selectAll = useCallback(() => {
    const element = ref.current?.element as any;
    const plugin = element?.getPluginByName?.('selection');
    if (!plugin) {
      console.warn('[useGrid] selectAll requires SelectionPlugin');
      return;
    }
    // Row mode: select all row indices
    if (plugin.config?.mode === 'row') {
      const rows = element?.rows ?? [];
      const allIndices = new Set<number>(rows.map((_: unknown, i: number) => i));
      plugin.selected = allIndices;
      plugin.requestAfterRender?.();
    }
  }, []);

  const clearSelection = useCallback(() => {
    const element = ref.current?.element as any;
    const plugin = element?.getPluginByName?.('selection');
    if (!plugin) return;
    plugin.clearSelection?.();
  }, []);

  const getSelectedIndices = useCallback((): Set<number> => {
    const element = ref.current?.element as any;
    const plugin = element?.getPluginByName?.('selection');
    if (!plugin) return new Set();
    return new Set(plugin.selected ?? []);
  }, []);

  const getSelectedRows = useCallback((): TRow[] => {
    const element = ref.current?.element as any;
    const plugin = element?.getPluginByName?.('selection');
    if (!plugin) return [];
    const rows = element?.rows ?? [];
    const selected = plugin.selected ?? new Set();
    return rows.filter((_: TRow, i: number) => selected.has(i));
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // EXPORT CONVENIENCE METHODS
  // ═══════════════════════════════════════════════════════════════════

  const exportToCsv = useCallback((filename?: string) => {
    const element = ref.current?.element as any;
    const plugin = element?.getPluginByName?.('export');
    if (!plugin) {
      console.warn('[useGrid] exportToCsv requires ExportPlugin (use export prop)');
      return;
    }
    plugin.exportCsv?.({ filename: filename ?? 'export.csv' });
  }, []);

  const exportToJson = useCallback((filename?: string) => {
    const element = ref.current?.element as any;
    const plugin = element?.getPluginByName?.('export');
    if (!plugin) {
      console.warn('[useGrid] exportToJson requires ExportPlugin (use export prop)');
      return;
    }
    plugin.exportJson?.({ filename: filename ?? 'export.json' });
  }, []);

  return {
    ref,
    element: ref.current?.element ?? null,
    isReady,
    config,
    getConfig,
    forceLayout,
    toggleGroup,
    registerStyles,
    unregisterStyles,
    getVisibleColumns,
    // Selection methods
    selectAll,
    clearSelection,
    getSelectedIndices,
    getSelectedRows,
    // Export methods
    exportToCsv,
    exportToJson,
  };
}
