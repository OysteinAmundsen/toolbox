/**
 * Angular-specific column configuration types.
 *
 * These types extend the base grid column config to allow Angular component
 * classes to be used directly as renderers and editors.
 */
import type { Type } from '@angular/core';
import type { ColumnConfig as BaseColumnConfig, GridConfig as BaseGridConfig } from '@toolbox-web/grid';
import type { FilterPanelParams, FilterPanelRenderer } from '@toolbox-web/grid/plugins/filtering';

// #region CellRenderer Interface
/**
 * Interface for cell renderer components.
 *
 * Renderer components receive the cell value, row data, and column config as inputs.
 * Use Angular signal inputs for reactive updates.
 *
 * @example
 * ```typescript
 * import { Component, input } from '@angular/core';
 * import type { CellRenderer } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   selector: 'app-status-badge',
 *   template: `<span [class]="'badge-' + value()">{{ value() }}</span>`
 * })
 * export class StatusBadgeComponent implements CellRenderer<Employee, string> {
 *   value = input.required<string>();
 *   row = input.required<Employee>();
 *   column = input<unknown>();
 * }
 * ```
 */
export interface CellRenderer<TRow = unknown, TValue = unknown> {
  /** The cell value - use `input<TValue>()` or `input.required<TValue>()` */
  value: { (): TValue | undefined };
  /** The full row data - use `input<TRow>()` or `input.required<TRow>()` */
  row: { (): TRow | undefined };
  /** The column configuration (optional) - use `input<unknown>()` */
  column?: { (): unknown };
}

/**
 * @deprecated Use `CellRenderer` instead.
 * @see {@link CellRenderer}
 */
export type AngularCellRenderer<TRow = unknown, TValue = unknown> = CellRenderer<TRow, TValue>;
// #endregion

// #region CellEditor Interface
/**
 * Interface for cell editor components.
 *
 * Editor components receive the cell value, row data, and column config as inputs,
 * plus must emit `commit` and `cancel` outputs.
 *
 * @example
 * ```typescript
 * import { Component, input, output } from '@angular/core';
 * import type { CellEditor } from '@toolbox-web/grid-angular';
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
 * export class StatusEditorComponent implements CellEditor<Employee, string> {
 *   value = input.required<string>();
 *   row = input.required<Employee>();
 *   column = input<unknown>();
 *   commit = output<string>();
 *   cancel = output<void>();
 * }
 * ```
 */
export interface CellEditor<TRow = unknown, TValue = unknown> extends CellRenderer<TRow, TValue> {
  /** Emit to commit the new value - use `output<TValue>()` */
  commit: { emit(value: TValue): void; subscribe?(fn: (value: TValue) => void): { unsubscribe(): void } };
  /** Emit to cancel editing - use `output<void>()` */
  cancel: { emit(): void; subscribe?(fn: () => void): { unsubscribe(): void } };
}

/**
 * @deprecated Use `CellEditor` instead.
 * @see {@link CellEditor}
 */
export type AngularCellEditor<TRow = unknown, TValue = unknown> = CellEditor<TRow, TValue>;
// #endregion

// #region FilterPanel Interface
/**
 * Interface for filter panel components.
 *
 * Filter panel components receive the full `FilterPanelParams` as a single input,
 * providing access to field info, unique values, and filter action methods.
 *
 * @example
 * ```typescript
 * import { Component, input } from '@angular/core';
 * import type { FilterPanel } from '@toolbox-web/grid-angular';
 * import type { FilterPanelParams } from '@toolbox-web/grid/plugins/filtering';
 *
 * @Component({
 *   selector: 'app-custom-filter',
 *   template: `
 *     <div>
 *       <input (input)="onSearch($event)" />
 *       <button (click)="params().clearFilter()">Clear</button>
 *     </div>
 *   `
 * })
 * export class CustomFilterComponent implements FilterPanel {
 *   params = input.required<FilterPanelParams>();
 * }
 * ```
 */
export interface FilterPanel {
  /** The filter panel parameters — use `input.required<FilterPanelParams>()` */
  params: { (): FilterPanelParams };
}
// #endregion

