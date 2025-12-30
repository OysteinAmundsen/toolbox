/**
 * Row Grouping Core Logic
 *
 * Pure functions for building grouped row models and aggregations.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { RenderRow, RowGroupingConfig } from './types';

// Re-export aggregator functions from core for backward compatibility
export { getAggregator, listAggregators, registerAggregator, runAggregator } from '../../core/internal/aggregators';

interface GroupNode {
  key: string; // composite key
  value: any;
  depth: number;
  rows: any[];
  children: Map<string, GroupNode>;
  parent?: GroupNode;
}

interface BuildGroupingArgs {
  rows: any[];
  config: RowGroupingConfig;
  expanded: Set<string>;
}

/**
 * Build a flattened grouping projection (collapsed by default).
 * Returns empty array when groupOn not configured or all rows ungrouped.
 *
 * @param args - The grouping arguments
 * @returns Flattened array of render rows (groups + data rows)
 */
export function buildGroupedRowModel({ rows, config, expanded }: BuildGroupingArgs): RenderRow[] {
  const groupOn = config.groupOn;
  if (typeof groupOn !== 'function') {
    return [];
  }

  const root: GroupNode = { key: '__root__', value: null, depth: -1, rows: [], children: new Map() };

  // Build tree structure
  rows.forEach((r) => {
    let path: any = groupOn(r);
    if (path == null || path === false) path = ['__ungrouped__'];
    else if (!Array.isArray(path)) path = [path];

    let parent = root;
    path.forEach((rawVal: any, depthIdx: number) => {
      const seg = rawVal == null ? '∅' : String(rawVal);
      const composite = parent.key === '__root__' ? seg : parent.key + '||' + seg;
      let node = parent.children.get(seg);
      if (!node) {
        node = { key: composite, value: rawVal, depth: depthIdx, rows: [], children: new Map(), parent };
        parent.children.set(seg, node);
      }
      parent = node;
    });
    parent.rows.push(r);
  });

  // All ungrouped? treat as no grouping
  if (root.children.size === 1 && root.children.has('__ungrouped__')) {
    const only = root.children.get('__ungrouped__')!;
    if (only.rows.length === rows.length) return [];
  }

  // Flatten tree to array
  const flat: RenderRow[] = [];
  const visit = (node: GroupNode) => {
    if (node === root) {
      node.children.forEach((c) => visit(c));
      return;
    }

    const isExpanded = expanded.has(node.key);
    flat.push({
      kind: 'group',
      key: node.key,
      value: node.value,
      depth: node.depth,
      rows: node.rows,
      expanded: isExpanded,
    });

    if (isExpanded) {
      if (node.children.size) {
        node.children.forEach((c) => visit(c));
      } else {
        node.rows.forEach((r) => flat.push({ kind: 'data', row: r, rowIndex: rows.indexOf(r) }));
      }
    }
  };
  visit(root);

  return flat;
}

/**
 * Toggle expansion state for a group key.
 *
 * @param expandedKeys - Current set of expanded keys
 * @param key - The group key to toggle
 * @returns New set with toggled state
 */
export function toggleGroupExpansion(expandedKeys: Set<string>, key: string): Set<string> {
  const newSet = new Set(expandedKeys);
  if (newSet.has(key)) {
    newSet.delete(key);
  } else {
    newSet.add(key);
  }
  return newSet;
}

/**
 * Expand all groups.
 *
 * @param rows - The flattened render rows
 * @returns Set of all group keys
 */
export function expandAllGroups(rows: RenderRow[]): Set<string> {
  const keys = new Set<string>();
  for (const row of rows) {
    if (row.kind === 'group') {
      keys.add(row.key);
    }
  }
  return keys;
}

/**
 * Collapse all groups.
 *
 * @returns Empty set
 */
export function collapseAllGroups(): Set<string> {
  return new Set();
}

/**
 * Get all group keys from a flattened model.
 *
 * @param rows - The flattened render rows
 * @returns Array of group keys
 */
export function getGroupKeys(rows: RenderRow[]): string[] {
  return rows.filter((r) => r.kind === 'group').map((r) => (r as any).key);
}

/**
 * Count total rows in a group (including nested groups).
 *
 * @param groupRow - The group row
 * @returns Total row count
 */
export function getGroupRowCount(groupRow: RenderRow): number {
  if (groupRow.kind !== 'group') return 0;
  return groupRow.rows.length;
}
