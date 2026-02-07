import type {
  ColumnConfig as BaseColumnConfig,
  GridConfig as BaseGridConfig,
  CellRenderContext,
  ColumnEditorContext,
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
 */
export type CellRenderer<TRow = unknown, TValue = unknown> =
  | ((ctx: CellRenderContext<TRow, TValue>) => VNode)
  | Component;

/**
 * @deprecated Use `CellRenderer` instead.
 * @see {@link CellRenderer}
 */
export type VueCellRenderer<TRow = unknown, TValue = unknown> = CellRenderer<TRow, TValue>;
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
 */
export type CellEditor<TRow = unknown, TValue = unknown> =
  | ((ctx: ColumnEditorContext<TRow, TValue>) => VNode)
  | Component;

/**
 * @deprecated Use `CellEditor` instead.
 * @see {@link CellEditor}
 */
export type VueCellEditor<TRow = unknown, TValue = unknown> = CellEditor<TRow, TValue>;
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
 */
export interface ColumnConfig<TRow = unknown, TValue = unknown> extends Omit<
  BaseColumnConfig<TRow>,
  'renderer' | 'editor'
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
}

/**
 * @deprecated Use `ColumnConfig` instead.
 * @see {@link ColumnConfig}
 */
export type VueColumnConfig<TRow = unknown, TValue = unknown> = ColumnConfig<TRow, TValue>;
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
 */
export interface GridConfig<TRow = unknown> extends Omit<BaseGridConfig<TRow>, 'columns'> {
  /**
   * Column definitions with Vue renderer/editor support.
   */
  columns?: ColumnConfig<TRow>[];
}

/**
 * @deprecated Use `GridConfig` instead.
 * @see {@link GridConfig}
 */
export type VueGridConfig<TRow = unknown> = GridConfig<TRow>;
// #endregion
