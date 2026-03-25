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

import { afterNextRender, DestroyRef, ElementRef, inject, signal, type Signal } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import '@toolbox-web/grid/features/filtering';
import {
  FilteringPlugin,
  type BlankMode,
  type DateDataRange,
  type FilterModel,
  type NumericDataRange,
} from '@toolbox-web/grid/plugins/filtering';

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
 * import { Component } from '@angular/core';
 * import { Grid } from '@toolbox-web/grid-angular';
 * import '@toolbox-web/grid-angular/features/filtering';
 * import { injectGridFiltering } from '@toolbox-web/grid-angular/features/filtering';
 *
 * @Component({
 *   selector: 'app-my-grid',
 *   imports: [Grid],
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
  const destroyRef = inject(DestroyRef);
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
    return getGrid()?.getPluginByName('filtering') as FilteringPlugin | undefined;
  };

  // Eagerly discover the grid after the first render so isReady updates
  // without requiring a programmatic method call. Falls back to a
  // MutationObserver for lazy-rendered tabs, *ngIf, @defer, etc.
  afterNextRender(() => {
    if (getGrid()) return;

    const host = elementRef.nativeElement as HTMLElement;
    const observer = new MutationObserver(() => {
      if (getGrid()) observer.disconnect();
    });
    observer.observe(host, { childList: true, subtree: true });

    destroyRef.onDestroy(() => observer.disconnect());
  });

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

    getBlankMode: (field: string) => getPlugin()?.getBlankMode(field) ?? 'all',

    toggleBlankFilter: (field: string, mode: BlankMode) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:filtering] FilteringPlugin not found.\n\n` +
            `  → Enable filtering on the grid:\n` +
            `    <tbw-grid [filtering]="true" />`,
        );
        return;
      }
      plugin.toggleBlankFilter(field, mode);
    },
  };
}
