/**
 * Hierarchy Engine
 *
 * Pure row-model builder shared by the HierarchyPlugin and its contributors.
 */

import type { HierarchyContributor, HierarchyNode, HierarchyRowMeta } from './types';

/** Copy-on-write: contributors may hold on to node objects, so a substituted node is a new object. */
function substituteRows(nodes: HierarchyNode[], substitute: (row: unknown) => unknown): HierarchyNode[] {
  let out: HierarchyNode[] | undefined;
  for (let i = 0; i < nodes.length; i++) {
    const row = substitute(nodes[i].row);
    if (row === nodes[i].row) continue;
    out ??= nodes.slice();
    out[i] = { ...nodes[i], row };
  }
  return out ?? nodes;
}

/** Copy-on-write substitution of a plain row list (the roots, before any node exists). */
function substituteValues(rows: readonly unknown[], substitute: (row: unknown) => unknown): readonly unknown[] {
  let out: unknown[] | undefined;
  for (let i = 0; i < rows.length; i++) {
    const row = substitute(rows[i]);
    if (row === rows[i]) continue;
    out ??= rows.slice();
    out[i] = row;
  }
  return out ?? rows;
}

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
 * @param substitute - Optional. Maps a row to the object to use in its place, at
 * every nesting level, before any contributor sees it. Return the row itself to
 * keep it. `HierarchyPlugin` uses this to keep a row being edited when the data
 * is replaced with new objects. Added in 3.10.2.
 * @returns The flattened rows, in render order.
 * @since 3.9.0
 */
export function buildHierarchy(
  rows: readonly unknown[],
  contributors: readonly HierarchyContributor[],
  meta: WeakMap<object, HierarchyRowMeta> = new WeakMap(),
  substitute?: (row: unknown) => unknown,
): unknown[] {
  // Roots are substituted BEFORE activation: `beginHierarchy` decides from them whether
  // there is any structure (a pinned parent may be the only row with children).
  const roots = substitute ? substituteValues(rows, substitute) : rows;
  const active: HierarchyContributor[] = [];
  for (const stage of ['structure', 'transform'] as const) {
    for (const c of contributors) {
      if (c.hierarchyStage === stage && c.beginHierarchy(roots)) active.push(c);
    }
  }
  if (active.length === 0) return [...roots];

  const out: unknown[] = [];
  const process = (nodes: HierarchyNode[], parent: HierarchyNode | null, depth: number): HierarchyNode[] => {
    if (substitute && parent) nodes = substituteRows(nodes, substitute);
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

  const rootNodes: HierarchyNode[] = new Array(roots.length);
  for (let i = 0; i < roots.length; i++) rootNodes[i] = { row: roots[i] };
  emit(process(rootNodes, null, 0), 0);

  const positionOf = (row: unknown) => (typeof row === 'object' && row !== null ? meta.get(row) : undefined);
  let shaped = false;
  for (const c of active) if (c.endHierarchy(out, positionOf)) shaped = true;
  if (!shaped) {
    for (const row of out) if (typeof row === 'object' && row !== null) meta.delete(row);
  }
  return out;
}
