/**
 * @toolbox-web/grid - A high-performance, framework-agnostic data grid web component.
 *
 * This is the public API surface. Only symbols exported here are considered stable.
 *
 * @packageDocumentation
 * @module Core
 */

// #region Public API surface - only export what consumers need
export { DataGridElement, DataGridElement as GridElement } from './lib/core/grid';

/**
 * Clean type alias for the grid element.
 * Use this in place of `DataGridElement<T>` for more concise code.
 *
 * @example
 * ```typescript
 * import { TbwGrid, createGrid } from '@toolbox-web/grid';
 *
 * const grid: TbwGrid<Employee> = createGrid();
 * grid.rows = employees;
 * ```
 */
export type { DataGridElement as TbwGrid } from './lib/core/grid';

// Import needed for factory functions (value import: tagName is accessed at runtime)
import { DataGridElement } from './lib/core/grid';
import type { GridConfig } from './lib/core/types';

// #region Factory Functions
/**
 * Create a new typed grid element programmatically.
 *
 * This avoids the need to cast when creating grids in TypeScript:
 * ```typescript
 * // Before: manual cast required
 * const grid = document.createElement('tbw-grid') as DataGridElement<Employee>;
 *
 * // After: fully typed
 * const grid = createGrid<Employee>({
 *   columns: [{ field: 'name' }],
 *   plugins: [new SelectionPlugin()],
 * });
 * grid.rows = employees; // ✓ Typed!
 * ```
 *
 * @param config - Optional initial grid configuration
 * @returns A typed DataGridElement instance
 */
export function createGrid<TRow = unknown>(config?: Partial<GridConfig<TRow>>): DataGridElement<TRow> {
  const grid = document.createElement('tbw-grid') as DataGridElement<TRow>;
  if (config) {
    grid.gridConfig = config as GridConfig<TRow>;
  }
  return grid;
}

/**
 * Query an existing grid element from the DOM with proper typing.
 *
 * **Sync mode** (default) — returns the element immediately. The element may not
 * be upgraded yet if the grid module hasn't loaded.
 *
 * **Async mode** — pass `true` as the second or third argument to wait for the
 * custom element to be defined and upgraded before resolving. This guarantees
 * all `DataGridElement` methods (e.g. `registerStyles`, `ready`, `on`) are
 * available on the returned instance.
 *
 * @example
 * ```typescript
 * // Sync — unchanged from before
 * const grid = queryGrid<Employee>('#my-grid');
 * if (grid) {
 *   grid.rows = employees; // ✓ Typed (assumes element is upgraded)
 * }
 *
 * // Async — waits for custom-element upgrade
 * const grid = await queryGrid<Employee>('#my-grid', true);
 * if (grid) {
 *   grid.registerStyles('my-id', '.cell { color: red; }'); // ✓ Safe
 * }
 *
 * // Async with parent scope
 * const grid = await queryGrid<Employee>('tbw-grid', container, true);
 * ```
 *
 * @param selector - CSS selector to find the grid element
 * @returns The typed grid element (or null), either synchronously or as a Promise
 */
export function queryGrid<TRow = unknown>(selector: string): DataGridElement<TRow> | null;
export function queryGrid<TRow = unknown>(selector: string, parent: ParentNode): DataGridElement<TRow> | null;
export function queryGrid<TRow = unknown>(selector: string, awaitUpgrade: true): Promise<DataGridElement<TRow> | null>;
export function queryGrid<TRow = unknown>(
  selector: string,
  parent: ParentNode,
  awaitUpgrade: true,
): Promise<DataGridElement<TRow> | null>;
export function queryGrid<TRow = unknown>(
  selector: string,
  parentOrAwait?: ParentNode | boolean,
  awaitUpgrade?: boolean,
): DataGridElement<TRow> | null | Promise<DataGridElement<TRow> | null> {
  let parent: ParentNode = document;
  let shouldAwait = false;

  if (typeof parentOrAwait === 'boolean') {
    shouldAwait = parentOrAwait;
  } else if (parentOrAwait) {
    parent = parentOrAwait;
    shouldAwait = !!awaitUpgrade;
  }

  if (shouldAwait) {
    return customElements.whenDefined(DataGridElement.tagName).then(() => {
      return parent.querySelector(selector) as DataGridElement<TRow> | null;
    });
  }

  return parent.querySelector(selector) as DataGridElement<TRow> | null;
}
// #endregion

