/**
 * Type-level default registry for Vue applications.
 *
 * Provides application-wide type defaults for renderers and editors
 * that all grids inherit automatically via Vue's provide/inject.
 */
import type { CellRenderContext, ColumnEditorContext } from '@toolbox-web/grid';
import { defineComponent, inject, provide, type InjectionKey, type PropType, type VNode } from 'vue';

/**
 * Vue-specific type default configuration.
 * Uses Vue render functions that receive the render context.
 */
export interface VueTypeDefault<TRow = unknown, TValue = unknown> {
  /** Vue render function for rendering cells of this type */
  renderer?: (ctx: CellRenderContext<TRow, TValue>) => VNode;
  /** Vue render function for editing cells of this type */
  editor?: (ctx: ColumnEditorContext<TRow, TValue>) => VNode;
  /** Default editorParams for this type */
  editorParams?: Record<string, unknown>;
}

/**
 * Type defaults registry - a map of type names to their defaults.
 */
export type TypeDefaultsMap = Record<string, VueTypeDefault>;

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
): VueTypeDefault<TRow, TValue> | undefined {
  const defaults = useGridTypeDefaults();
  return defaults?.[typeName] as VueTypeDefault<TRow, TValue> | undefined;
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
