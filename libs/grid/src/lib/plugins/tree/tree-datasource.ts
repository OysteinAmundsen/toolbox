/**
 * Lazy Tree Data Source Logic
 *
 * Pure functions for scroll boundary detection and page loading
 * when using TreeDataSource for lazy-loaded tree data.
 */

import type { FlattenedTreeRow } from './types';

/**
 * Default number of top-level nodes to fetch per page.
 */
export const DEFAULT_PAGE_SIZE = 50;

/**
 * Number of top-level nodes before the end of loaded data that triggers
 * a prefetch of the next page.
 */
export const PREFETCH_THRESHOLD = 5;

/** Scroll debounce delay in ms */
export const SCROLL_DEBOUNCE_MS = 100;

/**
 * Given a flat row index in the viewport, find the index of the
 * top-level node (depth 0) that "owns" that row.
 *
 * Walk backwards from the row index until a depth-0 row is found,
 * then return its position among all depth-0 rows.
 */
export function getTopLevelNodeIndex(flattenedRows: FlattenedTreeRow[], flatRowIndex: number): number {
  // Clamp to valid range
  const idx = Math.min(flatRowIndex, flattenedRows.length - 1);
  if (idx < 0) return 0;

  // Walk backwards to find the owning top-level node
  let current = idx;
  while (current > 0 && flattenedRows[current].depth > 0) {
    current--;
  }

  // Count how many depth-0 nodes precede this one (inclusive)
  let topLevelIndex = 0;
  for (let i = 0; i <= current; i++) {
    if (flattenedRows[i].depth === 0) {
      topLevelIndex++;
    }
  }
  // Convert to 0-based
  return topLevelIndex - 1;
}

/**
 * Count the number of top-level (depth 0) nodes in the flattened rows.
 */
export function countTopLevelNodes(flattenedRows: FlattenedTreeRow[]): number {
  let count = 0;
  for (const row of flattenedRows) {
    if (row.depth === 0) count++;
  }
  return count;
}

/**
 * Determine whether we should prefetch the next page of data.
 *
 * Returns `true` when the viewport's last visible row corresponds to a
 * top-level node that is within `threshold` nodes of the last loaded
 * top-level node.
 */
export function shouldPrefetch(
  flattenedRows: FlattenedTreeRow[],
  viewportEnd: number,
  loadedTopLevelCount: number,
  threshold: number = PREFETCH_THRESHOLD,
): boolean {
  if (flattenedRows.length === 0) return false;

  const lastVisibleTopLevel = getTopLevelNodeIndex(flattenedRows, viewportEnd);
  return lastVisibleTopLevel >= loadedTopLevelCount - threshold;
}
