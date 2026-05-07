import type {
  ColumnConfig as BaseColumnConfig,
  GridConfig as BaseGridConfig,
  CellRenderContext,
  ColumnEditorContext,
  HeaderCellContext,
  HeaderLabelContext,
  LoadingContext,
} from '@toolbox-web/grid';
import type { Component, VNode } from 'vue';

// #region CellRenderer Type
/**
 * Vue render function or component for cell rendering.
 *
 * Can be either:
 * - A render function receiving `CellRenderContext` and returning a `VNode`
 * - A Vue component (SFC or defineComponent)
 *
 * @example
 * ```ts
 * import type { CellRenderer, ColumnConfig } from '@toolbox-web/grid-vue';
 * import StatusBadge from './StatusBadge.vue';
 *
 * // As render function
 * const statusRenderer: CellRenderer<Employee, string> = (ctx) =>
 *   h('span', { class: ctx.value }, ctx.value);
 *
 * // As Vue component
 * const columns: ColumnConfig<Employee>[] = [
 *   { field: 'status', renderer: StatusBadge },
 * ];
 * ```
 * @since 0.1.0
 */
export type CellRenderer<TRow = unknown, TValue = unknown> =
  | ((ctx: CellRenderContext<TRow, TValue>) => VNode)
  | Component;

// #endregion

// #region CellEditor Type
/**
 * Vue render function or component for cell editing.
 *
 * Can be either:
 * - A render function receiving `ColumnEditorContext` and returning a `VNode`
 * - A Vue component (SFC or defineComponent)
 *
 * @example
 * ```ts
 * import type { CellEditor, ColumnConfig } from '@toolbox-web/grid-vue';
 *
 * const statusEditor: CellEditor<Employee, string> = (ctx) =>
 *   h(StatusSelect, {
 *     modelValue: ctx.value,
 *     'onUpdate:modelValue': ctx.commit,
 *   });
 * ```
 * @since 0.1.0
 */
export type CellEditor<TRow = unknown, TValue = unknown> =
  | ((ctx: ColumnEditorContext<TRow, TValue>) => VNode)
  | Component;

// #endregion

// #region ColumnConfig Interface
/**
 * Column configuration for Vue applications.
 *
 * Extends the base ColumnConfig with `renderer` and `editor` properties
 * that accept Vue components or render functions.
 *
 * @example
 * ```ts
 * import type { ColumnConfig } from '@toolbox-web/grid-vue';
 * import StatusBadge from './StatusBadge.vue';
 *
 * const columns: ColumnConfig<Employee>[] = [
 *   { field: 'name', header: 'Name' },
 *   {
 *     field: 'status',
 *     header: 'Status',
 *     renderer: StatusBadge,
 *     editor: (ctx) => h(StatusSelect, {
 *       modelValue: ctx.value,
 *       'onUpdate:modelValue': ctx.commit,
 *     }),
 *   },
 * ];
 * ```
 * @since 0.1.0
 */
export interface ColumnConfig<TRow = unknown, TValue = unknown> extends Omit<
  BaseColumnConfig<TRow>,
  'renderer' | 'editor' | 'headerRenderer' | 'headerLabelRenderer'
> {
  /**
   * Vue component or render function for custom cell rendering.
   * Receives CellRenderContext with value, row, column, and indexes.
   */
  renderer?: CellRenderer<TRow, TValue>;

  /**
   * Vue component or render function for custom cell editing.
   * Receives ColumnEditorContext with value, row, commit, and cancel functions.
   */
  editor?: CellEditor<TRow, TValue>;

  /**
   * Vue component or render function for custom header cell rendering.
   * Receives HeaderCellContext with column, value, sortState, filterActive, and helper functions.
   */
  headerRenderer?: ((ctx: HeaderCellContext<TRow>) => VNode) | Component;

  /**
   * Vue component or render function for custom header label rendering.
   * Receives HeaderLabelContext with column and value.
   */
  headerLabelRenderer?: ((ctx: HeaderLabelContext<TRow>) => VNode) | Component;
}

// #endregion

// #region GridConfig Interface
/**
 * Grid configuration for Vue applications.
 *
 * Extends the base GridConfig with Vue-augmented ColumnConfig support.
 *
 * @example
 * ```ts
 * import type { GridConfig } from '@toolbox-web/grid-vue';
 * import { SelectionPlugin } from '@toolbox-web/grid/all';
 *
 * const config: GridConfig<Employee> = {
 *   columns: [
 *     { field: 'name', header: 'Name' },
 *     {
 *       field: 'department',
 *       header: 'Department',
 *       renderer: (ctx) => h('span', { class: 'badge' }, ctx.value),
 *     },
 *   ],
 *   plugins: [new SelectionPlugin({ mode: 'row' })],
 * };
 * ```
 * @since 0.1.0
 */
export interface GridConfig<TRow = unknown> extends Omit<BaseGridConfig<TRow>, 'columns' | 'loadingRenderer'> {
  /**
   * Column definitions with Vue renderer/editor support.
   */
  columns?: ColumnConfig<TRow>[];

  /**
   * Custom loading renderer - can be:
   * - A vanilla function `(ctx: LoadingContext) => HTMLElement | string`
   * - A Vue component with a `size` prop
   * - A Vue render function `(ctx: LoadingContext) => VNode`
   */
  loadingRenderer?: BaseGridConfig<TRow>['loadingRenderer'] | ((ctx: LoadingContext) => VNode) | Component;
}

// #endregion
