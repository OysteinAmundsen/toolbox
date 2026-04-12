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
 *
 * @param selector - Optional CSS selector to target a specific grid element via
 *   DOM query instead of using `ref`. Use when the component contains multiple
 *   grids, e.g. `'tbw-grid.primary'` or `'#my-grid'`.
 */
export function useGrid<TRow = unknown>(selector?: string): UseGridReturn<TRow> {
  const ref = useRef<DataGridRef<TRow>>(null);
  const [isReady, setIsReady] = useState(false);
  const [config, setConfig] = useState<GridConfig<TRow> | null>(null);
  const selectorElementRef = useRef<DataGridElement<TRow> | null>(null);

  /**
   * Resolve the raw grid element. When a selector is provided, uses a cached
   * DOM query; otherwise falls back to the imperative ref handle.
   */
  const getGridElement = useCallback((): DataGridElement<TRow> | null => {
    if (selector) {
      selectorElementRef.current ??= document.querySelector(selector) as DataGridElement<TRow> | null;
      return selectorElementRef.current;
    }
    return (ref.current?.element as DataGridElement<TRow>) ?? null;
  }, [selector]);

  // Wait for grid ready
  useEffect(() => {
    let mounted = true;

    const checkReady = async () => {
      try {
        if (selector) {
          const el = document.querySelector(selector) as DataGridElement<TRow>;
          if (!el) return;
          selectorElementRef.current = el;
          await el.ready?.();
          if (mounted) {
            setIsReady(true);
            const effectiveConfig = await el.getConfig?.();
            if (mounted && effectiveConfig) {
              setConfig(effectiveConfig as GridConfig<TRow>);
            }
          }
        } else {
          const gridRef = ref.current;
          if (!gridRef) return;
          await gridRef.ready?.();
          if (mounted) {
            setIsReady(true);
            const effectiveConfig = await gridRef.getConfig?.();
            if (mounted && effectiveConfig) {
              setConfig(effectiveConfig as GridConfig<TRow>);
            }
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
  }, [selector]);

  const getConfig = useCallback(async () => {
    const el = getGridElement();
    if (el) {
      const effectiveConfig = await el.getConfig?.();
      return (effectiveConfig as GridConfig<TRow>) ?? null;
    }
    const gridRef = ref.current;
    if (!gridRef) return null;
    const effectiveConfig = await gridRef.getConfig?.();
    return (effectiveConfig as GridConfig<TRow>) ?? null;
  }, [getGridElement]);

  const forceLayout = useCallback(async () => {
    const el = getGridElement();
    if (el) {
      await el.forceLayout?.();
      return;
    }
    const gridRef = ref.current;
    if (!gridRef) return;
    await gridRef.forceLayout?.();
  }, [getGridElement]);

  const toggleGroup = useCallback(
    async (key: string) => {
      const el = getGridElement();
      if (el) {
        // toggleGroup is added by GroupingRowsPlugin, not on base DataGridElement type
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (el as any).toggleGroup?.(key);
        return;
      }
      const gridRef = ref.current;
      if (!gridRef) return;
      await gridRef.toggleGroup?.(key);
    },
    [getGridElement],
  );

  const registerStyles = useCallback(
    (id: string, css: string) => {
      const el = getGridElement();
      if (el) {
        el.registerStyles?.(id, css);
        return;
      }
      ref.current?.registerStyles?.(id, css);
    },
    [getGridElement],
  );

  const unregisterStyles = useCallback(
    (id: string) => {
      const el = getGridElement();
      if (el) {
        el.unregisterStyles?.(id);
        return;
      }
      ref.current?.unregisterStyles?.(id);
    },
    [getGridElement],
  );

  const getVisibleColumns = useCallback(() => {
    if (!config?.columns) return [];
    return config.columns.filter((col) => !col.hidden);
  }, [config]);

  return {
    ref,
    element: getGridElement(),
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
