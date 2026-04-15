/**
 * Tree Viewport Mapping Utilities
 *
 * Pure functions for translating between flat viewport row indices and
 * top-level tree node indices. Used by the Tree plugin's
 * `datasource:viewport-mapping` query handler.
 */

import type { FlattenedTreeRow } from './types';

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
