/**
 * All-in-One Bundle Entry Point
 *
 * This file imports and re-exports the core grid plus all plugins.
 * Use this for a single bundle that includes everything.
 *
 * For tree-shaking, import plugins individually from their paths:
 *   import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
 */

// Core grid - import directly from source to avoid shared chunks with index.ts
// Auto-register the custom element
import './lib/core/grid';

// Re-export public API
export * from './public';

// Core grid component
export { DataGridElement } from './lib/core/grid';

// Plugin system
export { BaseGridPlugin, PluginManager } from './lib/core/plugin';
export type { CellClickEvent } from './lib/core/plugin/base-plugin';
export type { GridPlugin } from './lib/core/types';

// All plugins
export { ClipboardPlugin } from './lib/plugins/clipboard';
export { ColumnVirtualizationPlugin } from './lib/plugins/column-virtualization';
export { ContextMenuPlugin } from './lib/plugins/context-menu';
export { ExportPlugin } from './lib/plugins/export';
export { FilteringPlugin } from './lib/plugins/filtering';
export { GroupingColumnsPlugin } from './lib/plugins/grouping-columns';
export { GroupingRowsPlugin } from './lib/plugins/grouping-rows';
export { MasterDetailPlugin } from './lib/plugins/master-detail';
export type { MasterDetailConfig } from './lib/plugins/master-detail';
export { MultiSortPlugin } from './lib/plugins/multi-sort';
export { PinnedColumnsPlugin } from './lib/plugins/pinned-columns';
export { PinnedRowsPlugin } from './lib/plugins/pinned-rows';
export { PivotPlugin } from './lib/plugins/pivot';
export { ReorderPlugin } from './lib/plugins/reorder';
export { SelectionPlugin } from './lib/plugins/selection';
export { ServerSidePlugin } from './lib/plugins/server-side';
export { TreePlugin } from './lib/plugins/tree';
export { UndoRedoPlugin } from './lib/plugins/undo-redo';
export { VisibilityPlugin } from './lib/plugins/visibility';
