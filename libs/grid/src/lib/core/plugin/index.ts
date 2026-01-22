/**
 * tbw-grid Plugin System
 *
 * Public API for the plugin infrastructure.
 * All plugins extend BaseGridPlugin and are attached to grids via PluginManager.
 */

// #region Base Plugin Class
export { BaseGridPlugin, PLUGIN_QUERIES } from './base-plugin';
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
  PluginQuery,
  RowClickEvent,
  ScrollEvent,
} from './base-plugin';
// #endregion

// #region Plugin Manager
export { PluginManager } from './plugin-manager';
// #endregion

// #region Plugin Dependencies
export type {
  HookName,
  PluginConfigRule,
  PluginDependency,
  PluginManifest,
  PluginPropertyDefinition,
} from './base-plugin';
// #endregion

// Re-export ColumnConfig for plugins that need it
export type { ColumnConfig } from '../types';
