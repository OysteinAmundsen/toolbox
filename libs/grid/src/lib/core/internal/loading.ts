/**
 * Loading State Module
 *
 * Handles loading overlays, row loading, and cell loading states.
 * Provides DOM manipulation helpers for loading indicators.
 *
 * @module internal/loading
 */

import type { FrameworkAdapter, GridConfig, LoadingContext, RowElementInternal } from '../types';
import { setSanitizedHTML } from './sanitize';

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
 *
 * Strings returned by a custom renderer are passed through `setSanitizedHTML()`
 * — mirroring the cell, header and empty-state render paths — so a message
 * interpolating server data (e.g. `Loading ${dataset.name}…`) is not an XSS
 * sink.
 *
 * @param size - 'large' for grid overlay, 'small' for row/cell
 * @param renderer - Optional custom loading renderer from config
 */
export function createLoadingContent(size: 'large' | 'small', renderer?: GridConfig['loadingRenderer']): HTMLElement {
  if (renderer) {
    const context: LoadingContext = { size };
    const result = renderer(context);
    if (typeof result === 'string') {
      const wrapper = document.createElement('div');
      setSanitizedHTML(wrapper, result);
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

/** Remove a cell's owned loading overlay and release adapter-managed content. */
export function removeCellLoadingOverlay(cellEl: HTMLElement, adapter?: Pick<FrameworkAdapter, 'unmount'>): void {
  if (!cellEl.firstElementChild) return;
  const overlay = cellEl.querySelector<HTMLElement>(':scope > .tbw-cell-loading-overlay');
  if (!overlay) return;
  adapter?.unmount?.(overlay);
  overlay.remove();
}

/** Remove a row's owned loading overlay and release adapter-managed content. */
export function removeRowLoadingOverlay(rowEl: HTMLElement, adapter?: Pick<FrameworkAdapter, 'unmount'>): void {
  if (!rowEl.firstElementChild) return;
  const overlay = rowEl.querySelector<HTMLElement>(':scope > .tbw-row-loading-overlay');
  if (!overlay) return;
  adapter?.unmount?.(overlay);
  overlay.remove();
}

/**
 * Update a row element's loading state.
 * Uses real DOM elements instead of ::before/::after pseudo-elements
 * because the selection plugin already uses ::after on rows for border styling.
 * @param rowEl - The row element
 * @param loading - Whether the row is loading
 * @param renderer - Optional `gridConfig.loadingRenderer`; called with `{ size: 'small' }`
 *   in place of the default spinner. Only invoked when the overlay is created.
 * @param adapter - Framework adapter used to release renderer-owned content on removal.
 */
export function setRowLoadingState(
  rowEl: HTMLElement,
  loading: boolean,
  renderer?: GridConfig['loadingRenderer'],
  adapter?: Pick<FrameworkAdapter, 'unmount'>,
): void {
  if (loading) {
    rowEl.classList.add('tbw-row-loading');
    rowEl.setAttribute('aria-busy', 'true');

    // Create overlay + spinner DOM elements if not already present.
    // Direct children only — a nested grid's row overlay must not be mistaken for this row's.
    if (!rowEl.querySelector(':scope > .tbw-row-loading-overlay')) {
      const overlay = document.createElement('div');
      overlay.className = 'tbw-row-loading-overlay';
      overlay.setAttribute('aria-hidden', 'true');

      if (renderer) {
        overlay.appendChild(createLoadingContent('small', renderer));
      } else {
        const spinner = document.createElement('div');
        spinner.className = 'tbw-row-loading-spinner';
        overlay.appendChild(spinner);
      }

      rowEl.appendChild(overlay);
    }
  } else {
    rowEl.classList.remove('tbw-row-loading');
    rowEl.removeAttribute('aria-busy');

    // Remove overlay + spinner DOM elements
    removeRowLoadingOverlay(rowEl, adapter);
  }
}

/**
 * Update a cell element's loading state.
 * @param cellEl - The cell element
 * @param loading - Whether the cell is loading
 * @param renderer - Optional `gridConfig.loadingRenderer`; called with `{ size: 'small' }`
 */
export function setCellLoadingState(
  cellEl: HTMLElement,
  loading: boolean,
  renderer?: GridConfig['loadingRenderer'],
  adapter?: Pick<FrameworkAdapter, 'unmount'>,
): void {
  if (loading) {
    cellEl.classList.add('tbw-cell-loading');
    cellEl.setAttribute('aria-busy', 'true');

    // Breadcrumb so the render hot path can skip the per-cell scan on the
    // overwhelming majority of rows. Conservative: only ever set here, so it can
    // read stale-true after the last loading cell clears (costs one extra scan).
    const rowEl = cellEl.parentElement as RowElementInternal | null;
    if (rowEl) rowEl.__hasCellLoading = true;

    if (renderer) {
      cellEl.classList.add('tbw-cell-loading-custom');
      if (!cellEl.querySelector(':scope > .tbw-cell-loading-overlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'tbw-cell-loading-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.appendChild(createLoadingContent('small', renderer));
        cellEl.appendChild(overlay);
      }
    } else {
      cellEl.classList.remove('tbw-cell-loading-custom');
      removeCellLoadingOverlay(cellEl, adapter);
    }
  } else {
    cellEl.classList.remove('tbw-cell-loading');
    cellEl.classList.remove('tbw-cell-loading-custom');
    cellEl.removeAttribute('aria-busy');
    removeCellLoadingOverlay(cellEl, adapter);
  }
}
