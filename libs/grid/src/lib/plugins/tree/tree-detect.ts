/**
 * Tree Structure Auto-Detection
 *
 * Utilities for detecting hierarchical tree data structures.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// The tree plugin intentionally uses `any` for maximum flexibility with user-defined row types.

/**
 * Detects if the data has a tree structure by checking for children arrays.
 */
export function detectTreeStructure(rows: any[], childrenField = 'children'): boolean {
  if (!Array.isArray(rows) || rows.length === 0) return false;

  // Check if any row has a non-empty children array
  for (const row of rows) {
    if (row && Array.isArray(row[childrenField]) && row[childrenField].length > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Attempts to infer the children field name from common patterns.
 * Returns the first field that contains an array with items.
 */
export function inferChildrenField(rows: any[]): string | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const commonArrayFields = ['children', 'items', 'nodes', 'subRows', 'nested'];

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;

    for (const field of commonArrayFields) {
      if (Array.isArray(row[field]) && row[field].length > 0) {
        return field;
      }
    }
  }

  return null;
}

/**
 * Calculates the maximum depth of the tree.
 * Useful for layout calculations and virtualization.
 */
export function getMaxDepth(rows: any[], childrenField = 'children', currentDepth = 0): number {
  if (!Array.isArray(rows) || rows.length === 0) return currentDepth;

  let maxDepth = currentDepth;

  for (const row of rows) {
    if (!row) continue;
    const children = row[childrenField];
    if (Array.isArray(children) && children.length > 0) {
      const childDepth = getMaxDepth(children, childrenField, currentDepth + 1);
      if (childDepth > maxDepth) {
        maxDepth = childDepth;
      }
    }
  }

  return maxDepth;
}

/**
 * Counts total nodes in the tree (including all descendants).
 */
export function countNodes(rows: any[], childrenField = 'children'): number {
  if (!Array.isArray(rows)) return 0;

  let count = 0;
  for (const row of rows) {
    if (!row) continue;
    count++;
    const children = row[childrenField];
    if (Array.isArray(children)) {
      count += countNodes(children, childrenField);
    }
  }

  return count;
}
