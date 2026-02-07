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
import { FilteringPlugin, type FilterModel } from '@toolbox-web/grid/plugins/filtering';
import { inject, ref } from 'vue';
import { registerFeature } from '../lib/feature-registry';
import { GRID_ELEMENT_KEY } from '../lib/use-grid';

registerFeature('filtering', (config) => {
  if (config === true) {
    return new FilteringPlugin();
  }
  return new FilteringPlugin(config ?? undefined);
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
    return grid?.getPlugin(FilteringPlugin);
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
  };
}
