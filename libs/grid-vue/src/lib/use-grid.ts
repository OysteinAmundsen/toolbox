import type { DataGridElement } from '@toolbox-web/grid';
import { inject, ref, type InjectionKey, type Ref } from 'vue';

/**
 * Injection key for the grid element.
 */
export const GRID_ELEMENT_KEY: InjectionKey<Ref<DataGridElement | null>> = Symbol('tbw-grid');

/**
 * Return type for useGrid composable.
 */
export interface UseGridReturn {
  /** The grid element reference */
  gridElement: Ref<DataGridElement | null>;
  /** Force a layout recalculation */
  forceLayout: () => Promise<void>;
  /** Get current grid configuration */
  getConfig: () => ReturnType<DataGridElement['getConfig']> | undefined;
  /** Wait for grid to be ready */
  ready: () => Promise<void>;
  /** Get a plugin by its class */
  getPlugin: <T>(pluginClass: new (...args: unknown[]) => T) => T | undefined;
}

/**
 * Composable for programmatic access to the grid.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useGrid } from '@toolbox-web/grid-vue';
 *
 * const { forceLayout, getConfig } = useGrid();
 *
 * async function handleResize() {
 *   await forceLayout();
 * }
 * </script>
 * ```
 */
export function useGrid(): UseGridReturn {
  const gridElement = inject(GRID_ELEMENT_KEY, ref(null));

  return {
    gridElement,
    forceLayout: async () => {
      await gridElement.value?.forceLayout();
    },
    getConfig: () => {
      return gridElement.value?.getConfig();
    },
    ready: async () => {
      await gridElement.value?.ready();
    },
    getPlugin: <T>(pluginClass: new (...args: unknown[]) => T) => {
      return gridElement.value?.getPlugin(pluginClass);
    },
  };
}
