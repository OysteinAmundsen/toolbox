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

// All plugins - each plugin's index.ts exports its class and types
export * from './lib/plugins/clipboard';
export * from './lib/plugins/column-virtualization';
export * from './lib/plugins/context-menu';
export * from './lib/plugins/export';
export * from './lib/plugins/filtering';
export * from './lib/plugins/grouping-columns';
export * from './lib/plugins/grouping-rows';
export * from './lib/plugins/master-detail';
export * from './lib/plugins/multi-sort';
export * from './lib/plugins/pinned-columns';
export * from './lib/plugins/pinned-rows';
export * from './lib/plugins/pivot';
export * from './lib/plugins/reorder';
export * from './lib/plugins/selection';
export * from './lib/plugins/server-side';
export * from './lib/plugins/tree';
export * from './lib/plugins/undo-redo';
export * from './lib/plugins/visibility';
