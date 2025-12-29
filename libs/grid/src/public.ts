// Public API surface - only export what consumers need
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
  ExternalMountEditorDetail,
  ExternalMountViewDetail,
  FitMode,
  GridColumnState,
  // Core configuration types
  GridConfig,
  // Icons
  GridIcons,
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
  ToolPanelConfig,
  ToolPanelDefinition,
  ToolbarButtonConfig,
} from './lib/core/types';

// Re-export FitModeEnum for runtime usage
export { DEFAULT_GRID_ICONS, FitModeEnum } from './lib/core/types';

// ================= Plugin Types =================
// Only export types that consumers need to use plugins

// Selection plugin
export { SelectionPlugin } from './lib/plugins/selection/SelectionPlugin';
export type { CellRange, SelectionChangeDetail, SelectionConfig, SelectionMode } from './lib/plugins/selection/types';

// Tree plugin
export { TreePlugin } from './lib/plugins/tree/TreePlugin';
export type { TreeConfig, TreeExpandDetail } from './lib/plugins/tree/types';

// Filtering plugin
export type { FilterConfig, FilterModel, FilterOperator, FilterType } from './lib/plugins/filtering/types';

// Multi-sort plugin
export type { MultiSortConfig, SortModel } from './lib/plugins/multi-sort/types';

// Export plugin
export type { ExportFormat, ExportParams } from './lib/plugins/export/types';

// Pinned rows plugin
export type { PinnedRowsContext, PinnedRowsPanel } from './lib/plugins/pinned-rows/types';

// Pivot plugin
export type { PivotConfig, PivotResult, PivotValueField } from './lib/plugins/pivot/types';

// Server-side plugin
export type { GetRowsParams, GetRowsResult, ServerSideDataSource } from './lib/plugins/server-side/types';

// Undo/Redo plugin
export type { EditAction } from './lib/plugins/undo-redo/types';

// Grouping rows plugin
export type { GroupingRowsConfig } from './lib/plugins/grouping-rows/types';

// Plugin base class - for creating custom plugins
export { BaseGridPlugin } from './lib/core/plugin';

// DOM constants - for querying grid elements and styling
export { GridCSSVars, GridClasses, GridDataAttrs, GridSelectors } from './lib/core/constants';
export type { GridCSSVar, GridClassName, GridDataAttr } from './lib/core/constants';
