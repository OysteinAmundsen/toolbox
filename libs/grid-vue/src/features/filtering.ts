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
  type FilterConfig,
  type FilterModel,
  type FilterPanelParams,
} from '@toolbox-web/grid/plugins/filtering';
import { createApp, inject, ref, type VNode } from 'vue';
import { registerFeature } from '../lib/feature-registry';
import { renderToContainer } from '../lib/teleport-bridge';
import { GRID_ELEMENT_KEY } from '../lib/use-grid';
import { registerFilterPanelTypeDefaultBridge } from '../lib/vue-grid-adapter';

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

// Install the type-default `filterPanelRenderer` bridge on the Vue adapter.
// Augments the adapter so the filtering-specific wrapping logic for
// `GridTypeProvider`-supplied filter panels (and grid-config-level
// type-defaults processed in `processConfig`) lives with the filtering
// feature, not in the central adapter file. Without this import,
// type-default filterPanelRenderer entries are dropped silently —
// filtering itself also requires this feature import (same precondition).
registerFilterPanelTypeDefaultBridge((rawRenderFn, _gridEl, { trackTeleportKey }) => {
  const vueFn = rawRenderFn as (params: FilterPanelParams) => VNode;
  return (container: HTMLElement, params: FilterPanelParams) => {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'contents';

    const teleportKey = renderToContainer(wrapper, vueFn(params));
    trackTeleportKey(teleportKey);
    container.appendChild(wrapper);
  };
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
 * @param selector - Optional CSS selector to target a specific grid element via
 *   DOM query instead of using Vue's provide/inject. Use when the component
 *   contains multiple grids, e.g. `'tbw-grid.primary'` or `'#my-grid'`.
 */
export function useGridFiltering(selector?: string): FilteringMethods {
  const gridElement = selector ? ref(null) : inject(GRID_ELEMENT_KEY, ref(null));

  const getPlugin = (): FilteringPlugin | undefined => {
    const grid = (selector ? document.querySelector(selector) : gridElement.value) as DataGridElement | null;
    return grid?.getPluginByName('filtering');
  };

  return {
    setFilter: (field: string, filter: Omit<FilterModel, 'field'> | null, options?: { silent?: boolean }) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:filtering] FilteringPlugin not found.\n\n` +
            `  → Enable filtering on the grid:\n` +
            `    <TbwGrid filtering />`,
        );
        return;
      }
      plugin.setFilter(field, filter, options);
    },

    getFilter: (field: string) => getPlugin()?.getFilter(field),

    getFilters: () => getPlugin()?.getFilters() ?? [],

    setFilterModel: (filters: FilterModel[], options?: { silent?: boolean }) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:filtering] FilteringPlugin not found.\n\n` +
            `  → Enable filtering on the grid:\n` +
            `    <TbwGrid filtering />`,
        );
        return;
      }
      plugin.setFilterModel(filters, options);
    },

    clearAllFilters: (options?: { silent?: boolean }) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:filtering] FilteringPlugin not found.\n\n` +
            `  → Enable filtering on the grid:\n` +
            `    <TbwGrid filtering />`,
        );
        return;
      }
      plugin.clearAllFilters(options);
    },

    clearFieldFilter: (field: string, options?: { silent?: boolean }) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:filtering] FilteringPlugin not found.\n\n` +
            `  → Enable filtering on the grid:\n` +
            `    <TbwGrid filtering />`,
        );
        return;
      }
      plugin.clearFieldFilter(field, options);
    },

    isFieldFiltered: (field: string) => getPlugin()?.isFieldFiltered(field) ?? false,

    getFilteredRowCount: () => getPlugin()?.getFilteredRowCount() ?? 0,

    getUniqueValues: (field: string) => getPlugin()?.getUniqueValues(field) ?? [],

    getStaleFilters: () => getPlugin()?.getStaleFilters() ?? [],

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
