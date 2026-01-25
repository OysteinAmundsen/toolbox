/**
 * Row Animation Module
 *
 * Provides row-level animation utilities for the grid.
 * Animations are CSS-based and triggered via data attributes.
 *
 * Supported animations:
 * - `change`: Flash highlight for modified rows (e.g., after editing)
 * - `insert`: Slide-in animation for newly added rows
 * - `remove`: Fade-out animation for rows being removed
 *
 * @module internal/row-animation
 */

import type { InternalGrid, RowAnimationType } from '../types';

/**
 * Data attribute used to trigger row animations via CSS.
 */
const ANIMATION_ATTR = 'data-animating';

/**
 * Map of animation types to their CSS custom property duration names.
 */
const DURATION_PROPS: Record<RowAnimationType, string> = {
  change: '--tbw-row-change-duration',
  insert: '--tbw-row-insert-duration',
  remove: '--tbw-row-remove-duration',
};

/**
 * Default animation durations in milliseconds.
 */
const DEFAULT_DURATIONS: Record<RowAnimationType, number> = {
  change: 500,
  insert: 300,
  remove: 200,
};

/**
 * Parse a CSS duration string (e.g., "500ms", "0.5s") to milliseconds.
 */
function parseDuration(value: string): number {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.endsWith('ms')) {
    return parseFloat(trimmed);
  }
  if (trimmed.endsWith('s')) {
    return parseFloat(trimmed) * 1000;
  }
  return parseFloat(trimmed);
}

/**
 * Get the animation duration for a row element.
 * Reads from CSS custom property or falls back to default.
 */
function getAnimationDuration(rowEl: HTMLElement, animationType: RowAnimationType): number {
  const prop = DURATION_PROPS[animationType];
  const computed = getComputedStyle(rowEl).getPropertyValue(prop);
  if (computed) {
    const parsed = parseDuration(computed);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_DURATIONS[animationType];
}

/**
 * Animate a single row element.
 *
 * @param rowEl - The row DOM element to animate
 * @param animationType - The type of animation to apply
 * @param onComplete - Optional callback when animation completes
 */
export function animateRowElement(rowEl: HTMLElement, animationType: RowAnimationType, onComplete?: () => void): void {
  // Remove any existing animation first (allows re-triggering)
  rowEl.removeAttribute(ANIMATION_ATTR);

  // Force a reflow to restart the animation
  void rowEl.offsetWidth;

  // Apply the animation
  rowEl.setAttribute(ANIMATION_ATTR, animationType);

  // Get duration and schedule cleanup
  const duration = getAnimationDuration(rowEl, animationType);

  setTimeout(() => {
    // For 'remove' animations, skip removing the attribute since the element
    // will be destroyed by the onComplete callback. This prevents a visual
    // flash where the element snaps back to its original state.
    if (animationType !== 'remove') {
      rowEl.removeAttribute(ANIMATION_ATTR);
    }
    onComplete?.();
  }, duration);
}

/**
 * Animate a row by its data index.
 *
 * @param grid - The grid instance
 * @param rowIndex - The data row index (not DOM position)
 * @param animationType - The type of animation to apply
 * @returns true if the row was found and animated, false otherwise
 */
export function animateRow<T>(grid: InternalGrid<T>, rowIndex: number, animationType: RowAnimationType): boolean {
  // Guard against invalid indices
  if (rowIndex < 0) {
    return false;
  }

  const rowEl = grid.findRenderedRowElement?.(rowIndex);
  if (!rowEl) {
    // Row is virtualized out of view - nothing to animate
    return false;
  }

  animateRowElement(rowEl, animationType);
  return true;
}

/**
 * Animate multiple rows by their data indices.
 *
 * @param grid - The grid instance
 * @param rowIndices - Array of data row indices to animate
 * @param animationType - The type of animation to apply
 * @returns Number of rows that were actually animated (visible in viewport)
 */
export function animateRows<T>(grid: InternalGrid<T>, rowIndices: number[], animationType: RowAnimationType): number {
  let animatedCount = 0;
  for (const rowIndex of rowIndices) {
    if (animateRow(grid, rowIndex, animationType)) {
      animatedCount++;
    }
  }
  return animatedCount;
}

/**
 * Animate a row by its ID.
 *
 * @param grid - The grid instance
 * @param rowId - The row ID (requires getRowId to be configured)
 * @param animationType - The type of animation to apply
 * @returns true if the row was found and animated, false otherwise
 */
export function animateRowById<T>(grid: InternalGrid<T>, rowId: string, animationType: RowAnimationType): boolean {
  // Find row index by searching _rows
  const rows = grid._rows ?? [];
  const getRowId = grid.getRowId;
  if (!getRowId) {
    return false;
  }

  const rowIndex = rows.findIndex((row) => getRowId(row) === rowId);
  if (rowIndex < 0) {
    return false;
  }
  return animateRow(grid, rowIndex, animationType);
}
