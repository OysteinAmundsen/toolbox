/**
 * @packageDocumentation
 * @toolbox-web/grid - A high-performance, framework-agnostic data grid web component.
 *
 * This is the public API surface. Only symbols exported here are considered stable.
 */

// #region Public API surface - only export what consumers need
export { DataGridElement, DataGridElement as GridElement } from './lib/core/grid';

// Event name constants for DataGrid (public API)
export const DGEvents = {
  CELL_COMMIT: 'cell-commit',
  ROW_COMMIT: 'row-commit',
  CHANGED_ROWS_RESET: 'changed-rows-reset',
  MOUNT_EXTERNAL_VIEW: 'mount-external-view',
  MOUNT_EXTERNAL_EDITOR: 'mount-external-editor',
  SORT_CHANGE: 'sort-change',
  COLUMN_RESIZE: 'column-resize',
  ACTIVATE_CELL: 'activate-cell',
  GROUP_TOGGLE: 'group-toggle',
  COLUMN_STATE_CHANGE: 'column-state-change',
} as const;

export type DGEventName = (typeof DGEvents)[keyof typeof DGEvents];

// Plugin event constants (mirrors DGEvents pattern)
export const PluginEvents = {
  // Selection plugin
  SELECTION_CHANGE: 'selection-change',
  // Tree plugin
  TREE_EXPAND: 'tree-expand',
  // Filtering plugin
  FILTER_CHANGE: 'filter-change',
  // Sorting plugin
  SORT_MODEL_CHANGE: 'sort-model-change',
  // Export plugin
  EXPORT_START: 'export-start',
  EXPORT_COMPLETE: 'export-complete',
  // Clipboard plugin
  CLIPBOARD_COPY: 'clipboard-copy',
  CLIPBOARD_PASTE: 'clipboard-paste',
  // Context menu plugin
  CONTEXT_MENU_OPEN: 'context-menu-open',
  CONTEXT_MENU_CLOSE: 'context-menu-close',
  // Undo/Redo plugin
  HISTORY_CHANGE: 'history-change',
  // Server-side plugin
  SERVER_LOADING: 'server-loading',
  SERVER_ERROR: 'server-error',
  // Visibility plugin
  COLUMN_VISIBILITY_CHANGE: 'column-visibility-change',
  // Reorder plugin
  COLUMN_REORDER: 'column-reorder',
  // Master-detail plugin
  DETAIL_EXPAND: 'detail-expand',
  // Grouping rows plugin
  GROUP_EXPAND: 'group-expand',
} as const;

export type PluginEventName = (typeof PluginEvents)[keyof typeof PluginEvents];

// Public type exports
export type {
  ActivateCellDetail,
  AggregatorRef,
  // Animation types
  AnimationConfig,
  AnimationMode,
  AnimationStyle,
  BaseColumnConfig,
  // Event detail types
  CellCommitDetail,
  CellRenderContext,
  ChangedRowsResetDetail,
  ColumnConfig,
  ColumnConfigMap,
  ColumnEditorContext,
  // Column features
  ColumnEditorSpec,
  ColumnResizeDetail,
  // Column state types
  ColumnSortState,
  ColumnState,
  ColumnViewRenderer,
  DataGridCustomEvent,
  DataGridElement as DataGridElementInterface,
  DataGridEventMap,
  ExpandCollapseAnimation,
  ExternalMountEditorDetail,
  ExternalMountViewDetail,
  FitMode,
  // Framework adapter interface
  FrameworkAdapter,
  GridColumnState,
  // Core configuration types
  GridConfig,
  // Icons
  GridIcons,
  // Plugin interface (minimal shape for type-checking)
  GridPlugin,
  // Shell types
  HeaderContentDefinition,
  IconValue,
  // Inference types
  InferredColumnResult,
  PrimitiveColumnType,
  // Public interface
  PublicGrid,
  RowCommitDetail,
  // Grouping & Footer types
  RowGroupRenderConfig,
  ShellConfig,
  ShellHeaderConfig,
  SortChangeDetail,
  // Sorting types
  SortHandler,
  SortState,
  ToolPanelConfig,
  ToolPanelDefinition,
  ToolbarButtonConfig,
} from './lib/core/types';

// Re-export FitModeEnum for runtime usage
export { DEFAULT_ANIMATION_CONFIG, DEFAULT_GRID_ICONS, FitModeEnum } from './lib/core/types';

