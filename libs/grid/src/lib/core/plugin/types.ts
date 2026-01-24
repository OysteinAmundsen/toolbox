/**
 * Shared types for the plugin system.
 *
 * These types are used by both the base plugin class and the grid core.
 * Centralizing them here avoids circular imports and reduces duplication.
 */

import type { ColumnConfig, GridConfig, ToolPanelDefinition, UpdateSource } from '../types';

/**
 * Keyboard modifier flags
 */
export interface KeyboardModifiers {
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
}

/**
 * Cell coordinates
 */
export interface CellCoords {
  row: number;
  col: number;
}

/**
 * Cell click event
 */
export interface CellClickEvent {
  rowIndex: number;
  colIndex: number;
  field: string;
  value: unknown;
  row: unknown;
  cellEl: HTMLElement;
  originalEvent: MouseEvent;
}

/**
 * Row click event
 */
export interface RowClickEvent {
  rowIndex: number;
  row: unknown;
  rowEl: HTMLElement;
  originalEvent: MouseEvent;
}

/**
 * Header click event
 */
export interface HeaderClickEvent {
  colIndex: number;
  field: string;
  column: ColumnConfig;
  headerEl: HTMLElement;
  originalEvent: MouseEvent;
}

/**
 * Scroll event
 */
export interface ScrollEvent {
  scrollTop: number;
  scrollLeft: number;
  scrollHeight: number;
  scrollWidth: number;
  clientHeight: number;
  clientWidth: number;
  originalEvent?: Event;
}

/**
 * Cell mouse event (for drag operations, selection, etc.)
 */
export interface CellMouseEvent {
  /** Event type: mousedown, mousemove, or mouseup */
  type: 'mousedown' | 'mousemove' | 'mouseup';
  /** Row index, undefined if not over a data cell */
  rowIndex?: number;
  /** Column index, undefined if not over a cell */
  colIndex?: number;
  /** Field name, undefined if not over a cell */
  field?: string;
  /** Cell value, undefined if not over a data cell */
  value?: unknown;
  /** Row data object, undefined if not over a data row */
  row?: unknown;
  /** Column configuration, undefined if not over a column */
  column?: ColumnConfig;
  /** The cell element, undefined if not over a cell */
  cellElement?: HTMLElement;
  /** The row element, undefined if not over a row */
  rowElement?: HTMLElement;
  /** Whether the event is over a header cell */
  isHeader: boolean;
  /** Cell coordinates if over a valid data cell */
  cell?: CellCoords;
  /** The original mouse event */
  originalEvent: MouseEvent;
}

/**
 * Context passed to the `afterCellRender` plugin hook.
 *
 * This provides efficient cell-level access without requiring DOM queries.
 * Plugins receive this context for each cell as it's rendered, enabling
 * targeted modifications instead of post-render DOM traversal.
 *
 * @category Plugin Development
 * @template TRow - The row data type
 *
 * @example
 * ```typescript
 * afterCellRender(context: AfterCellRenderContext): void {
 *   if (this.isSelected(context.rowIndex, context.colIndex)) {
 *     context.cellElement.classList.add('selected');
 *   }
 * }
 * ```
 */
export interface AfterCellRenderContext<TRow = unknown> {
  /** The row data object */
  row: TRow;
  /** Zero-based row index in the visible rows array */
  rowIndex: number;
  /** The column configuration */
  column: ColumnConfig<TRow>;
  /** Zero-based column index in the visible columns array */
  colIndex: number;
  /** The cell value (row[column.field]) */
  value: unknown;
  /** The cell DOM element - can be modified by the plugin */
  cellElement: HTMLElement;
  /** The row DOM element - for context, prefer using cellElement */
  rowElement: HTMLElement;
}

/**
 * Context menu parameters
 */
export interface ContextMenuParams {
  x: number;
  y: number;
  rowIndex?: number;
  colIndex?: number;
  field?: string;
  value?: unknown;
  row?: unknown;
  column?: ColumnConfig;
  isHeader?: boolean;
}

/**
 * Context menu item (used by context-menu plugin query)
 */
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  separator?: boolean;
  children?: ContextMenuItem[];
  action?: (params: ContextMenuParams) => void;
}

/**
 * Generic plugin query for inter-plugin communication.
 * Plugins can define their own query types as string constants
 * and respond to queries from other plugins.
 */
