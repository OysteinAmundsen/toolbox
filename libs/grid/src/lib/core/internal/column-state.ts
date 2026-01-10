/**
 * Column State Module
 *
 * Handles collection and application of column state for persistence.
 * State includes user-driven changes: order, width, visibility, and sort.
 * Plugins can contribute additional state via getColumnState/applyColumnState hooks.
 */

import type { BaseGridPlugin } from '../plugin';
import type {
  ColumnConfig,
  ColumnInternal,
  ColumnSortState,
  ColumnState,
  GridColumnState,
  InternalGrid,
} from '../types';

/** Debounce timeout for state change events */
const STATE_CHANGE_DEBOUNCE_MS = 100;

/**
 * Get sort state for a column from the grid's sortState.
 */
function getSortState(grid: InternalGrid): Map<string, ColumnSortState> {
  const sortMap = new Map<string, ColumnSortState>();

  // Core sort state (single column)
  if (grid._sortState) {
    sortMap.set(grid._sortState.field, {
      direction: grid._sortState.direction === 1 ? 'asc' : 'desc',
      priority: 0,
    });
  }

  return sortMap;
}

/**
 * Collect column state from the grid and all plugins.
 * Returns a complete GridColumnState object ready for serialization.
 */
export function collectColumnState<T>(grid: InternalGrid<T>, plugins: BaseGridPlugin[]): GridColumnState {
  const columns = grid._columns;
  const sortStates = getSortState(grid);

  return {
    columns: columns.map((col, index) => {
      // 1. Core state
      const state: ColumnState = {
        field: col.field,
        order: index,
        visible: true, // If it's in _columns, it's visible (hidden columns are filtered out)
      };

      // Include width if set (either from config or resize)
      const internalCol = col as ColumnInternal<T>;
      if (internalCol.__renderedWidth !== undefined) {
        state.width = internalCol.__renderedWidth;
      } else if (col.width !== undefined) {
        state.width = typeof col.width === 'string' ? parseFloat(col.width) : col.width;
      }

      // Include sort state if present
      const sortState = sortStates.get(col.field);
      if (sortState) {
        state.sort = sortState;
      }

      // 2. Collect from each plugin
      for (const plugin of plugins) {
        if (plugin.getColumnState) {
          const pluginState = plugin.getColumnState(col.field);
          if (pluginState) {
            Object.assign(state, pluginState);
          }
        }
      }

      return state;
    }),
  };
}

/**
 * Apply column state to the grid and all plugins.
 * Modifies the grid's internal state and triggers plugin state restoration.
 *
 * @param grid - The grid instance
 * @param state - The state to apply
 * @param allColumns - All available columns (including hidden ones)
 * @param plugins - Plugins that may have applyColumnState hooks
 */
export function applyColumnState<T>(
  grid: InternalGrid<T>,
  state: GridColumnState,
  allColumns: ColumnConfig<T>[],
  plugins: BaseGridPlugin[],
): void {
  if (!state.columns || state.columns.length === 0) return;

  const stateMap = new Map(state.columns.map((s) => [s.field, s]));

  // 1. Apply width and visibility to columns
  const updatedColumns = allColumns.map((col) => {
    const s = stateMap.get(col.field);
    if (!s) return col;

    const updated: ColumnInternal<T> = { ...col };

    // Apply width
    if (s.width !== undefined) {
      updated.width = s.width;
      updated.__renderedWidth = s.width;
    }

    // Apply visibility (hidden is inverse of visible)
    if (s.visible !== undefined) {
      updated.hidden = !s.visible;
    }

    return updated;
  });

  // 2. Reorder columns based on state
  updatedColumns.sort((a, b) => {
    const orderA = stateMap.get(a.field)?.order ?? Infinity;
    const orderB = stateMap.get(b.field)?.order ?? Infinity;
    return orderA - orderB;
  });

  // 3. Update grid's internal columns
  grid._columns = updatedColumns as ColumnInternal<T>[];

  // 4. Apply sort state (core single-column sort)
  // Find the column with highest sort priority
  const sortedByPriority = state.columns
    .filter((s) => s.sort !== undefined)
    .sort((a, b) => (a.sort?.priority ?? 0) - (b.sort?.priority ?? 0));

  if (sortedByPriority.length > 0) {
    const primarySort = sortedByPriority[0];
    if (primarySort.sort) {
      grid._sortState = {
        field: primarySort.field,
        direction: primarySort.sort.direction === 'asc' ? 1 : -1,
      };
    }
  } else {
    grid._sortState = null;
  }

  // 5. Let each plugin apply its state
  for (const plugin of plugins) {
    if (plugin.applyColumnState) {
      for (const colState of state.columns) {
        plugin.applyColumnState(colState.field, colState);
      }
    }
  }
}