// #region TypeDefault Interface
/**
 * Type default configuration.
 *
 * Allows Angular component classes for renderers and editors in typeDefaults.
 *
 * @example
 * ```typescript
 * import type { GridConfig, TypeDefault } from '@toolbox-web/grid-angular';
 *
 * const config: GridConfig<Employee> = {
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
export interface TypeDefault<TRow = unknown> {
  /** Format function for cell display */
  format?: (value: unknown, row: TRow) => string;
  /** Cell renderer - can be vanilla JS function or Angular component */
  renderer?: BaseColumnConfig<TRow>['renderer'] | Type<CellRenderer<TRow, unknown>>;
  /** Cell editor - can be vanilla JS function or Angular component */
  editor?: BaseColumnConfig<TRow>['editor'] | Type<CellEditor<TRow, unknown>>;
  /** Default editor parameters */
  editorParams?: Record<string, unknown>;
  /**
   * Custom filter panel renderer for this type. Requires FilteringPlugin.
   *
   * Can be:
   * - A vanilla `FilterPanelRenderer` function `(container, params) => void`
   * - An Angular component class implementing `FilterPanel`
   *
   * @example Using an Angular component
   * ```typescript
   * typeDefaults: {
   *   date: {
   *     filterPanelRenderer: DateFilterPanelComponent,
   *   }
   * }
   * ```
   */
  filterPanelRenderer?: FilterPanelRenderer | Type<FilterPanel>;
}

/**
 * @deprecated Use `TypeDefault` instead.
 * @see {@link TypeDefault}
 */
export type AngularTypeDefault<TRow = unknown> = TypeDefault<TRow>;
// #endregion

// #region ColumnConfig Interface
/**
 * Column configuration for Angular applications.
 *
 * Extends the base ColumnConfig to allow Angular component classes
 * to be used directly as renderers and editors.
 *
 * @example
 * ```typescript
 * import type { ColumnConfig } from '@toolbox-web/grid-angular';
 * import { StatusBadgeComponent, StatusEditorComponent } from './components';
 *
 * const columns: ColumnConfig<Employee>[] = [
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
export interface ColumnConfig<TRow = unknown> extends Omit<BaseColumnConfig<TRow>, 'renderer' | 'editor'> {
  /**
   * Cell renderer - can be:
   * - A function `(ctx) => HTMLElement | string`
   * - An Angular component class implementing CellRenderer
   */
  renderer?: BaseColumnConfig<TRow>['renderer'] | Type<CellRenderer<TRow, unknown>>;

  /**
   * Cell editor - can be:
   * - A function `(ctx) => HTMLElement`
   * - An Angular component class implementing CellEditor
   */
  editor?: BaseColumnConfig<TRow>['editor'] | Type<CellEditor<TRow, unknown>>;
}

/**
 * @deprecated Use `ColumnConfig` instead.
 * @see {@link ColumnConfig}
 */
export type AngularColumnConfig<TRow = unknown> = ColumnConfig<TRow>;
// #endregion

// #region GridConfig Interface
/**
 * Grid configuration for Angular applications.
 *
 * Extends the base GridConfig to use Angular-augmented ColumnConfig and TypeDefault.
 * This allows component classes as renderers/editors.
 *
 * @example
 * ```typescript
 * import type { GridConfig, ColumnConfig } from '@toolbox-web/grid-angular';
 *
 * const config: GridConfig<Employee> = {
 *   columns: [...],
 *   plugins: [...],
 * };
 * ```
 */
export interface GridConfig<TRow = unknown> extends Omit<BaseGridConfig<TRow>, 'columns' | 'typeDefaults'> {
  columns?: ColumnConfig<TRow>[];
  /** Type-level defaults that can use Angular component classes */
  typeDefaults?: Record<string, TypeDefault<TRow>>;
}

/**
 * @deprecated Use `GridConfig` instead.
 * @see {@link GridConfig}
 */
export type AngularGridConfig<TRow = unknown> = GridConfig<TRow>;
// #endregion

// #region Utilities
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
// #endregion