export interface PluginQuery<T = unknown> {
  /** Query type identifier (e.g., 'canMoveColumn', 'getContextMenuItems') */
  type: string;
  /** Query-specific context/parameters */
  context: T;
}

/**
 * Well-known plugin query types.
 * Plugins can define additional query types beyond these.
 */
export const PLUGIN_QUERIES = {
  /** Ask if a column can be moved. Context: ColumnConfig. Response: boolean | undefined */
  CAN_MOVE_COLUMN: 'canMoveColumn',
  /** Get context menu items. Context: ContextMenuParams. Response: ContextMenuItem[] */
  GET_CONTEXT_MENU_ITEMS: 'getContextMenuItems',
} as const;

/**
 * Cell render context for plugin cell renderers.
 * Provides full context including position and editing state.
 */
export interface PluginCellRenderContext {
  /** The cell value */
  value: unknown;
  /** The row data object */
  row: unknown;
  /** The row index in the data array */
  rowIndex: number;
  /** The column index */
  colIndex: number;
  /** The field name */
  field: string;
  /** The column configuration */
  column: ColumnConfig;
  /** Whether the cell is being edited */
  isEditing: boolean;
}

/**
 * Cell renderer function type for plugins.
 */
export type CellRenderer = (ctx: PluginCellRenderContext) => string | HTMLElement;

/**
 * Header renderer function type for plugins.
 */
export type HeaderRenderer = (ctx: { column: ColumnConfig; colIndex: number }) => string | HTMLElement;

/**
 * Cell editor interface for plugins.
 */
export interface CellEditor {
  create(ctx: PluginCellRenderContext, commitFn: (value: unknown) => void, cancelFn: () => void): HTMLElement;
  getValue?(element: HTMLElement): unknown;
  focus?(element: HTMLElement): void;
}

/**
 * Minimal grid interface for plugins.
 * This avoids circular imports with the full DataGridElement.
 *
 * Member prefixes indicate accessibility:
 * - `_underscore` = protected members accessible to plugins (marked @internal in full interface)
 */
export interface GridElementRef {
  // =========================================================================
  // HTMLElement-like Properties (avoid casting to HTMLElement)
  // =========================================================================

  /** The grid's shadow root. */
  shadowRoot: ShadowRoot | null;
  /** Grid element width in pixels. */
  readonly clientWidth: number;
  /** Grid element height in pixels. */
  readonly clientHeight: number;
  /** Add an event listener to the grid element. */
  addEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  /** Remove an event listener from the grid element. */
  removeEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => unknown,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
  /** Set an attribute on the grid element. */
  setAttribute(name: string, value: string): void;
  /** Get an attribute from the grid element. */
  getAttribute(name: string): string | null;
  /** Remove an attribute from the grid element. */
  removeAttribute(name: string): void;

  // =========================================================================
  // Grid Data & Configuration
  // =========================================================================

  /** Current rows (after plugin processing like grouping, filtering). */
  rows: unknown[];
  /** Original unfiltered/unprocessed rows. */
  sourceRows: unknown[];
  /** Column configurations. */
  columns: ColumnConfig[];
  /** Visible columns only (excludes hidden). Use for rendering. @internal */
  _visibleColumns: ColumnConfig[];
  /** Full grid configuration. */
  gridConfig: GridConfig;
  /** Effective (merged) configuration - the single source of truth. */
  effectiveConfig: GridConfig;

  // =========================================================================
  // Row Update API
  // =========================================================================

  /**
   * Get the unique ID for a row.
   * Uses configured `getRowId` function or falls back to `row.id` / `row._id`.
   * @throws Error if no ID can be determined
   */
  getRowId(row: unknown): string;

  /**
   * Get a row by its ID.
   * O(1) lookup via internal Map.
   * @returns The row object, or undefined if not found
   */
  getRow(id: string): unknown | undefined;

  /**
   * Update a row by ID.
   * Mutates the row in-place and emits `cell-change` for each changed field.
   * @param id - Row identifier (from getRowId)
   * @param changes - Partial row data to merge
   * @param source - Origin of update (default: 'api')
   * @throws Error if row is not found
   */
  updateRow(id: string, changes: Record<string, unknown>, source?: UpdateSource): void;

