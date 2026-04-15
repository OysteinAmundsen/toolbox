/**
 * Row Grouping Core Logic
 *
 * Pure functions for building grouped row models and aggregations.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { DefaultExpandedValue, GroupDefinition, GroupingRowsConfig, GroupRowModelItem, RenderRow } from './types';

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
  config: GroupingRowsConfig;
  expanded: Set<string>;
  /** Initial expanded state to apply (processed by the plugin) */
  initialExpanded?: Set<string>;
  /** Sort direction per group depth level. 1 = ascending, -1 = descending.
   *  When omitted, groups at all levels sort ascending. */
  groupSortDirections?: Map<number, 1 | -1>;
}

/**
 * Build a flattened grouping projection (collapsed by default).
 * Returns empty array when groupOn not configured or all rows ungrouped.
 *
 * @param args - The grouping arguments
 * @returns Flattened array of render rows (groups + data rows)
 */
export function buildGroupedRowModel({ rows, config, expanded, initialExpanded, groupSortDirections }: BuildGroupingArgs): RenderRow[] {
  const groupOn = config.groupOn;
  if (typeof groupOn !== 'function') {
    return [];
  }

  const root: GroupNode = { key: '__root__', value: null, depth: -1, rows: [], children: new Map() };

  // Build tree structure — push each row into every ancestor along the path
  // so that each group's `rows` array contains ALL data rows in its subtree.
  // This is required for correct counts and aggregations on multi-level groups.
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
      node.rows.push(r);
      parent = node;
    });
  });

  // All ungrouped? treat as no grouping
  if (root.children.size === 1 && root.children.has('__ungrouped__')) {
    const only = root.children.get('__ungrouped__')!;
    if (only.rows.length === rows.length) return [];
  }

  // Pre-build row→index map for O(1) lookups (avoids O(n²) from rows.indexOf)
  const rowIndexMap = new Map<any, number>();
  for (let i = 0; i < rows.length; i++) {
    rowIndexMap.set(rows[i], i);
  }

  // Merge expanded sets - use initialExpanded on first render, then expanded takes over
  const effectiveExpanded = new Set([...expanded, ...(initialExpanded ?? [])]);

  // Sort sibling groups by their group value so that group header order is
  // deterministic and respects the active sort direction for each depth level.
  // Default: ascending. When a user sorts a grouped column, the corresponding
  // depth level's direction flips, keeping groups in predictable order.
  const sortedChildren = (node: GroupNode): GroupNode[] => {
    const children = [...node.children.values()];
    // Determine direction for this depth level (children are one level deeper than the node)
    const childDepth = node === root ? 0 : node.depth + 1;
    const dir = groupSortDirections?.get(childDepth) ?? 1;
    children.sort((a, b) => {
      const av = a.value;
      const bv = b.value;
      if (av == null && bv == null) return 0;
      if (av == null) return dir;
      if (bv == null) return -dir;
      return av > bv ? dir : av < bv ? -dir : 0;
    });
    return children;
  };

  // Flatten tree to array
  const flat: RenderRow[] = [];
  const visit = (node: GroupNode) => {
    if (node === root) {
      for (const c of sortedChildren(node)) visit(c);
      return;
    }

    const isExpanded = effectiveExpanded.has(node.key);
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
        for (const c of sortedChildren(node)) visit(c);
      } else {
        node.rows.forEach((r) => flat.push({ kind: 'data', row: r, rowIndex: rowIndexMap.get(r) ?? -1 }));
      }
    }
  };
  visit(root);

  return flat;
}

/**
 * Discover which column field produces the group value at each depth level.
 *
 * Samples the first row's `groupOn` output to get the group path, then checks
 * which column fields produce matching values for that row. This mapping allows
 * the plugin to apply user-invoked column sort directions to the correct group
 * depth levels.
 *
 * @returns Map from depth index to column field name, or empty map if unmappable
 */
