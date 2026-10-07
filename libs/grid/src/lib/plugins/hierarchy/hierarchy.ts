/**
 * Hierarchy Engine
 *
 * Pure row-model builder shared by the HierarchyPlugin and its contributors.
 */

import type { HierarchyContributor, HierarchyNode, HierarchyRowMeta } from './types';

/**
 * Build the flat row list for `rows` from every contributor's sibling-list
 * transforms, recording each emitted row's ARIA position in `meta`.
 *
 * Contributors whose `beginHierarchy` returns `false` sit out the rebuild.
 * With no active contributor the rows pass through unchanged. When every
 * active contributor's `endHierarchy` returns `false`, no position is kept in `meta`.
 *
 * This is what `HierarchyPlugin.process()` runs for all attached contributors.
 * Call it directly to run a contributor without a grid — e.g. as the
 * `processRows` fallback when no HierarchyPlugin is attached, or in unit tests.
 *
 * @example
 * ```ts
 * override processRows(rows: readonly unknown[]): unknown[] {
 *   const hierarchy = this.grid?.getPluginByName('hierarchy');
 *   return hierarchy ? hierarchy.process(rows, this) : buildHierarchy(rows, [this]);
 * }
 * ```
 *
 * @param rows - The root rows.
 * @param contributors - Contributors to run, in `processRows` hook order.
 * @param meta - Receives each emitted row's position. Pass a fresh map per rebuild.
 * @returns The flattened rows, in render order.
 * @since 3.9.0
 */
export function buildHierarchy(
  rows: readonly unknown[],
  contributors: readonly HierarchyContributor[],
  meta: WeakMap<object, HierarchyRowMeta> = new WeakMap(),
): unknown[] {
  const active: HierarchyContributor[] = [];
  for (const stage of ['structure', 'transform'] as const) {
    for (const c of contributors) {
      if (c.hierarchyStage === stage && c.beginHierarchy(rows)) active.push(c);
    }
  }
  if (active.length === 0) return [...rows];

  const out: unknown[] = [];
  const process = (nodes: HierarchyNode[], parent: HierarchyNode | null, depth: number): HierarchyNode[] => {
    const context = { parent: parent ? parent.row : null, parentKey: parent?.key ?? null, depth };
    for (const c of active) nodes = c.processSiblings(nodes, context);
    return nodes;
  };
  const emit = (nodes: HierarchyNode[], depth: number): void => {
    const setSize = nodes.length;
    for (let i = 0; i < setSize; i++) {
      const node = nodes[i];
      out.push(node.row);
      if (typeof node.row === 'object' && node.row !== null) {
        meta.set(node.row, { level: depth + 1, setSize, posInSet: i + 1 });
      }
      const children = node.children;
      if (node.expanded && children) {
        emit(node.shaped ? children : process(children, node, depth + 1), depth + 1);
      }
    }
  };

  const roots: HierarchyNode[] = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) roots[i] = { row: rows[i] };
  emit(process(roots, null, 0), 0);

  const positionOf = (row: unknown) => (typeof row === 'object' && row !== null ? meta.get(row) : undefined);
  let shaped = false;
  for (const c of active) if (c.endHierarchy(out, positionOf)) shaped = true;
  if (!shaped) {
    for (const row of out) if (typeof row === 'object' && row !== null) meta.delete(row);
  }
  return out;
}
