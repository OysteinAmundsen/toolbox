/**
 * Type-level default registry for Vue applications.
 *
 * Provides application-wide type defaults for renderers and editors
 * that all grids inherit automatically via Vue's provide/inject.
 */
import type { CellRenderContext, ColumnEditorContext } from '@toolbox-web/grid';
import type { FilterPanelParams } from '@toolbox-web/grid/plugins/filtering';
import { defineComponent, inject, provide, type InjectionKey, type PropType, type VNode } from 'vue';

// #region TypeDefault Interface
/**
 * Type default configuration for Vue applications.
 *
 * Defines default renderer, editor, and editorParams for a data type
 * using Vue render functions.
 *
 * @example
 * ```ts
 * import type { TypeDefault } from '@toolbox-web/grid-vue';
 * import CountryFlag from './CountryFlag.vue';
 * import CountrySelect from './CountrySelect.vue';
 *
 * const countryDefault: TypeDefault<Employee, string> = {
 *   renderer: (ctx) => h(CountryFlag, { code: ctx.value }),
 *   editor: (ctx) => h(CountrySelect, {
 *     modelValue: ctx.value,
 *     'onUpdate:modelValue': ctx.commit,
 *   }),
 * };
 * ```
 */
export interface TypeDefault<TRow = unknown, TValue = unknown> {
  /** Vue render function for rendering cells of this type */
  renderer?: (ctx: CellRenderContext<TRow, TValue>) => VNode;
  /** Vue render function for editing cells of this type */
  editor?: (ctx: ColumnEditorContext<TRow, TValue>) => VNode;
  /** Default editorParams for this type */
  editorParams?: Record<string, unknown>;
  /**
   * Vue render function for custom filter panels for this type.
   *
   * Unlike the core imperative API `(container, params) => void`, this accepts
   * a Vue render function that receives only the params and returns a VNode.
   * The bridge handles mounting and appending to the container automatically.
   *
   * @example
   * ```ts
   * import { h } from 'vue';
   * import CustomFilter from './CustomFilter.vue';
   *
   * const typeDefault: TypeDefault = {
   *   filterPanelRenderer: (params) => h(CustomFilter, {
   *     field: params.field,
   *     uniqueValues: params.uniqueValues,
   *     onApply: (values: Set<unknown>) => params.applySetFilter(values),
   *   }),
   * };
   * ```
   */
  filterPanelRenderer?: (params: FilterPanelParams) => VNode;
}

/**
 * @deprecated Use `TypeDefault` instead.
 * @see {@link TypeDefault}
 */
export type VueTypeDefault<TRow = unknown, TValue = unknown> = TypeDefault<TRow, TValue>;
// #endregion

/**
 * Type defaults registry - a map of type names to their defaults.
 */
export type TypeDefaultsMap = Record<string, TypeDefault>;

/**
 * Injection key for type defaults.
 */
export const GRID_TYPE_DEFAULTS: InjectionKey<TypeDefaultsMap> = Symbol('grid-type-defaults');

/**
 * Composable to get the current type defaults from the nearest provider.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useGridTypeDefaults } from '@toolbox-web/grid-vue';
 *
 * const typeDefaults = useGridTypeDefaults();
 * </script>
 * ```
 */
export function useGridTypeDefaults(): TypeDefaultsMap | undefined {
  return inject(GRID_TYPE_DEFAULTS, undefined);
}

/**
 * Composable to get a specific type's default configuration.
 *
 * @param typeName - The type name to look up
 *
 * @example
 * ```vue
 * <script setup>
 * import { useTypeDefault } from '@toolbox-web/grid-vue';
 *
 * const countryDefault = useTypeDefault('country');
 * </script>
 * ```
 */
export function useTypeDefault<TRow = unknown, TValue = unknown>(
  typeName: string,
): TypeDefault<TRow, TValue> | undefined {
  const defaults = useGridTypeDefaults();
  return defaults?.[typeName] as TypeDefault<TRow, TValue> | undefined;
}

/**
 * Provides application-wide type defaults for all descendant grids.
 *
 * Wrap your application (or part of it) with this provider to make
 * type-level renderers and editors available to all TbwGrid components.
 *
 * @example
 * ```vue
 * <script setup>
 * import { GridTypeProvider, type TypeDefaultsMap } from '@toolbox-web/grid-vue';
 * import { h } from 'vue';
 * import CountryBadge from './CountryBadge.vue';
 *
 * const typeDefaults: TypeDefaultsMap = {
 *   country: {
 *     renderer: (ctx) => h(CountryBadge, { code: ctx.value }),
 *   },
 * };
 * </script>
 *
 * <template>
 *   <GridTypeProvider :defaults="typeDefaults">
 *     <App />
 *   </GridTypeProvider>
 * </template>
 * ```
 */
export const GridTypeProvider = defineComponent({
  name: 'GridTypeProvider',
  props: {
    /**
     * Type defaults to provide to all descendant grids.
     */
    defaults: {
      type: Object as PropType<TypeDefaultsMap>,
      required: true,
    },
  },
  setup(props, { slots }) {
    // Provide type defaults to descendants
    provide(GRID_TYPE_DEFAULTS, props.defaults);

    // Render children
    return () => slots.default?.();
  },
});

export type GridTypeProviderProps = InstanceType<typeof GridTypeProvider>['$props'];
