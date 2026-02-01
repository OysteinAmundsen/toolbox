/**
 * Icon registry for Vue applications.
 *
 * Provides application-wide icon overrides that all grids inherit
 * automatically via Vue's provide/inject.
 */
import type { GridIcons } from '@toolbox-web/grid';
import { defineComponent, inject, provide, type InjectionKey, type PropType } from 'vue';

/**
 * Injection key for grid icons.
 */
export const GRID_ICONS: InjectionKey<Partial<GridIcons>> = Symbol('grid-icons');

/**
 * Composable to get the current icon overrides from the nearest provider.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useGridIcons } from '@toolbox-web/grid-vue';
 *
 * const icons = useGridIcons();
 * </script>
 * ```
 */
export function useGridIcons(): Partial<GridIcons> | undefined {
  return inject(GRID_ICONS, undefined);
}

/**
 * Provides application-wide icon overrides for all descendant grids.
 *
 * Wrap your application (or part of it) with this provider to customize
 * icons used by all TbwGrid components.
 *
 * @example
 * ```vue
 * <script setup>
 * import { GridIconProvider } from '@toolbox-web/grid-vue';
 *
 * const icons = {
 *   sortAsc: '↑',
 *   sortDesc: '↓',
 *   expand: '+',
 *   collapse: '−',
 * };
 * </script>
 *
 * <template>
 *   <GridIconProvider :icons="icons">
 *     <App />
 *   </GridIconProvider>
 * </template>
 * ```
 */
export const GridIconProvider = defineComponent({
  name: 'GridIconProvider',
  props: {
    /**
     * Icon overrides to provide to all descendant grids.
     */
    icons: {
      type: Object as PropType<Partial<GridIcons>>,
      required: true,
    },
  },
  setup(props, { slots }) {
    // Provide icons to descendants
    provide(GRID_ICONS, props.icons);

    // Render children
    return () => slots.default?.();
  },
});

export type GridIconProviderProps = InstanceType<typeof GridIconProvider>['$props'];
