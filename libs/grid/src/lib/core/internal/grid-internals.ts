/**
 * Grid Internals Module
 *
 * Defines the interface for internal grid access that extracted modules need.
 * This decouples modules from the concrete Grid class while maintaining type safety.
 *
 * Modules receive `grid: GridInternals` and can access internal state through
 * well-defined properties and methods, enabling tree-shaking and testability.
 */

import type { BaseGridPlugin } from '../plugin';
import type { ColumnInternal, GridConfig, InternalGrid } from '../types';

/**
 * Callback interface for grid operations that modules need to trigger.
 * These are provided by the grid to modules so they can trigger re-renders,
 * emit events, etc. without direct coupling.
 */
export interface GridCallbacks<T = any> {
  /** Emit a custom event from the grid element */
  emit: (eventName: string, detail: any) => void;
  /** Trigger full grid setup (re-parse columns, re-render) */
  setup: () => void;
  /** Refresh the virtual window (re-render visible rows) */
  refreshVirtualWindow: (full: boolean) => void;
  /** Update CSS grid template for column widths */
  updateTemplate: () => void;
  /** Render the header row */
  renderHeader: () => void;
  /** Get array of attached plugins */
  getPlugins: () => BaseGridPlugin[];
  /** Find rendered row element by index */
  findRenderedRowElement: (rowIndex: number) => HTMLElement | null;
}

/**
 * Interface for internal grid state access.
 *
 * Extracted modules (columns.ts, column-state.ts, editing.ts, shell.ts) receive
 * this interface instead of the full Grid class. This:
 * 1. Makes dependencies explicit
 * 2. Enables tree-shaking (modules don't depend on entire Grid)
 * 3. Improves testability (can mock this interface)
 */
export interface GridInternals<T = any> {
  // ============== Effective Config (Read/Write) ==============
  /** The merged effective config - single source of truth */
  effectiveConfig: GridConfig<T>;

  // ============== Column State (Read/Write) ==============
  /** All columns including hidden */
  _columns: ColumnInternal<T>[];
  /** Visible columns only (computed from _columns) */
  readonly _visibleColumns: ColumnInternal<T>[];

  // ============== Row State (Read/Write) ==============
  /** Processed rows (after plugin hooks) */
  _rows: T[];
  /** Source rows before processing */
  readonly sourceRows: T[];

  // ============== Editing State (Read/Write) ==============
  /** Currently active edit row index (-1 if none) */
  _activeEditRows: number;
  /** Snapshots of row data before editing started */
  _rowEditSnapshots: Map<number, T>;
  /** Set of row indices that have been modified */
  _changedRowIndices: Set<number>;

  // ============== Focus State (Read/Write) ==============
  /** Currently focused row index */
  _focusRow: number;
  /** Currently focused column index */
  _focusCol: number;

  // ============== Sort State (Read/Write) ==============
  /** Current sort state */
  _sortState: { field: string; direction: 1 | -1 } | null;

  // ============== DOM References (Read-only) ==============
  /** Shadow root of the grid element */
  readonly shadowRoot: ShadowRoot | null;
  /** Header row element */
  readonly _headerRowEl: HTMLElement;
  /** Body container element (holds rendered rows) */
  readonly _bodyEl: HTMLElement;
  /** Row element pool for virtualization */
  _rowPool: HTMLElement[];

  // ============== Render State (Read/Write) ==============
  /** Epoch counter for row rendering (incremented on structural changes) */
  __rowRenderEpoch: number;

  // ============== Callbacks ==============
  /** Grid operation callbacks */
  readonly _callbacks: GridCallbacks<T>;
}

/**
 * Create a GridInternals adapter from an InternalGrid instance.
 *
 * This function bridges the gap between the full grid and the minimal interface
 * that extracted modules need. Call this in grid.ts to create the adapter once.
 *
 * @param grid - The full grid instance
 * @param callbacks - Callbacks for grid operations
 * @returns GridInternals interface backed by the grid
 */
export function createGridInternals<T>(grid: InternalGrid<T>, callbacks: GridCallbacks<T>): GridInternals<T> {
  return {
    // Effective config - delegate to grid's effectiveConfig
    get effectiveConfig() {
      return (grid as any).effectiveConfig ?? {};
    },
    set effectiveConfig(value: GridConfig<T>) {
      (grid as any).effectiveConfig = value;
    },

    // Column state
    get _columns() {
      return grid._columns;
    },
    set _columns(value: ColumnInternal<T>[]) {
      grid._columns = value;
    },
    get _visibleColumns() {
      return grid._visibleColumns;
    },

    // Row state
    get _rows() {
      return grid._rows;
    },
    set _rows(value: T[]) {
      grid._rows = value;
    },
    get sourceRows() {
      return (grid as any).sourceRows ?? grid._rows;
    },

    // Editing state
    get _activeEditRows() {
      return grid._activeEditRows;
    },
    set _activeEditRows(value: number) {
      grid._activeEditRows = value;
    },
    get _rowEditSnapshots() {
      return grid._rowEditSnapshots;
    },
    get _changedRowIndices() {
      return grid._changedRowIndices;
    },

    // Focus state
    get _focusRow() {
      return grid._focusRow;
    },
    set _focusRow(value: number) {
      grid._focusRow = value;
    },
    get _focusCol() {
      return grid._focusCol;
    },
    set _focusCol(value: number) {
      grid._focusCol = value;
    },

    // Sort state
    get _sortState() {
      return grid._sortState;
    },
    set _sortState(value: { field: string; direction: 1 | -1 } | null) {
      grid._sortState = value;
    },

    // DOM references
    get shadowRoot() {
      return grid.shadowRoot;
    },
    get _headerRowEl() {
      return grid._headerRowEl;
    },
    get _bodyEl() {
      return grid._bodyEl;
    },
    get _rowPool() {
      return grid._rowPool;
    },
    set _rowPool(value: HTMLElement[]) {
      grid._rowPool = value;
    },

    // Render state
    get __rowRenderEpoch() {
      return grid.__rowRenderEpoch;
    },
    set __rowRenderEpoch(value: number) {
      grid.__rowRenderEpoch = value;
    },

    // Callbacks
    _callbacks: callbacks,
  };
}
