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
 * Uses real DOM elements instead of ::before/::after pseudo-elements
 * because the selection plugin already uses ::after on rows for border styling.
 * @param rowEl - The row element
 * @param loading - Whether the row is loading
 */
export function setRowLoadingState(rowEl: HTMLElement, loading: boolean): void {
  if (loading) {
    rowEl.classList.add('tbw-row-loading');
    rowEl.setAttribute('aria-busy', 'true');

    // Create overlay + spinner DOM elements if not already present
    if (!rowEl.querySelector('.tbw-row-loading-overlay')) {
      const overlay = document.createElement('div');
      overlay.className = 'tbw-row-loading-overlay';
      overlay.setAttribute('aria-hidden', 'true');

      const spinner = document.createElement('div');
      spinner.className = 'tbw-row-loading-spinner';
      overlay.appendChild(spinner);

      rowEl.appendChild(overlay);
    }
  } else {
    rowEl.classList.remove('tbw-row-loading');
    rowEl.removeAttribute('aria-busy');

    // Remove overlay + spinner DOM elements
    rowEl.querySelector('.tbw-row-loading-overlay')?.remove();
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
