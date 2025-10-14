/**
 * Row Selection Core Logic
 *
 * Pure functions for row selection operations.
 */

import type { SelectionMode, SelectionState } from './types';

/** Click modifier keys state */
export interface ClickModifiers {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

/** Result from handling a row click for selection */
export interface RowClickResult {
  selected: Set<number>;
  lastSelected: number;
  anchor: number | null;
}

/**
 * Handle a row click event for selection purposes.
 *
 * In single mode: always selects the clicked row, clearing others.
 * In multiple mode:
 *   - Plain click: clears selection and selects clicked row
 *   - Ctrl/Cmd+click: toggles the clicked row
 *   - Shift+click: range select from anchor to clicked row
 *
 * @param state - Current selection state
 * @param rowIndex - The clicked row index
 * @param mode - Selection mode ('single' or 'multiple')
 * @param modifiers - Keyboard modifiers held during click
 * @returns Updated selection state values
 */
export function handleRowClick(
  state: SelectionState,
  rowIndex: number,
  mode: SelectionMode,
  modifiers: ClickModifiers
): RowClickResult {
  const newSelected = new Set(state.selected);
  let anchor = state.anchor;

  if ((mode as string) === 'single') {
    newSelected.clear();
    newSelected.add(rowIndex);
    anchor = rowIndex;
  } else if ((mode as string) === 'multiple') {
    const ctrlOrMeta = modifiers.ctrlKey || modifiers.metaKey;

    if (modifiers.shiftKey && state.anchor !== null) {
      // Range selection from anchor
      const start = Math.min(state.anchor, rowIndex);
      const end = Math.max(state.anchor, rowIndex);
      for (let i = start; i <= end; i++) {
        newSelected.add(i);
      }
    } else if (ctrlOrMeta) {
      // Toggle selection
      if (newSelected.has(rowIndex)) {
        newSelected.delete(rowIndex);
      } else {
        newSelected.add(rowIndex);
      }
      anchor = rowIndex;
    } else {
      // Clear and select single
      newSelected.clear();
      newSelected.add(rowIndex);
      anchor = rowIndex;
    }
  }

  return { selected: newSelected, lastSelected: rowIndex, anchor };
}

/**
 * Create a set containing all row indices (for select all).
 *
 * @param rowCount - Total number of rows
 * @returns Set containing indices 0 to rowCount-1
 */
export function selectAll(rowCount: number): Set<number> {
  const selected = new Set<number>();
  for (let i = 0; i < rowCount; i++) {
    selected.add(i);
  }
  return selected;
}

/**
 * Compute the difference between two selection states.
 *
 * @param oldSelected - Previous selection set
 * @param newSelected - New selection set
 * @returns Object with added and removed row indices
 */
export function computeSelectionDiff(
  oldSelected: Set<number>,
  newSelected: Set<number>
): { added: number[]; removed: number[] } {
  const added: number[] = [];
  const removed: number[] = [];

  for (const idx of newSelected) {
    if (!oldSelected.has(idx)) added.push(idx);
  }
  for (const idx of oldSelected) {
    if (!newSelected.has(idx)) removed.push(idx);
  }

  return { added, removed };
}