/**
 * Create a state change handler with debouncing.
 * Returns a function that, when called, will eventually emit the state change event.
 */
export function createStateChangeHandler<T>(
  grid: InternalGrid<T>,
  getPlugins: () => BaseGridPlugin[],
  emit: (detail: GridColumnState) => void,
): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return () => {
    // Clear any pending timeout
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    // Schedule the emit
    timeoutId = setTimeout(() => {
      timeoutId = null;
      const state = collectColumnState(grid, getPlugins());
      emit(state);
    }, STATE_CHANGE_DEBOUNCE_MS);
  };
}

/**
 * Compare two column states to check if they are equal.
 * Useful for preventing duplicate state change events.
 */
export function areColumnStatesEqual(a: GridColumnState, b: GridColumnState): boolean {
  if (a.columns.length !== b.columns.length) return false;

  for (let i = 0; i < a.columns.length; i++) {
    const colA = a.columns[i];
    const colB = b.columns[i];

    if (colA.field !== colB.field) return false;
    if (colA.order !== colB.order) return false;
    if (colA.visible !== colB.visible) return false;
    if (colA.width !== colB.width) return false;

    // Compare sort state
    const sortA = colA.sort;
    const sortB = colB.sort;
    if ((sortA === undefined) !== (sortB === undefined)) return false;
    if (sortA && sortB) {
      if (sortA.direction !== sortB.direction) return false;
      if (sortA.priority !== sortB.priority) return false;
    }
  }

  return true;
}

// ============================================================================
// Column State API (High-level functions)
// ============================================================================
// These functions are extracted from grid.ts to reduce the god object size.
// Grid.ts delegates to these functions for all state-related operations.

/**
 * State manager for a grid instance.
 * Encapsulates the state change handler and initial state storage.
 */
export interface ColumnStateManager {
  /** The initial state to apply after initialization */
  initialState: GridColumnState | undefined;
  /** Debounced state change handler */
  stateChangeHandler: (() => void) | undefined;
}

/**
 * Create a column state manager for a grid.
 */
export function createColumnStateManager(): ColumnStateManager {
  return {
    initialState: undefined,
    stateChangeHandler: undefined,
  };
}

/**
 * Get the current column state from the grid.
 * @param grid - The grid instance
 * @param plugins - Array of attached plugins
 * @returns Serializable column state object
 */
export function getGridColumnState<T>(grid: InternalGrid<T>, plugins: BaseGridPlugin[]): GridColumnState {
  return collectColumnState(grid, plugins);
}

/**
 * Set column state on a grid, storing for later if not yet initialized.
 * @param grid - The grid instance
 * @param state - The state to apply
 * @param manager - The column state manager
 * @param isInitialized - Whether the grid is initialized
 * @param applyNow - Function to apply the state immediately
 */
export function setGridColumnState<T>(
  state: GridColumnState | undefined,
  manager: ColumnStateManager,
  isInitialized: boolean,
  applyNow: (state: GridColumnState) => void,
): void {
  if (!state) return;

  // Store for use after initialization if called before ready
  manager.initialState = state;

  // If already initialized, apply immediately
  if (isInitialized) {
    applyNow(state);
  }
}

/**
 * Request a state change event emission (debounced).
 * @param grid - The grid instance
 * @param manager - The column state manager
 * @param getPlugins - Function to get attached plugins
 * @param emit - Function to emit the event
 */
export function requestGridStateChange<T>(
  grid: InternalGrid<T>,
  manager: ColumnStateManager,
  getPlugins: () => BaseGridPlugin[],
  emit: (state: GridColumnState) => void,
): void {
  if (!manager.stateChangeHandler) {
    manager.stateChangeHandler = createStateChangeHandler(grid, getPlugins, emit);
  }
  manager.stateChangeHandler();
}

/**
 * Reset column state to initial configuration.
 * @param grid - The grid instance
 * @param manager - The column state manager
 * @param plugins - Array of attached plugins
 * @param callbacks - Grid callbacks for triggering updates
 */
export function resetGridColumnState<T>(
  grid: InternalGrid<T>,
  manager: ColumnStateManager,
  plugins: BaseGridPlugin[],
  callbacks: {
    mergeEffectiveConfig: () => void;
    setup: () => void;
    requestStateChange: () => void;
  },
): void {
  // Clear initial state
  manager.initialState = undefined;

  // Clear hidden flag on all columns
  const allCols = (grid.effectiveConfig?.columns ?? []) as ColumnInternal<T>[];
  allCols.forEach((c) => {
    c.hidden = false;
  });

  // Reset sort state
  grid._sortState = null;
  grid.__originalOrder = [];

  // Re-initialize columns from config
  callbacks.mergeEffectiveConfig();
  callbacks.setup();

  // Notify plugins to reset their state
  for (const plugin of plugins) {
    if (plugin.applyColumnState) {
      // Pass empty state to indicate reset
      for (const col of grid._columns) {
        plugin.applyColumnState(col.field, {
          field: col.field,
          order: 0,
          visible: true,
        });
      }
    }
  }

  // Emit state change
  callbacks.requestStateChange();
}