export function resolveGroupFields(
  rows: any[],
  groupOn: (row: any) => any[] | any | null | false,
  columnFields: string[],
): Map<number, string> {
  const depthToField = new Map<number, string>();
  if (rows.length === 0) return depthToField;

  const sampleRow = rows[0];
  let path: any = groupOn(sampleRow);
  if (path == null || path === false) return depthToField;
  if (!Array.isArray(path)) path = [path];

  for (let depth = 0; depth < path.length; depth++) {
    const groupValue = path[depth];
    for (const field of columnFields) {
      if (sampleRow[field] === groupValue) {
        depthToField.set(depth, field);
        break;
      }
    }
  }
  return depthToField;
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
 * Resolve a defaultExpanded value to a set of keys to expand.
 * This needs to be called AFTER building the group model to get all keys.
 *
 * @param value - The defaultExpanded config value
 * @param allGroupKeys - All group keys from the model
 * @returns Set of keys to expand initially
 */
export function resolveDefaultExpanded(value: DefaultExpandedValue, allGroupKeys: string[]): Set<string> {
  if (value === true) {
    // Expand all groups
    return new Set(allGroupKeys);
  }
  if (value === false || value == null) {
    // Collapse all groups
    return new Set();
  }
  if (typeof value === 'number') {
    // Expand group at this index
    const key = allGroupKeys[value];
    return key ? new Set([key]) : new Set();
  }
  if (typeof value === 'string') {
    // Expand group with this key
    return new Set([value]);
  }
  if (Array.isArray(value)) {
    // Expand groups with these keys
    return new Set(value);
  }
  return new Set();
}

/**
 * Get all group keys from a flattened model.
 *
 * @param rows - The flattened render rows
 * @returns Array of group keys
 */
export function getGroupKeys(rows: RenderRow[]): string[] {
  return rows.filter((r): r is GroupRowModelItem => r.kind === 'group').map((r) => r.key);
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

// #region Pre-Defined Group Model

interface PreDefinedGroupModelArgs {
  groups: GroupDefinition[];
  expanded: Set<string>;
  groupRows: Map<string, unknown[]>;
  loadingGroups: Set<string>;
  parentPath?: string[];
}

/**
 * Build a flattened render model from pre-defined group definitions.
 *
 * Unlike `buildGroupedRowModel`, this does not analyze row data — groups
 * are provided externally (e.g. from a server). Row data for each group
 * is populated lazily via the `groupRows` map.
 *
 * @param args - Pre-defined grouping arguments
 * @returns Flattened array of render rows (groups + data rows)
 */
export function buildPreDefinedGroupModel({
  groups,
  expanded,
  groupRows,
  loadingGroups,
  parentPath = [],
}: PreDefinedGroupModelArgs): RenderRow[] {
  const flat: RenderRow[] = [];
  const depth = parentPath.length;

  for (const group of groups) {
    const currentPath = [...parentPath, group.key];
    const isExpanded = expanded.has(group.key);
    const rows = groupRows.get(group.key) ?? [];
    const isLoading = loadingGroups.has(group.key);

    flat.push({
      kind: 'group',
      key: group.key,
      value: group.value,
      depth,
      rows,
      expanded: isExpanded,
    });

    if (isExpanded) {
      // Nested child groups take priority over leaf rows
      if (group.children?.length) {
        const childRows = buildPreDefinedGroupModel({
          groups: group.children,
          expanded,
          groupRows,
          loadingGroups,
          parentPath: currentPath,
        });
        flat.push(...childRows);
      } else if (isLoading) {
        // Loading placeholder — rendered by the plugin as a loading indicator
        flat.push({ kind: 'data', row: { __loading: true, __groupKey: group.key }, rowIndex: -1 });
      } else {
        // Leaf rows from the groupRows map
        rows.forEach((row, idx) => {
          flat.push({ kind: 'data', row, rowIndex: idx });
        });
      }
    }
  }

  return flat;
}

/**
 * Compute the group path (array of ancestor keys) for a given group key
 * within a pre-defined group structure.
 *
 * @param groups - The group definitions to search
 * @param targetKey - The key to find
 * @param parentPath - Accumulated path (used for recursion)
 * @returns Array of group keys from root to target, or empty array if not found
 */
export function getGroupPath(groups: GroupDefinition[], targetKey: string, parentPath: string[] = []): string[] {
  for (const group of groups) {
    const currentPath = [...parentPath, group.key];
    if (group.key === targetKey) {
      return currentPath;
    }
    if (group.children?.length) {
      const found = getGroupPath(group.children, targetKey, currentPath);
      if (found.length > 0) return found;
    }
  }
  return [];
}
// #endregion
