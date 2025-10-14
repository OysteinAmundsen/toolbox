/**
 * tbw-grid Plugin System
 *
 * Public API for the plugin infrastructure.
 * All plugins extend BaseGridPlugin and are attached to grids via PluginManager.
 */

// ===== Base Plugin Class =====
export { BaseGridPlugin } from './base-plugin';
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
} from './base-plugin';

// ===== Plugin Manager =====
export { PluginManager } from './plugin-manager';

// Re-export ColumnConfig for plugins that need it
export type { ColumnConfig } from '../types';
