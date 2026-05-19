import { InjectionToken, InputSignal } from '@angular/core';

/**
 * Interface for Angular components used as cell renderers in the grid.
 *
 * Components implementing this interface can be used inside `<tbw-grid-column-view>`
 * and will automatically receive cell data via inputs.
 *
 * ## Usage
 *
 * ```typescript
 * import { Component, input } from '@angular/core';
 * import { GridCellRenderer, GRID_CELL_RENDERER } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   selector: 'app-status-badge',
 *   template: `<span [class]="value()">{{ value() }}</span>`,
 *   providers: [{ provide: GRID_CELL_RENDERER, useExisting: StatusBadgeComponent }]
 * })
 * export class StatusBadgeComponent implements GridCellRenderer {
 *   value = input.required<string>();
 *   row = input<unknown>();
 *   column = input<unknown>();
 * }
 * ```
 *
 * Then use in your template:
 * ```html
 * <tbw-grid-column field="status">
 *   <tbw-grid-column-view>
 *     <app-status-badge />
 *   </tbw-grid-column-view>
 * </tbw-grid-column>
 * ```
 */
export interface GridCellRenderer<TValue = unknown, TRow = unknown> {
  /**
   * The cell value for this column.
   * This is automatically set by the grid adapter.
   */
  value: InputSignal<TValue>;

  /**
   * The full row data object.
   * Optional - only needed if your renderer needs access to other columns.
   */
  row?: InputSignal<TRow>;

  /**
   * The column configuration object.
   * Optional - only needed if your renderer needs column metadata.
   */
  column?: InputSignal<unknown>;
}

/**
 * Injection token for cell renderer components.
 *
 * Components must provide themselves with this token to be auto-discovered:
 * ```typescript
 * @Component({
 *   providers: [{ provide: GRID_CELL_RENDERER, useExisting: MyRendererComponent }]
 * })
 * ```
 */
export const GRID_CELL_RENDERER = new InjectionToken<GridCellRenderer>('GridCellRenderer');