/**
 * Event name constants for DataGrid (public API).
 *
 * Use these constants instead of string literals for type-safe event handling.
 *
 * @example
 * ```typescript
 * import { DGEvents } from '@toolbox-web/grid';
 *
 * // Type-safe event listening
 * grid.addEventListener(DGEvents.CELL_CLICK, (e) => {
 *   console.log('Cell clicked:', e.detail);
 * });
 *
 * grid.addEventListener(DGEvents.SORT_CHANGE, (e) => {
 *   const { field, direction } = e.detail;
 *   console.log(`Sorted by ${field}`);
 * });
 *
 * grid.addEventListener(DGEvents.CELL_COMMIT, (e) => {
 *   // Save edited value
 *   saveToServer(e.detail.row);
 * });
 * ```
 *
 * @see {@link PluginEvents} for plugin-specific events
 * @see {@link DataGridEventMap} for event detail types
 * @category Events
 */
export const DGEvents = {
  /** Emitted by core after any data mutation */
  CELL_CHANGE: 'cell-change',
  CELL_COMMIT: 'cell-commit',
  ROW_COMMIT: 'row-commit',
  EDIT_OPEN: 'edit-open',
  EDIT_CLOSE: 'edit-close',
  CHANGED_ROWS_RESET: 'changed-rows-reset',
  MOUNT_EXTERNAL_VIEW: 'mount-external-view',
  MOUNT_EXTERNAL_EDITOR: 'mount-external-editor',
  SORT_CHANGE: 'sort-change',
  COLUMN_RESIZE: 'column-resize',
  /** Unified cell activation event (keyboard or pointer) */
  CELL_ACTIVATE: 'cell-activate',
  GROUP_TOGGLE: 'group-toggle',
  COLUMN_STATE_CHANGE: 'column-state-change',
  /** Emitted when grid row data changes (set, insert, remove, update) */
  DATA_CHANGE: 'data-change',
} as const;

/**
 * Union type of all DataGrid event names.
 *
 * @example
 * ```typescript
 * function addListener(grid: DataGridElement, event: DGEventName): void {
 *   grid.addEventListener(event, (e) => console.log(e));
 * }
 * ```
 *
 * @see {@link DGEvents} for event constants
 * @category Events
 */
export type DGEventName = (typeof DGEvents)[keyof typeof DGEvents];

/**
 * Plugin event constants (mirrors DGEvents pattern).
 *
 * Events emitted by built-in plugins. Import the relevant plugin
 * to access these events.
 *
 * @example
 * ```typescript
 * import { PluginEvents } from '@toolbox-web/grid';
 * import { SelectionPlugin } from '@toolbox-web/grid/all';
 *
 * // Listen for selection changes
 * grid.addEventListener(PluginEvents.SELECTION_CHANGE, (e) => {
 *   console.log('Selected rows:', e.detail.selectedRows);
 * });
 *
 * // Listen for filter changes
 * grid.addEventListener(PluginEvents.FILTER_CHANGE, (e) => {
 *   console.log('Active filters:', e.detail);
 * });
 *
 * // Listen for tree expand/collapse
 * grid.addEventListener(PluginEvents.TREE_EXPAND, (e) => {
 *   const { row, expanded } = e.detail;
 *   console.log(`Row ${expanded ? 'expanded' : 'collapsed'}`);
 * });
 * ```
 *
 * @see {@link DGEvents} for core grid events
 * @category Events
 */
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

/**
 * Union type of all plugin event names.
 *
 * @example
 * ```typescript
 * function addPluginListener(grid: DataGridElement, event: PluginEventName): void {
 *   grid.addEventListener(event, (e) => console.log(e));
 * }
 * ```
 *
 * @see {@link PluginEvents} for event constants
 * @category Events
 */
export type PluginEventName = (typeof PluginEvents)[keyof typeof PluginEvents];

