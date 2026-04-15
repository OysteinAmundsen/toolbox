/**
 * Filtering feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `filtering` prop on DataGrid.
 * Also exports `useGridFiltering()` hook for programmatic filter control.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/filtering';
 *
 * <DataGrid filtering={{ debounceMs: 200 }} />
 * ```
 *
 * @example Using the hook
 * ```tsx
 * import { useGridFiltering } from '@toolbox-web/grid-react/features/filtering';
 *
 * function FilterControls() {
 *   const { setFilter, clearAllFilters, getFilteredRowCount } = useGridFiltering();
 *
 *   return (
 *     <div>
 *       <input onChange={(e) => setFilter('name', { operator: 'contains', value: e.target.value })} />
 *       <span>{getFilteredRowCount()} results</span>
 *       <button onClick={clearAllFilters}>Clear</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @packageDocumentation
 */

import type { DataGridElement } from '@toolbox-web/grid';
import {
  FilteringPlugin,
  type BlankMode,
  type FilterConfig,
  type FilterModel,
  type FilterPanelParams,
} from '@toolbox-web/grid/plugins/filtering';
import type { ReactNode } from 'react';
import { useCallback, useContext } from 'react';
import { removeFromContainer, renderToContainer } from '../lib/portal-bridge';
import { registerFeature } from '../lib/feature-registry';
import { GridElementContext } from '../lib/grid-element-context';

registerFeature('filtering', (rawConfig) => {
  if (typeof rawConfig === 'boolean') return new FilteringPlugin();
  if (!rawConfig) return new FilteringPlugin();

  const config = rawConfig as FilterConfig & { filterPanelRenderer?: unknown };
  const options = { ...config } as FilterConfig;

  // Bridge React filterPanelRenderer (1 arg) to vanilla (2 args)
  if (typeof config.filterPanelRenderer === 'function' && config.filterPanelRenderer.length <= 1) {
    const reactFn = config.filterPanelRenderer as unknown as (params: FilterPanelParams) => ReactNode;
    // Track portal key per parent container to avoid leaks on re-render
    const containerKeys = new WeakMap<HTMLElement, string>();
    options.filterPanelRenderer = (container: HTMLElement, params: FilterPanelParams) => {
      // Remove previous portal for this container if it exists
      const prevKey = containerKeys.get(container);
      if (prevKey) removeFromContainer(prevKey);

      const wrapper = document.createElement('div');
      wrapper.style.display = 'contents';
      const key = renderToContainer(wrapper, reactFn(params) as React.ReactElement);
      containerKeys.set(container, key);
      container.appendChild(wrapper);
    };
  }

  return new FilteringPlugin(options);
});

/**
 * Filtering methods returned from useGridFiltering.
 */
export interface FilteringMethods {
  /**
   * Set a filter on a specific field.
   * @param field - The field name to filter
   * @param filter - Filter configuration, or null to remove
   * @param options - `{ silent: true }` applies the filter without emitting `filter-change`
   */
  setFilter: (field: string, filter: Omit<FilterModel, 'field'> | null, options?: { silent?: boolean }) => void;

  /**
   * Get the current filter for a field.
   */
  getFilter: (field: string) => FilterModel | undefined;

  /**
   * Get all active filters.
   */
  getFilters: () => FilterModel[];

  /**
   * Set all filters at once (replaces existing).
   * @param options - `{ silent: true }` applies filters without emitting `filter-change`
   */
  setFilterModel: (filters: FilterModel[], options?: { silent?: boolean }) => void;

  /**
   * Clear all active filters.
   * @param options - `{ silent: true }` clears filters without emitting `filter-change`
   */
  clearAllFilters: (options?: { silent?: boolean }) => void;

  /**
   * Clear filter for a specific field.
   * @param options - `{ silent: true }` clears filter without emitting `filter-change`
   */
  clearFieldFilter: (field: string, options?: { silent?: boolean }) => void;

  /**
   * Check if a field has an active filter.
   */
  isFieldFiltered: (field: string) => boolean;

  /**
   * Get the count of rows after filtering.
   */
  getFilteredRowCount: () => number;

  /**
   * Get unique values for a field (for building filter dropdowns).
   */
  getUniqueValues: (field: string) => unknown[];

  /**
   * Get set filters whose values no longer match any rows in the current data.
   */
  getStaleFilters: () => FilterModel[];

  /**
   * Get the current blank mode for a field.
   */
  getBlankMode: (field: string) => BlankMode;

