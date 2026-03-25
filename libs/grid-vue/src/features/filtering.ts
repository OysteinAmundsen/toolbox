/**
 * Filtering feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `filtering` prop on TbwGrid.
 * Also exports `useGridFiltering()` composable for programmatic filter control.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/filtering';
 * </script>
 *
 * <template>
 *   <TbwGrid filtering />
 * </template>
 * ```
 *
 * @example Using the composable
 * ```vue
 * <script setup>
 * import { useGridFiltering } from '@toolbox-web/grid-vue/features/filtering';
 *
 * const { setFilter, clearAllFilters, getFilteredRowCount } = useGridFiltering();
 *
 * function filterByStatus(status: string) {
 *   setFilter('status', { operator: 'equals', value: status });
 * }
 * </script>
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
import { createApp, inject, ref, type VNode } from 'vue';
import { registerFeature } from '../lib/feature-registry';
import { GRID_ELEMENT_KEY } from '../lib/use-grid';

registerFeature('filtering', (rawConfig) => {
  if (rawConfig === true) {
    return new FilteringPlugin();
  }
  if (!rawConfig) {
    return new FilteringPlugin();
  }

  const config = rawConfig as FilterConfig & { filterPanelRenderer?: unknown };
  const options = { ...config } as FilterConfig;

  // Bridge Vue filterPanelRenderer (1 arg: params → VNode) to vanilla (2 args: container, params)
  if (typeof config.filterPanelRenderer === 'function' && config.filterPanelRenderer.length <= 1) {
    const vueFn = config.filterPanelRenderer as unknown as (params: FilterPanelParams) => VNode;
    options.filterPanelRenderer = (container: HTMLElement, params: FilterPanelParams) => {
      const wrapper = document.createElement('div');
      wrapper.style.display = 'contents';

      const app = createApp({
        render() {
          return vueFn(params);
        },
      });

      app.mount(wrapper);
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
 * Composable for programmatic filter control.
 *
 * Must be used within a component that contains a TbwGrid with filtering enabled.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useGridFiltering } from '@toolbox-web/grid-vue/features/filtering';
 *
 * const { setFilter, clearAllFilters, getFilteredRowCount, isFieldFiltered } = useGridFiltering();
 *
 * function applyQuickFilter(field: string, value: string) {
 *   setFilter(field, { operator: 'contains', value });
 * }
 * </script>
 *
 * <template>
 *   <input @input="applyQuickFilter('name', $event.target.value)" placeholder="Filter by name..." />
 *   <span>{{ getFilteredRowCount() }} results</span>
 *   <button @click="clearAllFilters">Clear Filters</button>
 * </template>
 * ```
 */
export function useGridFiltering(): FilteringMethods {
  const gridElement = inject(GRID_ELEMENT_KEY, ref(null));

  const getPlugin = (): FilteringPlugin | undefined => {
    const grid = gridElement.value as DataGridElement | null;
    return grid?.getPluginByName('filtering');
  };

  return {
    setFilter: (field: string, filter: Omit<FilterModel, 'field'> | null) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:filtering] FilteringPlugin not found.\n\n` +
            `  → Enable filtering on the grid:\n` +
            `    <TbwGrid filtering />`,
        );
        return;
      }
      plugin.setFilter(field, filter);
    },

    getFilter: (field: string) => getPlugin()?.getFilter(field),

    getFilters: () => getPlugin()?.getFilters() ?? [],

    setFilterModel: (filters: FilterModel[]) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:filtering] FilteringPlugin not found.\n\n` +
            `  → Enable filtering on the grid:\n` +
            `    <TbwGrid filtering />`,
        );
        return;
      }
      plugin.setFilterModel(filters);
    },

    clearAllFilters: () => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:filtering] FilteringPlugin not found.\n\n` +
            `  → Enable filtering on the grid:\n` +
            `    <TbwGrid filtering />`,
        );
        return;
      }
      plugin.clearAllFilters();
    },

    clearFieldFilter: (field: string) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:filtering] FilteringPlugin not found.\n\n` +
            `  → Enable filtering on the grid:\n` +
            `    <TbwGrid filtering />`,
        );
        return;
      }
      plugin.clearFieldFilter(field);
    },

    isFieldFiltered: (field: string) => getPlugin()?.isFieldFiltered(field) ?? false,

    getFilteredRowCount: () => getPlugin()?.getFilteredRowCount() ?? 0,

    getUniqueValues: (field: string) => getPlugin()?.getUniqueValues(field) ?? [],

    getStaleFilters: () => getPlugin()?.getStaleFilters() ?? [],

    isAllSelected: (field: string) => getPlugin()?.isAllSelected(field) ?? true,

    isIndeterminate: (field: string) => getPlugin()?.isIndeterminate(field) ?? false,

    getSelectedValues: (field: string) => getPlugin()?.getSelectedValues(field) ?? [],

    getUniqueValuesSortedBySelection: (field: string) => getPlugin()?.getUniqueValuesSortedBySelection(field) ?? [],

    getFilterSummaryLabel: (field: string, maxItems?: number) =>
      getPlugin()?.getFilterSummaryLabel(field, maxItems) ?? 'All',

    getNumericDataRange: (field: string) => getPlugin()?.getNumericDataRange(field) ?? null,

    getDateDataRange: (field: string) => getPlugin()?.getDateDataRange(field) ?? null,

    isBlankFilter: (field: string) => getPlugin()?.isBlankFilter(field) ?? false,

    getBlankMode: (field: string): BlankMode => getPlugin()?.getBlankMode(field) ?? 'all',

    toggleBlankFilter: (field: string, mode: BlankMode) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:filtering] FilteringPlugin not found.\n\n` +
            `  → Enable filtering on the grid:\n` +
            `    <TbwGrid filtering />`,
        );
        return;
      }
      plugin.toggleBlankFilter(field, mode);
    },
  };
}
