/**
 * Combined provider for type defaults and icons.
 *
 * Convenience component that combines GridTypeProvider and GridIconProvider.
 */
import type { GridIcons } from '@toolbox-web/grid';
import { defineComponent, h, type PropType, type VNode } from 'vue';
import { GridIconProvider } from './grid-icon-registry';
import { GridTypeProvider, type TypeDefaultsMap } from './grid-type-registry';

/**
 * Combined provider for type defaults and icons.
 *
 * @example
 * ```vue
 * <script setup>
 * import { GridProvider, type TypeDefaultsMap } from '@toolbox-web/grid-vue';
 * import { h } from 'vue';
 *
 * const typeDefaults: TypeDefaultsMap = {
 *   country: { renderer: (ctx) => h('span', ctx.value) },
 * };
 *
 * const icons = { sortAsc: '↑', sortDesc: '↓' };
 * </script>
 *
 * <template>
 *   <GridProvider :typeDefaults="typeDefaults" :icons="icons">
 *     <App />
 *   </GridProvider>
 * </template>
 * ```
 */
export const GridProvider = defineComponent({
  name: 'GridProvider',
  props: {
    /**
     * Type defaults to provide to all descendant grids.
     */
    typeDefaults: {
      type: Object as PropType<TypeDefaultsMap>,
      default: undefined,
    },
    /**
     * Icon overrides to provide to all descendant grids.
     */
    icons: {
      type: Object as PropType<Partial<GridIcons>>,
      default: undefined,
    },
  },
  setup(props, { slots }) {
    return () => {
      let content: VNode[] | VNode | undefined = slots.default?.();

      // Wrap with type provider if typeDefaults is provided
      if (props.typeDefaults) {
        content = h(GridTypeProvider, { defaults: props.typeDefaults }, () => content);
      }

      // Wrap with icon provider if icons is provided
      if (props.icons) {
        content = h(GridIconProvider, { icons: props.icons }, () => content);
      }

      return content;
    };
  },
});

export type GridProviderProps = InstanceType<typeof GridProvider>['$props'];