// Public type exports
export type {
  // Accessibility types
  A11yConfig,
  A11yMessages,
  AggregatorRef,
  // Animation types
  AnimationConfig,
  AnimationMode,
  AnimationStyle,
  BaseColumnConfig,
  // Event detail types
  CellActivateDetail,
  CellActivateTrigger,
  CellChangeDetail,
  CellClickDetail,
  CellRenderContext,
  ColumnConfig,
  ColumnConfigMap,
  ColumnEditorContext,
  // Column features
  ColumnEditorSpec,
  ColumnResizeDetail,
  // Column state types
  ColumnSortState,
  ColumnState,
  // Type-level defaults
  ColumnType,
  ColumnViewRenderer,
  DataChangeDetail,
  DataGridCustomEvent,
  DataGridElement as DataGridElementInterface,
  DataGridEventMap,
  ExpandCollapseAnimation,
  ExternalMountEditorDetail,
  ExternalMountViewDetail,
  // Feature configuration (augmentable by feature modules)
  FeatureConfig,
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
  // Header renderer types
  HeaderCellContext,
  // Shell types
  HeaderContentDefinition,
  HeaderLabelContext,
  HeaderLabelRenderer,
  HeaderRenderer,
  IconValue,
  // Inference types
  InferredColumnResult,
  // Loading types
  LoadingContext,
  LoadingRenderer,
  LoadingSize,
  PrimitiveColumnType,
  // Public interface
  PublicGrid,
  // Row animation type
  RowAnimationType,
  RowClickDetail,
  // Grouping & Footer types
  RowGroupRenderConfig,
  // Data update management
  RowTransaction,
  RowUpdate,
  // Focus & Navigation
  ScrollToRowOptions,
  ShellConfig,
  ShellHeaderConfig,
  SortChangeDetail,
  // Sorting types
  SortHandler,
  SortState,
  ToolbarContentDefinition,
  ToolPanelConfig,
  ToolPanelDefinition,
  TransactionResult,
  TypeDefault,
  UpdateSource,
} from './lib/core/types';

// Re-export FitModeEnum for runtime usage
export { DEFAULT_A11Y_MESSAGES, DEFAULT_ANIMATION_CONFIG, DEFAULT_GRID_ICONS, FitModeEnum } from './lib/core/types';

// Re-export sorting utilities for custom sort handlers
export { builtInSort, defaultComparator } from './lib/core/internal/sorting';
// #endregion

// #region Plugin Development
// Plugin base class - for creating custom plugins
export { BaseGridPlugin } from './lib/core/plugin';
export type {
  AfterCellRenderContext,
  AfterRowRenderContext,
  CellMouseEvent,
  EventDefinition,
  PluginDependency,
  PluginManifest,
  PluginQuery,
  QueryDefinition,
} from './lib/core/plugin';

// DOM constants - for querying grid elements and styling
export { GridClasses, GridCSSVars, GridDataAttrs, GridSelectors } from './lib/core/constants';
export type { GridClassName, GridCSSVar, GridDataAttr } from './lib/core/constants';

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
 * @category Plugin Development
 * @internal
 */
export type { ColumnInternal } from './lib/core/types';

/**
 * Compiled template function with __blocked property for error handling.
 * @category Plugin Development
 * @internal
 */
export type { CompiledViewFunction } from './lib/core/types';

/**
 * Full internal grid interface extending PublicGrid with internal state.
 * Provides typed access to _columns, _rows, virtualization state, etc.
 * @category Plugin Development
 * @internal
 */
export type { InternalGrid } from './lib/core/types';

/**
 * Cell context for renderer/editor operations.
 * @category Plugin Development
 * @internal
 */
export type { CellContext } from './lib/core/types';

/**
 * Editor execution context extending CellContext with commit/cancel functions.
 * @category Plugin Development
 * @internal
 */
export type { EditorExecContext } from './lib/core/types';

/**
 * Template evaluation context for dynamic templates.
 * @category Plugin Development
 * @internal
 */
export type { EvalContext } from './lib/core/types';

/**
 * Column resize controller interface.
 * @category Plugin Development
 * @internal
 */
export type { ResizeController } from './lib/core/types';

/**
 * Row virtualization state interface.
 * @category Plugin Development
 * @internal
 */
export type { VirtualState } from './lib/core/types';

/**
 * Row element with internal editing state cache.
 * Used for tracking editing cell count without querySelector.
 * @category Plugin Development
 * @internal
 */
export type { RowElementInternal } from './lib/core/types';

/**
 * Union type for input-like elements that have a `value` property.
 * Covers standard form elements and custom elements with value semantics.
 * @category Plugin Development
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
 * @category Plugin Development
 * @internal
 */
export type AsInternalGrid<T = unknown> = import('./lib/core/types').InternalGrid<T>;

/**
 * Render phase enum for debugging and understanding the render pipeline.
 * Higher phases include all lower phase work.
 * @category Plugin Development
 */
export { RenderPhase } from './lib/core/internal/render-scheduler';

/**
 * Hook used by `@toolbox-web/grid/features/registry` to wire the feature resolver
 * into the grid core without adding registry code to the main bundle.
 * Not for external use — call only from built feature-registry entry point.
 * @internal
 */
export { setFeatureResolver } from './lib/core/internal/feature-hook';
// #endregion
