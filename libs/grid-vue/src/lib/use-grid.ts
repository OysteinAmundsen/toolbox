import type { ColumnConfig, DataGridElement, GridConfig } from '@toolbox-web/grid';
import { inject, onMounted, ref, type InjectionKey, type Ref } from 'vue';

/**
 * Injection key for the grid element.
 * @since 0.1.0
 */
export const GRID_ELEMENT_KEY: InjectionKey<Ref<DataGridElement | null>> = Symbol('tbw-grid');

/**
 * Return type for useGrid composable.
 * @since 0.1.0
 */
export interface UseGridReturn<TRow = unknown> {
  /** The grid element reference */
  gridElement: Ref<DataGridElement<TRow> | null>;
  /** Whether the grid is ready */
  isReady: Ref<boolean>;
  /** Current grid configuration (reactive) */
  config: Ref<GridConfig<TRow> | null>;
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
  /** Toggle a group row */
  toggleGroup: (key: string) => Promise<void>;
  /** Register custom styles via `document.adoptedStyleSheets` */
  registerStyles: (id: string, css: string) => void;
  /** Unregister previously registered custom styles */
  unregisterStyles: (id: string) => void;
  /** Get currently visible columns (excluding hidden columns) */
  getVisibleColumns: () => ColumnConfig<TRow>[];
}

/**
 * Composable for programmatic access to the grid.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useGrid } from '@toolbox-web/grid-vue';
 *
 * const { forceLayout, getConfig, isReady, getVisibleColumns } = useGrid();
 *
 * async function handleResize() {
 *   await forceLayout();
 * }
 * </script>
 * ```
 * @param selector - Optional CSS selector to target a specific grid element via
 *   DOM query instead of using Vue's provide/inject. Use when the component
 *   contains multiple grids, e.g. `'tbw-grid.primary'` or `'#my-grid'`.
 * @since 0.1.0
 */
export function useGrid<TRow = unknown>(selector?: string): UseGridReturn<TRow> {
  const gridElement = selector
    ? (ref(null) as Ref<DataGridElement<TRow> | null>)
    : (inject(GRID_ELEMENT_KEY, ref(null)) as Ref<DataGridElement<TRow> | null>);
  const isReady = ref(false) as Ref<boolean>;
  const config = ref<GridConfig<TRow> | null>(null) as Ref<GridConfig<TRow> | null>;

  /**
   * Resolve the grid element. When a selector is provided, uses a DOM query;
   * otherwise falls back to the injected ref.
   */
  const getGrid = (): DataGridElement<TRow> | null => {
    if (selector) {
      const el = document.querySelector(selector) as DataGridElement<TRow> | null;
      if (el && !gridElement.value) gridElement.value = el;
      return el;
    }
    return gridElement.value;
  };

  // Track ready state
  onMounted(async () => {
    try {
      const grid = getGrid();
      if (!grid) return;
      await grid.ready?.();
      isReady.value = true;
      const effectiveConfig = await grid.getConfig?.();
      if (effectiveConfig) {
        config.value = effectiveConfig as GridConfig<TRow>;
      }
    } catch {
      // Grid may not be available yet
    }
  });

  return {
    gridElement,
    isReady,
    config,
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
    toggleGroup: async (key: string) => {
      const grid = getGrid() as DataGridElement<TRow> & { toggleGroup?: (key: string) => Promise<void> };
      await grid?.toggleGroup?.(key);
    },
    registerStyles: (id: string, css: string) => {
      getGrid()?.registerStyles?.(id, css);
    },
    unregisterStyles: (id: string) => {
      getGrid()?.unregisterStyles?.(id);
    },
    getVisibleColumns: () => {
      const grid = getGrid();
      if (!grid) return [];
      const cfg = grid.gridConfig;
      const columns = cfg?.columns ?? [];
      return columns.filter((col: ColumnConfig<TRow>) => !col.hidden) as ColumnConfig<TRow>[];
    },
  };
}
