import { InjectionToken, InputSignal, OutputEmitterRef } from '@angular/core';

/**
 * Interface for Angular components used as cell editors in the grid.
 *
 * Components implementing this interface can be used inside `<tbw-grid-column-editor>`
 * and will automatically receive cell data via inputs and emit changes via outputs.
 *
 * ## Usage
 *
 * ```typescript
 * import { Component, input, output } from '@angular/core';
 * import { GridCellEditor, GRID_CELL_EDITOR } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   selector: 'app-status-select',
 *   template: `
 *     <select [value]="value()" (change)="onChange($event)">
 *       <option value="active">Active</option>
 *       <option value="inactive">Inactive</option>
 *     </select>
 *   `,
 *   providers: [{ provide: GRID_CELL_EDITOR, useExisting: StatusSelectComponent }]
 * })
 * export class StatusSelectComponent implements GridCellEditor<string> {
 *   value = input.required<string>();
 *   row = input<unknown>();
 *   column = input<unknown>();
 *
 *   commit = output<string>();
 *   cancel = output<void>();
 *
 *   onChange(event: Event) {
 *     this.commit.emit((event.target as HTMLSelectElement).value);
 *   }
 * }
 * ```
 *
 * Then use in your template:
 * ```html
 * <tbw-grid-column field="status" editable>
 *   <tbw-grid-column-editor>
 *     <app-status-select />
 *   </tbw-grid-column-editor>
 * </tbw-grid-column>
 * ```
 */
export interface GridCellEditor<TValue = unknown, TRow = unknown> {
  /**
   * The current cell value for editing.
   * This is automatically set by the grid adapter.
   */
  value: InputSignal<TValue>;

  /**
   * The full row data object.
   * Optional - only needed if your editor needs access to other columns.
   */
  row?: InputSignal<TRow>;

  /**
   * The column configuration object.
   * Optional - only needed if your editor needs column metadata.
   */
  column?: InputSignal<unknown>;

  /**
   * Emit when the user commits the edited value.
   * The grid will update the cell with this value.
   */
  commit: OutputEmitterRef<TValue>;

  /**
   * Emit when the user cancels editing.
   * The grid will revert to the original value.
   */
  cancel: OutputEmitterRef<void>;
}

/**
 * Injection token for cell editor components.
 *
 * Components must provide themselves with this token to be auto-discovered:
 * ```typescript
 * @Component({
 *   providers: [{ provide: GRID_CELL_EDITOR, useExisting: MyEditorComponent }]
 * })
 * ```
 */
export const GRID_CELL_EDITOR = new InjectionToken<GridCellEditor>('GridCellEditor');
