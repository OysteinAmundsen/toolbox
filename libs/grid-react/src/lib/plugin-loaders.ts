/**
 * Plugin loader definitions for lazy-loading grid plugins based on React props.
 *
 * This module provides the mapping between declarative feature props and their
 * corresponding plugin dynamic imports. Plugins are only loaded when the
 * corresponding prop is used.
 *
 * @internal
 */

import type { BaseGridPlugin } from '@toolbox-web/grid';

/**
 * Plugin loader function - dynamically imports and instantiates a plugin
 */
export type PluginLoader<TConfig> = (config: TConfig) => Promise<BaseGridPlugin>;

/**
 * Plugin definition with loader and dependency information
 */
export interface PluginDefinition {
  /** Unique plugin name (matches plugin.name) */
  name: string;
  /** Dynamic loader function */
  loader: PluginLoader<unknown>;
  /** Plugin names this plugin depends on (must be loaded first) */
  dependencies?: string[];
}

/**
 * Plugin dependency map - which plugins require other plugins
 * Key is the dependent plugin, value is array of required plugins
 */
export const PLUGIN_DEPENDENCIES: Record<string, string[]> = {
  // UndoRedoPlugin requires EditingPlugin to track edit history
  undoRedo: ['editing'],
  // ClipboardPlugin requires SelectionPlugin to know what cells to copy
  clipboard: ['selection'],
} as const;

/**
 * Maps feature prop names to their plugin loader definitions.
 * Each loader dynamically imports the plugin and instantiates it with the given config.
 *
 * Note: We import from '@toolbox-web/grid/all' for monorepo compatibility.
 * The bundler will tree-shake unused plugins when building for production.
 */