  /**
   * Batch update multiple rows.
   * More efficient than multiple `updateRow()` calls - single render cycle.
   * @param updates - Array of { id, changes } objects
   * @param source - Origin of updates (default: 'api')
   * @throws Error if any row is not found
   */
  updateRows(updates: Array<{ id: string; changes: Record<string, unknown> }>, source?: UpdateSource): void;

  // =========================================================================
  // Focus & Lifecycle
  // =========================================================================

  /** Current focused row index. @internal */
  _focusRow: number;
  /** Current focused column index. @internal */
  _focusCol: number;
  /** AbortSignal that is aborted when the grid disconnects from the DOM. */
  disconnectSignal: AbortSignal;

  // =========================================================================
  // Rendering
  // =========================================================================

  /** Request a full re-render of the grid. */
  requestRender(): void;
  /** Request a full re-render and restore focus styling afterward. */
  requestRenderWithFocus(): void;
  /** Request a lightweight style update without rebuilding DOM. */
  requestAfterRender(): void;
  /** Force a layout pass. */
  forceLayout(): Promise<void>;
  /** Dispatch an event from the grid element. */
  dispatchEvent(event: Event): boolean;

  // =========================================================================
  // Inter-plugin Communication
  // =========================================================================

  /**
   * Query all plugins with a generic query and collect responses.
   * Used for inter-plugin communication (e.g., asking PinnedColumnsPlugin
   * if a column can be moved).
   *
   * @example
   * const responses = grid.queryPlugins<boolean>({
   *   type: PLUGIN_QUERIES.CAN_MOVE_COLUMN,
   *   context: column
   * });
   * const canMove = !responses.includes(false);
   */
  queryPlugins<T>(query: PluginQuery): T[];

  // =========================================================================
  // DOM Access
  // =========================================================================

  /**
   * Find the rendered DOM element for a row by its data index.
   * Returns null if the row is not currently rendered (virtualized out).
   */
  findRenderedRowElement(rowIndex: number): HTMLElement | null;

  // =========================================================================
  // Column Visibility API
  // =========================================================================

  /**
   * Get all columns including hidden ones.
   * Returns field, header, visibility status, lock state, and utility flag.
   */
  getAllColumns(): Array<{
    field: string;
    header: string;
    visible: boolean;
    lockVisible?: boolean;
    utility?: boolean;
  }>;

  /**
   * Set visibility for a specific column.
   * @returns true if state changed, false if column not found or already in state
   */
  setColumnVisible(field: string, visible: boolean): boolean;

  /**
   * Toggle visibility for a specific column.
   * @returns true if state changed, false if column not found
   */
  toggleColumnVisibility(field: string): boolean;

  /**
   * Check if a column is currently visible.
   */
  isColumnVisible(field: string): boolean;

  /**
   * Show all hidden columns.
   */
  showAllColumns(): void;

  // =========================================================================
  // Column Order API
  // =========================================================================

  /**
   * Get the current column display order as array of field names.
   */
  getColumnOrder(): string[];

  /**
   * Set the column display order.
   * @param order Array of field names in desired order
   */
  setColumnOrder(order: string[]): void;

  /**
   * Request emission of column-state-change event (debounced).
   * Call after programmatic column changes that should notify consumers.
   */
  requestStateChange?(): void;

  // =========================================================================
  // Tool Panel API (Shell Integration)
  // =========================================================================

  /**
   * Whether the tool panel sidebar is currently open.
   */
  readonly isToolPanelOpen: boolean;

  /**
   * Get the IDs of expanded accordion sections.
   */
  readonly expandedToolPanelSections: string[];

  /**
   * Open the tool panel sidebar (accordion view with all registered panels).
   */
  openToolPanel(): void;

  /**
   * Close the tool panel sidebar.
   */
  closeToolPanel(): void;

  /**
   * Toggle the tool panel sidebar open/closed.
   */
  toggleToolPanel(): void;

  /**
   * Toggle a specific accordion section expanded/collapsed.
   * @param sectionId - The panel ID to toggle (matches ToolPanelDefinition.id)
   */
  toggleToolPanelSection(sectionId: string): void;

  /**
   * Get registered tool panel definitions.
   */
  getToolPanels(): ToolPanelDefinition[];
}
