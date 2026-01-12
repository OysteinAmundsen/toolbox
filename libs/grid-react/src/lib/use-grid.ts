import type { ColumnConfig, DataGridElement, GridConfig } from '@toolbox-web/grid';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Extended interface for DataGridElement with all methods we need.
 */
interface ExtendedGridElement extends DataGridElement {
  toggleGroup?: (key: string) => Promise<void>;
}

/**
 * Return type for useGrid hook.
 */
export interface UseGridReturn<TRow = unknown> {
  /** Ref to attach to the DataGrid component */
  ref: React.RefObject<ExtendedGridElement | null>;
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
  const ref = useRef<ExtendedGridElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [config, setConfig] = useState<GridConfig<TRow> | null>(null);

  // Wait for grid ready
  useEffect(() => {
    const grid = ref.current;
    if (!grid) return;

    let mounted = true;

    const checkReady = async () => {
      try {
        await grid.ready?.();
        if (mounted) {
          setIsReady(true);
          const effectiveConfig = await grid.getConfig?.();
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
    const grid = ref.current;
    if (!grid) return null;
    const effectiveConfig = await grid.getConfig?.();
    return (effectiveConfig as GridConfig<TRow>) ?? null;
  }, []);

  const forceLayout = useCallback(async () => {
    const grid = ref.current;
    if (!grid) return;
    await grid.forceLayout?.();
  }, []);

  const toggleGroup = useCallback(async (key: string) => {
    const grid = ref.current;
    if (!grid) return;
    await grid.toggleGroup?.(key);
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
