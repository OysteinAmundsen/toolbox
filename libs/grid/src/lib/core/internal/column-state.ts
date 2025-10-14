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
  if (grid.sortState) {
    sortMap.set(grid.sortState.field, {
      direction: grid.sortState.direction === 1 ? 'asc' : 'desc',
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
  plugins: BaseGridPlugin[]
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
      grid.sortState = {
        field: primarySort.field,
        direction: primarySort.sort.direction === 'asc' ? 1 : -1,
      };
    }
  } else {
    grid.sortState = null;
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
  emit: (detail: GridColumnState) => void
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