// ============================================================================
// Column Visibility API
// ============================================================================
// Pure functions for column visibility operations.

/** Callbacks for visibility changes that need grid integration */
export interface VisibilityCallbacks {
  emit: (eventName: string, detail: unknown) => void;
  clearRowPool: () => void;
  setup: () => void;
  requestStateChange: () => void;
}

/**
 * Set the visibility of a column.
 * @returns true if visibility changed, false otherwise
 */
export function setColumnVisible<T>(
  grid: InternalGrid<T>,
  field: string,
  visible: boolean,
  callbacks: VisibilityCallbacks,
): boolean {
  const allCols = (grid.effectiveConfig?.columns ?? []) as ColumnInternal<T>[];
  const col = allCols.find((c) => c.field === field);

  if (!col) return false;
  if (!visible && col.lockVisible) return false;

  // Ensure at least one column remains visible
  if (!visible) {
    const remainingVisible = allCols.filter((c) => !c.hidden && c.field !== field).length;
    if (remainingVisible === 0) return false;
  }

  const wasHidden = !!col.hidden;
  if (wasHidden === !visible) return false; // No change

  col.hidden = !visible;

  callbacks.emit('column-visibility', {
    field,
    visible,
    visibleColumns: allCols.filter((c) => !c.hidden).map((c) => c.field),
  });

  callbacks.clearRowPool();
  callbacks.setup();
  callbacks.requestStateChange();
  return true;
}

/**
 * Toggle column visibility.
 * @returns true if toggled, false if column not found or locked
 */
export function toggleColumnVisibility<T>(
  grid: InternalGrid<T>,
  field: string,
  callbacks: VisibilityCallbacks,
): boolean {
  const allCols = (grid.effectiveConfig?.columns ?? []) as ColumnInternal<T>[];
  const col = allCols.find((c) => c.field === field);
  return col ? setColumnVisible(grid, field, !!col.hidden, callbacks) : false;
}

/**
 * Check if a column is visible.
 */
export function isColumnVisible<T>(grid: InternalGrid<T>, field: string): boolean {
  const allCols = (grid.effectiveConfig?.columns ?? []) as ColumnInternal<T>[];
  const col = allCols.find((c) => c.field === field);
  return col ? !col.hidden : false;
}

/**
 * Show all columns.
 */
export function showAllColumns<T>(grid: InternalGrid<T>, callbacks: VisibilityCallbacks): void {
  const allCols = (grid.effectiveConfig?.columns ?? []) as ColumnInternal<T>[];
  if (!allCols.some((c) => c.hidden)) return;

  allCols.forEach((c) => (c.hidden = false));

  callbacks.emit('column-visibility', {
    visibleColumns: allCols.map((c) => c.field),
  });

  callbacks.clearRowPool();
  callbacks.setup();
  callbacks.requestStateChange();
}

/**
 * Get all columns with visibility info.
 */
export function getAllColumns<T>(
  grid: InternalGrid<T>,
): Array<{ field: string; header: string; visible: boolean; lockVisible?: boolean }> {
  const allCols = (grid.effectiveConfig?.columns ?? []) as ColumnInternal<T>[];
  return allCols.map((c) => ({
    field: c.field,
    header: c.header || c.field,
    visible: !c.hidden,
    lockVisible: c.lockVisible,
  }));
}

/**
 * Get current column order.
 */
export function getColumnOrder<T>(grid: InternalGrid<T>): string[] {
  return grid._columns.map((c) => c.field);
}

/**
 * Set column order.
 */
export function setColumnOrder<T>(
  grid: InternalGrid<T>,
  order: string[],
  callbacks: { renderHeader: () => void; updateTemplate: () => void; refreshVirtualWindow: () => void },
): void {
  if (!order.length) return;

  const columnMap = new Map(grid._columns.map((c) => [c.field as string, c]));
  const reordered: ColumnInternal<T>[] = [];

  for (const field of order) {
    const col = columnMap.get(field);
    if (col) {
      reordered.push(col);
      columnMap.delete(field);
    }
  }

  // Add remaining columns not in order
  for (const col of columnMap.values()) {
    reordered.push(col);
  }

  grid._columns = reordered;

  callbacks.renderHeader();
  callbacks.updateTemplate();
  callbacks.refreshVirtualWindow();
}
