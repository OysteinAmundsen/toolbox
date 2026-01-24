import type { ColumnConfig, DataGridElement, GridConfig } from '@toolbox-web/grid';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DataGridRef } from './data-grid';

/**
 * Return type for useGrid hook.
 */
export interface UseGridReturn<TRow = unknown> {
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
  };
}
