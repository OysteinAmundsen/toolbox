/**
 * Core Tree Data Logic
 *
 * Pure functions for tree flattening, expansion, and traversal.
 */

import type { FlattenedTreeRow, TreeConfig, TreeRow } from './types';

/**
 * Generates a unique key for a row.
 * Uses row.id if available, otherwise generates from path.
 */
export function generateRowKey(row: TreeRow, index: number, parentKey: string | null): string {
  if (row.id !== undefined) return String(row.id);
  return parentKey ? `${parentKey}-${index}` : String(index);
}

/**
 * Flattens a hierarchical tree into a flat array of rows with metadata.
 * Only includes children of expanded nodes.
 */
export function flattenTree(
  rows: readonly TreeRow[],
  config: TreeConfig,
  expandedKeys: Set<string>,
  parentKey: string | null = null,
  depth = 0,
): FlattenedTreeRow[] {
  const childrenField = config.childrenField ?? 'children';
  const result: FlattenedTreeRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const key = generateRowKey(row, i, parentKey);
    const children = row[childrenField];
    const hasChildren = Array.isArray(children) && children.length > 0;
    const isExpanded = expandedKeys.has(key);

    result.push({
      key,
      data: row,
      depth,
      hasChildren,
      isExpanded,
      parentKey,
    });

    // Recursively add children if expanded
    if (hasChildren && isExpanded) {
      const childRows = flattenTree(children as TreeRow[], config, expandedKeys, key, depth + 1);
      result.push(...childRows);
    }
  }

  return result;
}

/**
 * Toggles the expansion state of a row.
 * Returns a new Set with the toggled state.
 */
export function toggleExpand(expandedKeys: Set<string>, key: string): Set<string> {
  const newExpanded = new Set(expandedKeys);
  if (newExpanded.has(key)) {
    newExpanded.delete(key);
  } else {
    newExpanded.add(key);
  }
  return newExpanded;
}

/**
 * Expands all nodes in the tree.
 * Returns a Set of all parent row keys.
 */
export function expandAll(
  rows: readonly TreeRow[],
  config: TreeConfig,
  parentKey: string | null = null,
  depth = 0,
): Set<string> {
  const childrenField = config.childrenField ?? 'children';
  const keys = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const key = generateRowKey(row, i, parentKey);
    const children = row[childrenField];

    if (Array.isArray(children) && children.length > 0) {
      keys.add(key);
      const childKeys = expandAll(children as TreeRow[], config, key, depth + 1);
      for (const k of childKeys) keys.add(k);
    }
  }

  return keys;
}

/**
 * Collapses all nodes.
 * Returns an empty Set.
 */
export function collapseAll(): Set<string> {
  return new Set();
}

/**
 * Gets all descendants of a node from the flattened row list.
 * Useful for operations that need to affect an entire subtree.
 */
export function getDescendants(flattenedRows: FlattenedTreeRow[], parentKey: string): FlattenedTreeRow[] {
  const descendants: FlattenedTreeRow[] = [];
  let collecting = false;
  let parentDepth = -1;

  for (const row of flattenedRows) {
    if (row.key === parentKey) {
      collecting = true;
      parentDepth = row.depth;
      continue;
    }

    if (collecting) {
      if (row.depth > parentDepth) {
        descendants.push(row);
      } else {
        break; // No longer a descendant
      }
    }
  }

  return descendants;
}

/**
 * Finds the path from root to a specific row key.
 * Returns an array of keys from root to the target (inclusive).
 */
export function getPathToKey(
  rows: readonly TreeRow[],
  targetKey: string,
  config: TreeConfig,
  parentKey: string | null = null,
  depth = 0,
): string[] | null {
  const childrenField = config.childrenField ?? 'children';

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const key = generateRowKey(row, i, parentKey);

    if (key === targetKey) {
      return [key];
    }

    const children = row[childrenField];
    if (Array.isArray(children) && children.length > 0) {
      const childPath = getPathToKey(children as TreeRow[], targetKey, config, key, depth + 1);
      if (childPath) {
        return [key, ...childPath];
      }
    }
  }

  return null;
}

/**
 * Expands all ancestors of a specific row to make it visible.
 * Returns a new Set with the required keys added.
 */
export function expandToKey(
  rows: readonly TreeRow[],
  targetKey: string,
  config: TreeConfig,
  existingExpanded: Set<string>,
): Set<string> {
  const path = getPathToKey(rows, targetKey, config);
  if (!path) return existingExpanded;

  const newExpanded = new Set(existingExpanded);
  // Add all keys except the last one (the target itself)
  for (let i = 0; i < path.length - 1; i++) {
    newExpanded.add(path[i]);
  }
  return newExpanded;
}
