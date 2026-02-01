import type { CellRenderContext, ColumnConfig, ColumnEditorContext, GridConfig } from '@toolbox-web/grid';
import type { Component, VNode } from 'vue';

/**
 * Vue component that can render a cell.
 */
export type VueCellRenderer<TRow = unknown, TValue = unknown> =
  | ((ctx: CellRenderContext<TRow, TValue>) => VNode)
  | Component;

/**
 * Vue component that can render a cell editor.
 */
export type VueCellEditor<TRow = unknown, TValue = unknown> =
  | ((ctx: ColumnEditorContext<TRow, TValue>) => VNode)
  | Component;

/**
 * Column configuration with Vue-specific renderer/editor support.
 *
 * Extends the base ColumnConfig with `renderer` and `editor` properties
 * that accept Vue components or render functions.
 *
 * @example
 * ```ts
 * const columns: VueColumnConfig<Employee>[] = [
 *   { field: 'name', header: 'Name' },
 *   {
 *     field: 'status',
 *     header: 'Status',
 *     renderer: (ctx) => h(StatusBadge, { value: ctx.value }),
 *     editor: (ctx) => h(StatusSelect, {
 *       modelValue: ctx.value,
 *       'onUpdate:modelValue': ctx.commit,
 *     }),
 *   },
 * ];
 * ```
 */
export interface VueColumnConfig<TRow = unknown, TValue = unknown> extends Omit<
  ColumnConfig<TRow>,
  'renderer' | 'editor'
> {
  /**
   * Vue component or render function for custom cell rendering.
   * Receives CellRenderContext with value, row, column, and indexes.
   */
  renderer?: VueCellRenderer<TRow, TValue>;

  /**
   * Vue component or render function for custom cell editing.
   * Receives ColumnEditorContext with value, row, commit, and cancel functions.
   */
  editor?: VueCellEditor<TRow, TValue>;
}

/**
 * Grid configuration with Vue-specific column support.
 *
 * @example
 * ```ts
 * const config: VueGridConfig<Employee> = {
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
export interface VueGridConfig<TRow = unknown> extends Omit<GridConfig<TRow>, 'columns'> {
  /**
   * Column definitions with Vue renderer/editor support.
   */
  columns?: VueColumnConfig<TRow>[];
}
