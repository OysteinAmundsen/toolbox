/**
 * Grid Core Entry Point
 *
 * Exports core grid functionality and plugin system.
 * For plugins, import from @toolbox-web/grid/plugins/<name>.
 */

// Auto-register the custom element on import
import './lib/core/grid';

// Re-export public API
export * from './public';

// Core grid component
export { DataGridElement } from './lib/core/grid';

// Types
export type {
  AggregatorRef,
  CellRenderContext,
  ColumnEditorContext,
  ColumnEditorSpec,
  ColumnViewRenderer,
  RowGroupRenderConfig,
} from './lib/core/types';

// Plugin system - class-based plugins
export { BaseGridPlugin, PluginManager } from './lib/core/plugin';
export type {
  CellClickEvent,
  CellCoords,
  CellEditor,
  CellMouseEvent,
  CellRenderer,
  ContextMenuItem,
  ContextMenuParams,
  GridElement,
  HeaderClickEvent,
  HeaderRenderer,
  KeyboardModifiers,
  PluginCellRenderContext,
  PluginHeaderRenderContext,
  RowClickEvent,
  ScrollEvent,
} from './lib/core/plugin';

// Aggregator registry and functions
export {
  aggregatorRegistry,
  getAggregator,
  getValueAggregator,
  listAggregators,
  registerAggregator,
  runAggregator,
  runValueAggregator,
  unregisterAggregator,
} from './lib/core/internal/aggregators';
export type { AggregatorFn, ValueAggregatorFn } from './lib/core/internal/aggregators';
