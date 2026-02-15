import { Directive, input } from '@angular/core';
import type { FilterPanelParams } from '@toolbox-web/grid/plugins/filtering';
import type { FilterPanel } from './angular-column-config';

/**
 * Base class for Angular filter panel components.
 *
 * Provides a ready-made `params` input and common lifecycle helpers
 * (`applyAndClose`, `clearAndClose`) so consumers only need to implement
 * their filter logic in `applyFilter()`.
 *
 * ## Usage
 *
 * ```typescript
 * import { Component } from '@angular/core';
 * import { BaseFilterPanel } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   selector: 'app-text-filter',
 *   template: `
 *     <input #input (keydown.enter)="applyAndClose()" />
 *     <button (click)="applyAndClose()">Apply</button>
 *     <button (click)="clearAndClose()">Clear</button>
 *   `
 * })
 * export class TextFilterComponent extends BaseFilterPanel {
 *   @ViewChild('input') input!: ElementRef<HTMLInputElement>;
 *
 *   applyFilter(): void {
 *     this.params().applyTextFilter('contains', this.input.nativeElement.value);
 *   }
 * }
 * ```
 *
 * ## Template Syntax
 *
 * The grid's filtering plugin will mount this component and provide `params`
 * automatically. No manual wiring is required:
 *
 * ```typescript
 * gridConfig = {
 *   columns: [
 *     { field: 'name', filterable: true, filterPanel: TextFilterComponent },
 *   ],
 * };
 * ```
 *
 * @typeParam TRow - The row data type (available via `params().column`)
 */
@Directive()
export abstract class BaseFilterPanel implements FilterPanel {
  /**
   * Filter panel parameters injected by the grid's filtering plugin.
   *
   * Provides access to:
   * - `field` — the column field name
   * - `column` — full column configuration
   * - `uniqueValues` — distinct values in the column
   * - `excludedValues` — currently excluded values (set filter)
   * - `searchText` — current search text
   * - `applySetFilter(excluded)` — apply a set-based (include/exclude) filter
   * - `applyTextFilter(operator, value, valueTo?)` — apply a text/number filter
   * - `clearFilter()` — clear the filter for this column
   * - `closePanel()` — close the filter panel
   */
  readonly params = input.required<FilterPanelParams>();

  /**
   * Implement this to apply your filter logic.
   *
   * Called by {@link applyAndClose} before closing the panel.
   * Use `this.params()` to access the filter API.
   *
   * @example
   * ```typescript
   * applyFilter(): void {
   *   this.params().applyTextFilter('contains', this.searchText);
   * }
   * ```
   */
  abstract applyFilter(): void;

  /**
   * Apply the filter then close the panel.
   *
   * Calls {@link applyFilter} followed by `params().closePanel()`.
   * Bind this to your "Apply" button or Enter key handler.
   */
  applyAndClose(): void {
    this.applyFilter();
    this.params().closePanel();
  }

  /**
   * Clear the filter then close the panel.
   *
   * Calls `params().clearFilter()` followed by `params().closePanel()`.
   * Bind this to your "Clear" / "Reset" button.
   */
  clearAndClose(): void {
    this.params().clearFilter();
    this.params().closePanel();
  }
}