export const PLUGIN_LOADERS = {
  /**
   * Selection plugin - enables cell/row/range selection
   * @prop selection - 'cell' | 'row' | 'range' | SelectionConfig
   */
  selection: {
    name: 'selection',
    loader: async (config: 'cell' | 'row' | 'range' | object) => {
      const { SelectionPlugin } = await import('@toolbox-web/grid/all');
      const pluginConfig = typeof config === 'string' ? { mode: config } : config;
      return new SelectionPlugin(pluginConfig);
    },
    dependencies: [],
  },

  /**
   * Editing plugin - enables inline cell editing
   * @prop editing - boolean | 'click' | 'dblclick' | 'manual' | EditingConfig
   */
  editing: {
    name: 'editing',
    loader: async (config: boolean | 'click' | 'dblclick' | 'manual' | object) => {
      const { EditingPlugin } = await import('@toolbox-web/grid/all');
      if (typeof config === 'boolean') {
        return new EditingPlugin();
      }
      if (typeof config === 'string') {
        return new EditingPlugin({ editOn: config });
      }
      return new EditingPlugin(config);
    },
    dependencies: [],
  },

  /**
   * Filtering plugin - enables column filtering
   * @prop filtering - boolean | FilterConfig
   */
  filtering: {
    name: 'filtering',
    loader: async (config: true | object) => {
      const { FilteringPlugin } = await import('@toolbox-web/grid/all');
      return new FilteringPlugin(config === true ? undefined : config);
    },
    dependencies: [],
  },

  /**
   * Multi-sort plugin - enables single or multi-column sorting
   * @prop sorting - boolean | 'single' | 'multi' | MultiSortConfig
   */
  sorting: {
    name: 'multiSort',
    loader: async (config: true | 'single' | 'multi' | object) => {
      const { MultiSortPlugin } = await import('@toolbox-web/grid/all');
      if (config === true) {
        return new MultiSortPlugin();
      }
      if (typeof config === 'string') {
        return new MultiSortPlugin({ maxSortColumns: config === 'single' ? 1 : undefined });
      }
      return new MultiSortPlugin(config);
    },
    dependencies: [],
  },

  /**
   * Clipboard plugin - enables copy/paste functionality
   * @prop clipboard - boolean | ClipboardConfig
   */
  clipboard: {
    name: 'clipboard',
    loader: async (config: true | object) => {
      const { ClipboardPlugin } = await import('@toolbox-web/grid/all');
      return new ClipboardPlugin(config === true ? undefined : config);
    },
    dependencies: ['selection'], // Requires selection to know what to copy
  },

  /**
   * Context menu plugin - enables right-click context menus
   * @prop contextMenu - boolean | ContextMenuConfig
   */
  contextMenu: {
    name: 'contextMenu',
    loader: async (config: true | object) => {
      const { ContextMenuPlugin } = await import('@toolbox-web/grid/all');
      return new ContextMenuPlugin(config === true ? undefined : config);
    },
    dependencies: [],
  },

  /**
   * Reorder plugin - enables column drag-to-reorder
   * @prop reorder - boolean | ReorderConfig
   */
  reorder: {
    name: 'reorder',
    loader: async (config: true | object) => {
      const { ReorderPlugin } = await import('@toolbox-web/grid/all');
      return new ReorderPlugin(config === true ? undefined : config);
    },
    dependencies: [],
  },

  /**
   * Row reorder plugin - enables row drag-to-reorder
   * @prop rowReorder - boolean | RowReorderConfig
   */
  rowReorder: {
    name: 'rowReorder',
    loader: async (config: true | object) => {
      const { RowReorderPlugin } = await import('@toolbox-web/grid/all');
      return new RowReorderPlugin(config === true ? undefined : config);
    },
    dependencies: [],
  },

  /**
   * Visibility plugin - enables column visibility panel
   * @prop visibility - boolean | VisibilityConfig
   */
  visibility: {
    name: 'visibility',
    loader: async (config: true | object) => {
      const { VisibilityPlugin } = await import('@toolbox-web/grid/all');
      return new VisibilityPlugin(config === true ? undefined : config);
    },
    dependencies: [],
  },

  /**
   * Undo/Redo plugin - enables undo/redo for edits
   * @prop undoRedo - boolean | UndoRedoConfig
   */
  undoRedo: {
    name: 'undoRedo',
    loader: async (config: true | object) => {
      const { UndoRedoPlugin } = await import('@toolbox-web/grid/all');
      return new UndoRedoPlugin(config === true ? undefined : config);
    },
    dependencies: ['editing'], // Requires editing to track history
  },

  /**
   * Tree plugin - enables hierarchical tree view
   * @prop tree - boolean | TreeConfig
   */
  tree: {
    name: 'tree',
    loader: async (config: true | object) => {
      const { TreePlugin } = await import('@toolbox-web/grid/all');
      return new TreePlugin(config === true ? undefined : config);
    },
    dependencies: [],
  },

  /**
   * Grouping rows plugin - enables row grouping by field values
   * @prop groupingRows - GroupingRowsConfig
   */
  groupingRows: {
    name: 'groupingRows',
    loader: async (config: object) => {
      const { GroupingRowsPlugin } = await import('@toolbox-web/grid/all');
      return new GroupingRowsPlugin(config);
    },
    dependencies: [],
  },

  /**
   * Grouping columns plugin - enables multi-level column headers
   * @prop groupingColumns - boolean | GroupingColumnsConfig
   */
  groupingColumns: {
    name: 'groupingColumns',
    loader: async (config: true | object) => {
      const { GroupingColumnsPlugin } = await import('@toolbox-web/grid/all');
      return new GroupingColumnsPlugin(config === true ? undefined : config);
    },
    dependencies: [],
  },

  /**
   * Pinned columns plugin - enables sticky columns
   * @prop pinnedColumns - boolean | PinnedColumnsConfig
   */
  pinnedColumns: {
    name: 'pinnedColumns',
    loader: async (config: true | object) => {
      const { PinnedColumnsPlugin } = await import('@toolbox-web/grid/all');
      return new PinnedColumnsPlugin(config === true ? undefined : config);
    },
    dependencies: [],
  },

  /**
   * Pinned rows plugin - enables aggregation/status bar rows
   * @prop pinnedRows - boolean | PinnedRowsConfig
   */
  pinnedRows: {
    name: 'pinnedRows',
    loader: async (config: true | object) => {
      const { PinnedRowsPlugin } = await import('@toolbox-web/grid/all');
      return new PinnedRowsPlugin(config === true ? undefined : config);
    },
    dependencies: [],
  },

  /**
   * Master-detail plugin - enables expandable row details
   * @prop masterDetail - MasterDetailConfig
   */
  masterDetail: {
    name: 'masterDetail',
    loader: async (config: object) => {
      const { MasterDetailPlugin } = await import('@toolbox-web/grid/all');
      return new MasterDetailPlugin(config);
    },
    dependencies: [],
  },

  /**
   * Responsive plugin - enables responsive card layout
   * @prop responsive - boolean | ResponsivePluginConfig
   */
  responsive: {
    name: 'responsive',
    loader: async (config: true | object) => {
      const { ResponsivePlugin } = await import('@toolbox-web/grid/all');
      return new ResponsivePlugin(config === true ? undefined : config);
    },
    dependencies: [],
  },

  /**
   * Column virtualization plugin - enables horizontal virtualization
   * @prop columnVirtualization - boolean | ColumnVirtualizationConfig
   */
  columnVirtualization: {
    name: 'columnVirtualization',
    loader: async (config: true | object) => {
      const { ColumnVirtualizationPlugin } = await import('@toolbox-web/grid/all');
      return new ColumnVirtualizationPlugin(config === true ? undefined : config);
    },
    dependencies: [],
  },

  /**
   * Export plugin - enables CSV/JSON export
   * @prop export - boolean | ExportConfig
   */
  export: {
    name: 'export',
    loader: async (config: true | object) => {
      const { ExportPlugin } = await import('@toolbox-web/grid/all');
      return new ExportPlugin(config === true ? undefined : config);
    },
    dependencies: [],
  },

  /**
   * Print plugin - enables print functionality
   * @prop print - boolean | PrintConfig
   */
  print: {
    name: 'print',
    loader: async (config: true | object) => {
      const { PrintPlugin } = await import('@toolbox-web/grid/all');
      return new PrintPlugin(config === true ? undefined : config);
    },
    dependencies: [],
  },

  /**
   * Pivot plugin - enables pivot table functionality
   * @prop pivot - PivotConfig
   */
  pivot: {
    name: 'pivot',
    loader: async (config: object) => {
      const { PivotPlugin } = await import('@toolbox-web/grid/all');
      return new PivotPlugin(config);
    },
    dependencies: [],
  },

  /**
   * Server-side plugin - enables server-side data operations
   * @prop serverSide - ServerSideConfig
   */
  serverSide: {
    name: 'serverSide',
    loader: async (config: object) => {
      const { ServerSidePlugin } = await import('@toolbox-web/grid/all');
      return new ServerSidePlugin(config);
    },
    dependencies: [],
  },
} as const;

/**
 * Type for feature prop names
 */
export type FeaturePropName = keyof typeof PLUGIN_LOADERS;

/**
 * Get the set of all feature prop names
 */
export function getFeaturePropNames(): Set<FeaturePropName> {
  return new Set(Object.keys(PLUGIN_LOADERS) as FeaturePropName[]);
}
