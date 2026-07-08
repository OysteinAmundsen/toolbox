/**
 * All-in-One Bundle Entry Point
 *
 * This file imports and re-exports the core grid plus all plugins and features.
 * Use this for a single bundle that includes everything.
 *
 * For tree-shaking, import plugins individually from their paths:
 *   import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
 */

// Feature registry wiring
// Side-effect imports register feature factories so gridConfig.features works
// when consumers only import '@toolbox-web/grid/all'. Keep these BEFORE
// any core/public imports so the resolver is available before <tbw-grid>
// upgrades and initializes plugins.
import './lib/features/clipboard';
import './lib/features/column-virtualization';
import './lib/features/context-menu';
import './lib/features/editing';
import './lib/features/export';
import './lib/features/filtering';
import './lib/features/grouping-columns';
import './lib/features/grouping-rows';
import './lib/features/master-detail';
import './lib/features/multi-sort';
import './lib/features/pinned-columns';
import './lib/features/pinned-rows';
import './lib/features/pivot';
import './lib/features/print';
import './lib/features/reorder-columns';
import './lib/features/responsive';
import './lib/features/row-drag-drop';
import './lib/features/selection';
import './lib/features/server-side';
import './lib/features/shell';
import './lib/features/sticky-rows';
import './lib/features/tooltip';
import './lib/features/tree';
import './lib/features/undo-redo';
import './lib/features/visibility';

// Re-export public API (loads core grid and auto-registers custom element)
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
export * from './lib/plugins/editing';
export * from './lib/plugins/export';
export * from './lib/plugins/filtering';
export * from './lib/plugins/grouping-columns';
export * from './lib/plugins/grouping-rows';
export * from './lib/plugins/master-detail';
export * from './lib/plugins/multi-sort';
export * from './lib/plugins/pinned-columns';
export * from './lib/plugins/pinned-rows';
export * from './lib/plugins/pivot';
export * from './lib/plugins/print';
export * from './lib/plugins/reorder-columns';
export * from './lib/plugins/responsive';
export * from './lib/plugins/row-drag-drop';
export * from './lib/plugins/selection';
export * from './lib/plugins/server-side';
export * from './lib/plugins/sticky-rows';
export * from './lib/plugins/tooltip';
export * from './lib/plugins/tree';
export * from './lib/plugins/undo-redo';
export * from './lib/plugins/visibility';