  /**
   * Toggle blank filter mode for a field.
   */
  toggleBlankFilter: (field: string, mode: BlankMode) => void;
}

/**
 * Hook for programmatic filter control.
 *
 * Must be used within a DataGrid component tree with filtering enabled.
 *
 * @example
 * ```tsx
 * import { useGridFiltering } from '@toolbox-web/grid-react/features/filtering';
 *
 * function QuickFilters() {
 *   const { setFilter, clearAllFilters, getFilteredRowCount, isFieldFiltered } = useGridFiltering();
 *
 *   return (
 *     <div>
 *       <input
 *         placeholder="Filter by name..."
 *         onChange={(e) => setFilter('name', e.target.value ? { operator: 'contains', value: e.target.value } : null)}
 *       />
 *       <span>{getFilteredRowCount()} rows</span>
 *       <button onClick={clearAllFilters}>Clear All</button>
 *     </div>
 *   );
 * }
 * ```
 * @param selector - Optional CSS selector to target a specific grid element via
 *   DOM query instead of using React context. Use when the component contains
 *   multiple grids, e.g. `'tbw-grid.primary'` or `'#my-grid'`.
 */
export function useGridFiltering(selector?: string): FilteringMethods {
  const gridRef = useContext(GridElementContext);

  const getPlugin = useCallback((): FilteringPlugin | undefined => {
    const grid = (selector ? document.querySelector(selector) : gridRef?.current) as DataGridElement | null;
    return grid?.getPluginByName('filtering');
  }, [gridRef, selector]);

  const setFilter = useCallback(
    (field: string, filter: Omit<FilterModel, 'field'> | null, options?: { silent?: boolean }) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:filtering] FilteringPlugin not found.\n\n` +
            `  → Enable filtering on the grid:\n` +
            `    <DataGrid filtering />`,
        );
        return;
      }
      plugin.setFilter(field, filter, options);
    },
    [getPlugin],
  );

  const getFilter = useCallback((field: string) => getPlugin()?.getFilter(field), [getPlugin]);

  const getFilters = useCallback(() => getPlugin()?.getFilters() ?? [], [getPlugin]);

  const setFilterModel = useCallback(
    (filters: FilterModel[], options?: { silent?: boolean }) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:filtering] FilteringPlugin not found.\n\n` +
            `  → Enable filtering on the grid:\n` +
            `    <DataGrid filtering />`,
        );
        return;
      }
      plugin.setFilterModel(filters, options);
    },
    [getPlugin],
  );

  const clearAllFilters = useCallback(
    (options?: { silent?: boolean }) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:filtering] FilteringPlugin not found.\n\n` +
            `  → Enable filtering on the grid:\n` +
            `    <DataGrid filtering />`,
        );
        return;
      }
      plugin.clearAllFilters(options);
    },
    [getPlugin],
  );

  const clearFieldFilter = useCallback(
    (field: string, options?: { silent?: boolean }) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:filtering] FilteringPlugin not found.\n\n` +
            `  → Enable filtering on the grid:\n` +
            `    <DataGrid filtering />`,
        );
        return;
      }
      plugin.clearFieldFilter(field, options);
    },
    [getPlugin],
  );

  const isFieldFiltered = useCallback((field: string) => getPlugin()?.isFieldFiltered(field) ?? false, [getPlugin]);

  const getFilteredRowCount = useCallback(() => getPlugin()?.getFilteredRowCount() ?? 0, [getPlugin]);

  const getUniqueValues = useCallback((field: string) => getPlugin()?.getUniqueValues(field) ?? [], [getPlugin]);

  const getStaleFilters = useCallback(() => getPlugin()?.getStaleFilters() ?? [], [getPlugin]);

  const getBlankMode = useCallback(
    (field: string): BlankMode => getPlugin()?.getBlankMode(field) ?? 'all',
    [getPlugin],
  );

  const toggleBlankFilter = useCallback(
    (field: string, mode: BlankMode) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:filtering] FilteringPlugin not found.\n\n` +
            `  → Enable filtering on the grid:\n` +
            `    <DataGrid filtering />`,
        );
        return;
      }
      plugin.toggleBlankFilter(field, mode);
    },
    [getPlugin],
  );

  return {
    setFilter,
    getFilter,
    getFilters,
    setFilterModel,
    clearAllFilters,
    clearFieldFilter,
    isFieldFiltered,
    getFilteredRowCount,
    getUniqueValues,
    getStaleFilters,
    getBlankMode,
    toggleBlankFilter,
  };
}
