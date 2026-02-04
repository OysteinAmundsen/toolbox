/**
 * Loading State Module
 *
 * Handles loading overlays, row loading, and cell loading states.
 * Provides DOM manipulation helpers for loading indicators.
 *
 * @module internal/loading
 */

import type { GridConfig, LoadingContext } from '../types';

/**
 * Create the default spinner element.
 * @param size - 'large' for grid overlay, 'small' for row/cell
 */
export function createDefaultSpinner(size: 'large' | 'small'): HTMLElement {
  const spinner = document.createElement('div');
  spinner.className = `tbw-spinner tbw-spinner--${size}`;
  spinner.setAttribute('role', 'progressbar');
  spinner.setAttribute('aria-label', 'Loading');
  return spinner;
}

/**
 * Create loading content using custom renderer or default spinner.
 * @param size - 'large' for grid overlay, 'small' for row/cell
 * @param renderer - Optional custom loading renderer from config
 */
export function createLoadingContent(size: 'large' | 'small', renderer?: GridConfig['loadingRenderer']): HTMLElement {
  if (renderer) {
    const context: LoadingContext = { size };
    const result = renderer(context);
    if (typeof result === 'string') {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = result;
      return wrapper;
    }
    return result;
  }

  return createDefaultSpinner(size);
}

/**
 * Create or update the loading overlay element.
 * @param renderer - Optional custom loading renderer from config
 */
export function createLoadingOverlay(renderer?: GridConfig['loadingRenderer']): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'tbw-loading-overlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.appendChild(createLoadingContent('large', renderer));
  return overlay;
}

/**
 * Show the loading overlay on the grid root element.
 * @param gridRoot - The .tbw-grid-root element
 * @param overlayEl - The overlay element (will be cached by caller)
 */
export function showLoadingOverlay(gridRoot: Element, overlayEl: HTMLElement): void {
  gridRoot.appendChild(overlayEl);
}

/**
 * Hide the loading overlay.
 * @param overlayEl - The overlay element to remove
 */
export function hideLoadingOverlay(overlayEl: HTMLElement | undefined): void {
  overlayEl?.remove();
}

/**
 * Update a row element's loading state.
 * @param rowEl - The row element
 * @param loading - Whether the row is loading
 */
export function setRowLoadingState(rowEl: HTMLElement, loading: boolean): void {
  if (loading) {
    rowEl.classList.add('tbw-row-loading');
    rowEl.setAttribute('aria-busy', 'true');
  } else {
    rowEl.classList.remove('tbw-row-loading');
    rowEl.removeAttribute('aria-busy');
  }
}

/**
 * Update a cell element's loading state.
 * @param cellEl - The cell element
 * @param loading - Whether the cell is loading
 */
export function setCellLoadingState(cellEl: HTMLElement, loading: boolean): void {
  if (loading) {
    cellEl.classList.add('tbw-cell-loading');
    cellEl.setAttribute('aria-busy', 'true');
  } else {
    cellEl.classList.remove('tbw-cell-loading');
    cellEl.removeAttribute('aria-busy');
  }
}

/**
 * Loading state manager for a grid instance.
 * Tracks which rows and cells are in loading state.
 */
export interface LoadingState {
  /** Whether the entire grid is loading */
  loading: boolean;
  /** Set of row IDs that are currently loading */
  loadingRows: Set<string>;
  /** Map of row ID -> Set of field names for cells that are loading */
  loadingCells: Map<string, Set<string>>;
  /** Cached loading overlay element */
  overlayEl?: HTMLElement;
}

/**
 * Create initial loading state.
 */
export function createLoadingState(): LoadingState {
  return {
    loading: false,
    loadingRows: new Set(),
    loadingCells: new Map(),
    overlayEl: undefined,
  };
}

/**
 * Check if a row is in loading state.
 */
export function isRowLoading(state: LoadingState, rowId: string): boolean {
  return state.loadingRows.has(rowId);
}

/**
 * Check if a cell is in loading state.
 */
export function isCellLoading(state: LoadingState, rowId: string, field: string): boolean {
  return state.loadingCells.get(rowId)?.has(field) ?? false;
}

/**
 * Set row loading state, returns true if state changed.
 */
export function setRowLoading(state: LoadingState, rowId: string, loading: boolean): boolean {
  const wasLoading = state.loadingRows.has(rowId);
  if (loading) {
    state.loadingRows.add(rowId);
  } else {
    state.loadingRows.delete(rowId);
  }
  return wasLoading !== loading;
}

/**
 * Set cell loading state, returns true if state changed.
 */
export function setCellLoading(state: LoadingState, rowId: string, field: string, loading: boolean): boolean {
  let cellFields = state.loadingCells.get(rowId);
  const wasLoading = cellFields?.has(field) ?? false;

  if (loading) {
    if (!cellFields) {
      cellFields = new Set();
      state.loadingCells.set(rowId, cellFields);
    }
    cellFields.add(field);
  } else {
    cellFields?.delete(field);
    // Clean up empty sets
    if (cellFields?.size === 0) {
      state.loadingCells.delete(rowId);
    }
  }

  return wasLoading !== loading;
}

/**
 * Clear all loading states.
 */
export function clearAllLoadingState(state: LoadingState): void {
  state.loading = false;
  state.loadingRows.clear();
  state.loadingCells.clear();
}
