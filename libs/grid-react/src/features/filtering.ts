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
import { FilteringPlugin, type FilterModel } from '@toolbox-web/grid/plugins/filtering';
import { useCallback, useContext } from 'react';
import { GridElementContext } from '../lib/data-grid';
import { registerFeature } from '../lib/feature-registry';

registerFeature('filtering', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as any) ?? {});
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
   */
  setFilter: (field: string, filter: Omit<FilterModel, 'field'> | null) => void;

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
   */
  setFilterModel: (filters: FilterModel[]) => void;

  /**
   * Clear all active filters.
   */
  clearAllFilters: () => void;

  /**
   * Clear filter for a specific field.
   */
  clearFieldFilter: (field: string) => void;

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
 */
export function useGridFiltering(): FilteringMethods {
  const gridRef = useContext(GridElementContext);

  const getPlugin = useCallback((): FilteringPlugin | undefined => {
    const grid = gridRef?.current as DataGridElement | null;
    return grid?.getPlugin(FilteringPlugin);
  }, [gridRef]);

  const setFilter = useCallback(
    (field: string, filter: Omit<FilterModel, 'field'> | null) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:filtering] FilteringPlugin not found.\n\n` +
            `  → Enable filtering on the grid:\n` +
            `    <DataGrid filtering />`,
        );
        return;
      }
      plugin.setFilter(field, filter);
    },
    [getPlugin],
  );

  const getFilter = useCallback((field: string) => getPlugin()?.getFilter(field), [getPlugin]);

  const getFilters = useCallback(() => getPlugin()?.getFilters() ?? [], [getPlugin]);

  const setFilterModel = useCallback(
    (filters: FilterModel[]) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:filtering] FilteringPlugin not found.\n\n` +
            `  → Enable filtering on the grid:\n` +
            `    <DataGrid filtering />`,
        );
        return;
      }
      plugin.setFilterModel(filters);
    },
    [getPlugin],
  );

  const clearAllFilters = useCallback(() => {
    const plugin = getPlugin();
    if (!plugin) {
      console.warn(
        `[tbw-grid:filtering] FilteringPlugin not found.\n\n` +
          `  → Enable filtering on the grid:\n` +
          `    <DataGrid filtering />`,
      );
      return;
    }
    plugin.clearAllFilters();
  }, [getPlugin]);

  const clearFieldFilter = useCallback(
    (field: string) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:filtering] FilteringPlugin not found.\n\n` +
            `  → Enable filtering on the grid:\n` +
            `    <DataGrid filtering />`,
        );
        return;
      }
      plugin.clearFieldFilter(field);
    },
    [getPlugin],
  );

  const isFieldFiltered = useCallback((field: string) => getPlugin()?.isFieldFiltered(field) ?? false, [getPlugin]);

  const getFilteredRowCount = useCallback(() => getPlugin()?.getFilteredRowCount() ?? 0, [getPlugin]);

  const getUniqueValues = useCallback((field: string) => getPlugin()?.getUniqueValues(field) ?? [], [getPlugin]);

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
  };
}
