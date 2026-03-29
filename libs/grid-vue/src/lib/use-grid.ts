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
  /**
   * Get a plugin by its registered name (preferred).
   * Uses the type-safe PluginNameMap for auto-completion and return type narrowing.
   */
  getPluginByName: DataGridElement['getPluginByName'];
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
 * @param selector - Optional CSS selector to target a specific grid element via
 *   DOM query instead of using Vue's provide/inject. Use when the component
 *   contains multiple grids, e.g. `'tbw-grid.primary'` or `'#my-grid'`.
 */
export function useGrid(selector?: string): UseGridReturn {
  const gridElement = selector ? (ref(null) as Ref<DataGridElement | null>) : inject(GRID_ELEMENT_KEY, ref(null));

  /**
   * Resolve the grid element. When a selector is provided, uses a DOM query;
   * otherwise falls back to the injected ref.
   */
  const getGrid = (): DataGridElement | null => {
    if (selector) {
      const el = document.querySelector(selector) as DataGridElement | null;
      if (el && !gridElement.value) gridElement.value = el;
      return el;
    }
    return gridElement.value;
  };

  return {
    gridElement,
    forceLayout: async () => {
      await getGrid()?.forceLayout();
    },
    getConfig: () => {
      return getGrid()?.getConfig();
    },
    ready: async () => {
      await getGrid()?.ready();
    },
    getPlugin: <T>(pluginClass: new (...args: unknown[]) => T) => {
      return getGrid()?.getPlugin(pluginClass);
    },
    getPluginByName: ((name: string) => {
      return getGrid()?.getPluginByName(name);
    }) as DataGridElement['getPluginByName'],
  };
}
