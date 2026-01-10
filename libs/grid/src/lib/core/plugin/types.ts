/**
 * Shared types for the plugin system.
 *
 * These types are used by both the base plugin class and the grid core.
 * Centralizing them here avoids circular imports and reduces duplication.
 */

import type { ColumnConfig, GridConfig } from '../types';

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
 */
export interface GridElementRef {
  shadowRoot: ShadowRoot | null;
  rows: unknown[];
  columns: ColumnConfig[];
  gridConfig: GridConfig;
  /** Current focused row index */
  _focusRow: number;
  /** Current focused column index */
  _focusCol: number;
  /** AbortSignal that is aborted when the grid disconnects from the DOM */
  disconnectSignal: AbortSignal;
  requestRender(): void;
  requestAfterRender(): void;
  forceLayout(): Promise<void>;
  dispatchEvent(event: Event): boolean;
}
