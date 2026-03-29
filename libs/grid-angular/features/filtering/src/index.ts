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
import { FilteringPlugin, type BlankMode, type FilterModel } from '@toolbox-web/grid/plugins/filtering';
export type { _Augmentation as _FilteringAugmentation } from '@toolbox-web/grid/features/filtering';

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
 *
 * @param selector - Optional CSS selector to target a specific grid element.
 *   Defaults to `'tbw-grid'` (first grid in the component). Use when the
 *   component contains multiple grids, e.g. `'tbw-grid.primary'` or `'#my-grid'`.
 */
export function injectGridFiltering(selector = 'tbw-grid'): FilteringMethods {
  const elementRef = inject(ElementRef);
  const destroyRef = inject(DestroyRef);
  const isReady = signal(false);

  let cachedGrid: DataGridElement | null = null;
  let readyPromiseStarted = false;

  const getGrid = (): DataGridElement | null => {
    if (cachedGrid) return cachedGrid;

    const grid = elementRef.nativeElement.querySelector(selector) as DataGridElement | null;
    if (grid) {
      cachedGrid = grid;
      if (!readyPromiseStarted) {
        readyPromiseStarted = true;
        grid.ready?.().then(() => {
          // If the plugin is already attached, signal readiness immediately.
          // Otherwise, Angular's Grid directive may not have applied gridConfig
          // yet (it uses effect + queueMicrotask). Defer to let pending
          // microtasks flush before signaling readiness.
          if (grid.getPluginByName('filtering')) {
            isReady.set(true);
          } else {
            setTimeout(() => isReady.set(true), 0);
          }
        });
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

    setFilter: (field: string, filter: Omit<FilterModel, 'field'> | null, options?: { silent?: boolean }) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:filtering] FilteringPlugin not found.\n\n` +
            `  → Enable filtering on the grid:\n` +
            `    <tbw-grid [filtering]="true" />`,
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
            `    <tbw-grid [filtering]="true" />`,
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
            `    <tbw-grid [filtering]="true" />`,
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
            `    <tbw-grid [filtering]="true" />`,
        );
        return;
      }
      plugin.clearFieldFilter(field, options);
    },

    isFieldFiltered: (field: string) => getPlugin()?.isFieldFiltered(field) ?? false,

    getFilteredRowCount: () => getPlugin()?.getFilteredRowCount() ?? 0,

    getUniqueValues: (field: string) => getPlugin()?.getUniqueValues(field) ?? [],

    getStaleFilters: () => getPlugin()?.getStaleFilters() ?? [],

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
