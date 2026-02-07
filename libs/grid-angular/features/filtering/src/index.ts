/**
 * Filtering feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `filtering` input on Grid directive.
 * Also exports `injectGridFiltering()` for programmatic filter control.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/filtering';
 *
 * <tbw-grid [filtering]="true" />
 * <tbw-grid [filtering]="{ debounceMs: 200 }" />
 * ```
 *
 * @example Using injectGridFiltering
 * ```typescript
 * import { injectGridFiltering } from '@toolbox-web/grid-angular/features/filtering';
 *
 * @Component({...})
 * export class MyComponent {
 *   private filtering = injectGridFiltering();
 *
 *   filterByStatus(status: string) {
 *     this.filtering.setFilter('status', { operator: 'equals', value: status });
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

import { ElementRef, inject, signal, type Signal } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { registerFeature } from '@toolbox-web/grid-angular';
import { FilteringPlugin, type FilterModel } from '@toolbox-web/grid/plugins/filtering';

registerFeature('filtering', (config) => {
  if (config === true) {
    return new FilteringPlugin();
  }
  return new FilteringPlugin(config ?? undefined);
});

/**
 * Filtering methods returned from injectGridFiltering.
 *
 * Uses lazy discovery - the grid is found on first method call, not during initialization.
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
   * Signal indicating if grid is ready.
   */
  isReady: Signal<boolean>;
}

/**
 * Angular inject function for programmatic filter control.
 *
 * Uses **lazy grid discovery** - the grid element is found when methods are called,
 * not during initialization.
 *
 * @example
 * ```typescript
 * import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
 * import { Grid } from '@toolbox-web/grid-angular';
 * import '@toolbox-web/grid-angular/features/filtering';
 * import { injectGridFiltering } from '@toolbox-web/grid-angular/features/filtering';
 *
 * @Component({
 *   selector: 'app-my-grid',
 *   imports: [Grid],
 *   schemas: [CUSTOM_ELEMENTS_SCHEMA],
 *   template: `
 *     <input (input)="applyFilter($event)" placeholder="Filter by name..." />
 *     <span>{{ filtering.getFilteredRowCount() }} results</span>
 *     <button (click)="filtering.clearAllFilters()">Clear</button>
 *     <tbw-grid [rows]="rows" [filtering]="true"></tbw-grid>
 *   `
 * })
 * export class MyGridComponent {
 *   filtering = injectGridFiltering();
 *
 *   applyFilter(event: Event) {
 *     const value = (event.target as HTMLInputElement).value;
 *     this.filtering.setFilter('name', value ? { operator: 'contains', value } : null);
 *   }
 * }
 * ```
 */
export function injectGridFiltering(): FilteringMethods {
  const elementRef = inject(ElementRef);
  const isReady = signal(false);

  let cachedGrid: DataGridElement | null = null;
  let readyPromiseStarted = false;

  const getGrid = (): DataGridElement | null => {
    if (cachedGrid) return cachedGrid;

    const grid = elementRef.nativeElement.querySelector('tbw-grid') as DataGridElement | null;
    if (grid) {
      cachedGrid = grid;
      if (!readyPromiseStarted) {
        readyPromiseStarted = true;
        grid.ready?.().then(() => isReady.set(true));
      }
    }
    return grid;
  };

  const getPlugin = (): FilteringPlugin | undefined => {
    return getGrid()?.getPlugin(FilteringPlugin);
  };

  return {
    isReady: isReady.asReadonly(),

    setFilter: (field: string, filter: Omit<FilterModel, 'field'> | null) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:filtering] FilteringPlugin not found.\n\n` +
            `  → Enable filtering on the grid:\n` +
            `    <tbw-grid [filtering]="true" />`,
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
            `    <tbw-grid [filtering]="true" />`,
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
            `    <tbw-grid [filtering]="true" />`,
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
            `    <tbw-grid [filtering]="true" />`,
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
