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
  type DateDataRange,
  type FilterConfig,
  type FilterModel,
  type FilterPanelParams,
  type NumericDataRange,
} from '@toolbox-web/grid/plugins/filtering';
import type { ReactNode } from 'react';
import { useCallback, useContext } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
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
    options.filterPanelRenderer = (container: HTMLElement, params: FilterPanelParams) => {
      const wrapper = document.createElement('div');
      wrapper.style.display = 'contents';
      const root = createRoot(wrapper);
      flushSync(() => {
        root.render(reactFn(params) as React.ReactElement);
      });
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

  /**
   * Get set filters whose values no longer match any rows in the current data.
   */
  getStaleFilters: () => FilterModel[];

  /**
   * Check if all unique values are selected for a set filter field.
   */
  isAllSelected: (field: string) => boolean;

  /**
   * Check if a set filter has some but not all values selected.
   */
  isIndeterminate: (field: string) => boolean;

  /**
   * Get the currently selected values for a set filter field.
   */
  getSelectedValues: (field: string) => unknown[];

  /**
   * Get unique values sorted by selection state (selected first).
   */
  getUniqueValuesSortedBySelection: (field: string) => unknown[];

  /**
   * Get a summary label for a set filter (e.g. 'All', 'None', 'A, B +2 more').
   */
  getFilterSummaryLabel: (field: string, maxItems?: number) => string;

  /**
   * Get the numeric min/max range for a column's values.
   */
  getNumericDataRange: (field: string) => NumericDataRange | null;

  /**
   * Get the date range (earliest/latest) for a column's values.
   */
  getDateDataRange: (field: string) => DateDataRange | null;

  /**
   * Check if a field has a blank or notBlank filter active.
   */
  isBlankFilter: (field: string) => boolean;

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
 */
export function useGridFiltering(): FilteringMethods {
  const gridRef = useContext(GridElementContext);

  const getPlugin = useCallback((): FilteringPlugin | undefined => {
    const grid = gridRef?.current as DataGridElement | null;
    return grid?.getPluginByName('filtering');
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

  const getStaleFilters = useCallback(() => getPlugin()?.getStaleFilters() ?? [], [getPlugin]);

  const isAllSelected = useCallback((field: string) => getPlugin()?.isAllSelected(field) ?? true, [getPlugin]);

  const isIndeterminate = useCallback((field: string) => getPlugin()?.isIndeterminate(field) ?? false, [getPlugin]);

  const getSelectedValues = useCallback((field: string) => getPlugin()?.getSelectedValues(field) ?? [], [getPlugin]);

  const getUniqueValuesSortedBySelection = useCallback(
    (field: string) => getPlugin()?.getUniqueValuesSortedBySelection(field) ?? [],
    [getPlugin],
  );

  const getFilterSummaryLabel = useCallback(
    (field: string, maxItems?: number) => getPlugin()?.getFilterSummaryLabel(field, maxItems) ?? 'All',
    [getPlugin],
  );

  const getNumericDataRange = useCallback(
    (field: string) => getPlugin()?.getNumericDataRange(field) ?? null,
    [getPlugin],
  );

  const getDateDataRange = useCallback((field: string) => getPlugin()?.getDateDataRange(field) ?? null, [getPlugin]);

  const isBlankFilter = useCallback((field: string) => getPlugin()?.isBlankFilter(field) ?? false, [getPlugin]);

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
    isAllSelected,
    isIndeterminate,
    getSelectedValues,
    getUniqueValuesSortedBySelection,
    getFilterSummaryLabel,
    getNumericDataRange,
    getDateDataRange,
    isBlankFilter,
    getBlankMode,
    toggleBlankFilter,
  };
}
