/**
 * Angular-specific column configuration types.
 *
 * These types extend the base grid column config to allow Angular component
 * classes to be used directly as renderers and editors.
 */
import type { Type } from '@angular/core';
import type { ColumnConfig, GridConfig } from '@toolbox-web/grid';

/**
 * Interface for Angular renderer components.
 *
 * Renderer components receive the cell value, row data, and column config as inputs.
 * Use Angular signal inputs for reactive updates.
 *
 * @example
 * ```typescript
 * import { Component, input } from '@angular/core';
 * import type { AngularCellRenderer } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   selector: 'app-status-badge',
 *   template: `<span [class]="'badge-' + value()">{{ value() }}</span>`
 * })
 * export class StatusBadgeComponent implements AngularCellRenderer<Employee, string> {
 *   value = input.required<string>();
 *   row = input.required<Employee>();
 *   column = input<unknown>();
 * }
 * ```
 */
export interface AngularCellRenderer<TRow = unknown, TValue = unknown> {
  /** The cell value - use `input<TValue>()` or `input.required<TValue>()` */
  value: { (): TValue | undefined };
  /** The full row data - use `input<TRow>()` or `input.required<TRow>()` */
  row: { (): TRow | undefined };
  /** The column configuration (optional) - use `input<unknown>()` */
  column?: { (): unknown };
}

/**
 * Interface for Angular editor components.
 *
 * Editor components receive the cell value, row data, and column config as inputs,
 * plus must emit `commit` and `cancel` outputs.
 *
 * @example
 * ```typescript
 * import { Component, input, output } from '@angular/core';
 * import type { AngularCellEditor } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   selector: 'app-status-editor',
 *   template: `
 *     <select [value]="value()" (change)="commit.emit($any($event.target).value)">
 *       <option value="active">Active</option>
 *       <option value="inactive">Inactive</option>
 *     </select>
 *   `
 * })
 * export class StatusEditorComponent implements AngularCellEditor<Employee, string> {
 *   value = input.required<string>();
 *   row = input.required<Employee>();
 *   column = input<unknown>();
 *   commit = output<string>();
 *   cancel = output<void>();
 * }
 * ```
 */
export interface AngularCellEditor<TRow = unknown, TValue = unknown> extends AngularCellRenderer<TRow, TValue> {
  /** Emit to commit the new value - use `output<TValue>()` */
  commit: { emit(value: TValue): void; subscribe?(fn: (value: TValue) => void): { unsubscribe(): void } };
  /** Emit to cancel editing - use `output<void>()` */
  cancel: { emit(): void; subscribe?(fn: () => void): { unsubscribe(): void } };
}

/**
 * Angular-specific column configuration.
 *
 * Extends the base ColumnConfig to allow Angular component classes
 * to be used directly as renderers and editors.
 *
 * @example
 * ```typescript
 * import type { AngularColumnConfig } from '@toolbox-web/grid-angular';
 * import { StatusBadgeComponent, StatusEditorComponent } from './components';
 *
 * const columns: AngularColumnConfig<Employee>[] = [
 *   { field: 'name', header: 'Name' },
 *   {
 *     field: 'status',
 *     header: 'Status',
 *     editable: true,
 *     renderer: StatusBadgeComponent,
 *     editor: StatusEditorComponent,
 *   },
 * ];
 * ```
 */
export interface AngularColumnConfig<TRow = unknown> extends Omit<ColumnConfig<TRow>, 'renderer' | 'editor'> {
  /**
   * Cell renderer - can be:
   * - A function `(ctx) => HTMLElement | string`
   * - An Angular component class implementing AngularCellRenderer
   */
  renderer?: ColumnConfig<TRow>['renderer'] | Type<AngularCellRenderer<TRow, unknown>>;

  /**
   * Cell editor - can be:
   * - A function `(ctx) => HTMLElement`
   * - An Angular component class implementing AngularCellEditor
   */
  editor?: ColumnConfig<TRow>['editor'] | Type<AngularCellEditor<TRow, unknown>>;
}

/**
 * Angular-specific type default configuration.
 *
 * Extends the base TypeDefault to allow Angular component classes
 * for renderers and editors in typeDefaults.
 *
 * @example
 * ```typescript
 * const config: AngularGridConfig<Employee> = {
 *   typeDefaults: {
 *     boolean: {
 *       renderer: (ctx) => { ... },  // vanilla JS renderer
 *       editor: CheckboxEditorComponent, // Angular component
 *     },
 *     date: {
 *       editor: DatePickerComponent, // Angular component
 *     }
 *   }
 * };
 * ```
 */
export interface AngularTypeDefault<TRow = unknown> {
  /** Format function for cell display */
  format?: (value: unknown, row: TRow) => string;
  /** Cell renderer - can be vanilla JS function or Angular component */
  renderer?: ColumnConfig<TRow>['renderer'] | Type<AngularCellRenderer<TRow, unknown>>;
  /** Cell editor - can be vanilla JS function or Angular component */
  editor?: ColumnConfig<TRow>['editor'] | Type<AngularCellEditor<TRow, unknown>>;
  /** Default editor parameters */
  editorParams?: Record<string, unknown>;
}

/**
 * Angular-specific grid configuration.
 *
 * Extends the base GridConfig to use AngularColumnConfig and AngularTypeDefault.
 */
export interface AngularGridConfig<TRow = unknown> extends Omit<GridConfig<TRow>, 'columns' | 'typeDefaults'> {
  columns?: AngularColumnConfig<TRow>[];
  /** Type-level defaults that can use Angular component classes */
  typeDefaults?: Record<string, AngularTypeDefault<TRow>>;
}

/**
 * Type guard to check if a value is an Angular component class.
 *
 * Detects Angular components by checking for internal Angular markers:
 * - ɵcmp (component definition)
 * - ɵfac (factory function)
 *
 * Also checks if it's an ES6 class (vs function) by inspecting the
 * string representation.
 */
export function isComponentClass(value: unknown): value is Type<unknown> {
  if (typeof value !== 'function' || value.prototype === undefined) {
    return false;
  }

  // Check for Angular component markers (AOT compiled)
  if (Object.prototype.hasOwnProperty.call(value, 'ɵcmp') || Object.prototype.hasOwnProperty.call(value, 'ɵfac')) {
    return true;
  }

  // Check if it's an ES6 class (vs regular function)
  // Class definitions start with "class" in their toString()
  const fnString = Function.prototype.toString.call(value);
  return fnString.startsWith('class ') || fnString.startsWith('class{');
}