// Re-export sorting utilities for custom sort handlers
export { builtInSort, defaultComparator } from './lib/core/internal/sorting';
// #endregion

// #region Plugin Development
// Plugin base class - for creating custom plugins
export { BaseGridPlugin, PLUGIN_QUERIES } from './lib/core/plugin';
export type { PluginQuery } from './lib/core/plugin';

// DOM constants - for querying grid elements and styling
export { GridCSSVars, GridClasses, GridDataAttrs, GridSelectors } from './lib/core/constants';
export type { GridCSSVar, GridClassName, GridDataAttr } from './lib/core/constants';

// Note: Plugin-specific types (SelectionConfig, FilterConfig, etc.) are exported
// from their respective plugin entry points:
//   import { SelectionPlugin, type SelectionConfig } from '@toolbox-web/grid/plugins/selection';
//   import { FilteringPlugin, type FilterConfig } from '@toolbox-web/grid/plugins/filtering';
// Or import all plugins + types from: '@toolbox-web/grid/all'
// #endregion

// #region Advanced Types for Custom Plugins & Enterprise Extensions
/**
 * Internal types for advanced users building custom plugins or enterprise extensions.
 *
 * These types provide access to grid internals that may be needed for deep customization.
 * While not part of the "stable" API, they are exported for power users who need them.
 *
 * @remarks
 * Use with caution - these types expose internal implementation details.
 * The underscore-prefixed members they reference are considered less stable
 * than the public API surface.
 *
 * @example
 * ```typescript
 * import { BaseGridPlugin } from '@toolbox-web/grid';
 * import type { InternalGrid, ColumnInternal } from '@toolbox-web/grid';
 *
 * export class MyPlugin extends BaseGridPlugin<MyConfig> {
 *   afterRender(): void {
 *     // Access grid internals with proper typing
 *     const grid = this.grid as InternalGrid;
 *     const columns = grid._columns as ColumnInternal[];
 *     // ...
 *   }
 * }
 * ```
 */

/**
 * Column configuration with internal cache properties.
 * Extends the public ColumnConfig with compiled template caches (__compiledView, __viewTemplate, etc.)
 * @internal
 */
export type { ColumnInternal } from './lib/core/types';

/**
 * Compiled template function with __blocked property for error handling.
 * @internal
 */
export type { CompiledViewFunction } from './lib/core/types';

/**
 * Full internal grid interface extending PublicGrid with internal state.
 * Provides typed access to _columns, _rows, virtualization state, etc.
 * @internal
 */
export type { InternalGrid } from './lib/core/types';

/**
 * Cell context for renderer/editor operations.
 * @internal
 */
export type { CellContext } from './lib/core/types';

/**
 * Editor execution context extending CellContext with commit/cancel functions.
 * @internal
 */
export type { EditorExecContext } from './lib/core/types';

/**
 * Template evaluation context for dynamic templates.
 * @internal
 */
export type { EvalContext } from './lib/core/types';

/**
 * Column resize controller interface.
 * @internal
 */
export type { ResizeController } from './lib/core/types';

/**
 * Row virtualization state interface.
 * @internal
 */
export type { VirtualState } from './lib/core/types';

/**
 * Row element with internal editing state cache.
 * Used for tracking editing cell count without querySelector.
 * @internal
 */
export type { RowElementInternal } from './lib/core/types';

/**
 * Union type for input-like elements that have a `value` property.
 * Covers standard form elements and custom elements with value semantics.
 * @internal
 */
export type { InputLikeElement } from './lib/core/types';

/**
 * Utility type to safely cast a grid element to InternalGrid for plugin use.
 *
 * @example
 * ```typescript
 * import type { AsInternalGrid, InternalGrid } from '@toolbox-web/grid';
 *
 * class MyPlugin extends BaseGridPlugin {
 *   get internalGrid(): InternalGrid {
 *     return this.grid as AsInternalGrid;
 *   }
 * }
 * ```
 * @internal
 */
export type AsInternalGrid<T = unknown> = import('./lib/core/types').InternalGrid<T>;

/**
 * Render phase enum for debugging and understanding the render pipeline.
 * Higher phases include all lower phase work.
 */
export { RenderPhase } from './lib/core/internal/render-scheduler';

/**
 * Debug log entry from the render scheduler.
 * @see DataGridElement.getDebugInfo()
 */
export type { RenderLogEntry } from './lib/core/internal/render-scheduler';
// #endregion
