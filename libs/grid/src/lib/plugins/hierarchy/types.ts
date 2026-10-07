/**
 * Hierarchy Plugin Types
 *
 * The contract between the HierarchyPlugin and the plugins that contribute
 * structure to the row model (TreePlugin, GroupingRowsPlugin, …).
 */

/**
 * One node of the row hierarchy. The HierarchyPlugin flattens nodes into the
 * grid's row list in pre-order, descending into {@link HierarchyNode.children}
 * only when {@link HierarchyNode.expanded} is `true`.
 *
 * @since 3.9.0
 */
export interface HierarchyNode {
  /** The object emitted into the grid's row list — a source row, or a synthetic row such as a group header. */
  row: unknown;
  /** Contributor-assigned stable key. Passed to the children's {@link HierarchySiblingContext.parentKey}. */
  key?: string;
  /** Child nodes. Rendered only while {@link HierarchyNode.expanded} is `true`. */
  children?: HierarchyNode[];
  /** Whether {@link HierarchyNode.children} are rendered. */
  expanded?: boolean;
  /**
   * `true` when {@link HierarchyNode.children} is already final (e.g. a group's members) and must
   * not be passed through the contributors again. Omitted: `children` is a natural sibling list
   * (e.g. a tree row's children) that every contributor gets to reshape.
   */
  shaped?: boolean;
}

/**
 * Position of a natural sibling list inside the hierarchy.
 *
 * @since 3.9.0
 */
export interface HierarchySiblingContext {
  /** The row whose children this list is, or `null` for the root list. */
  parent: unknown;
  /** Key of the parent node, or `null` for the root list. */
  parentKey: string | null;
  /** Depth of the nodes in this list (0 = root). */
  depth: number;
}

/**
 * A plugin that contributes structure to the hierarchy.
 *
 * Contributors never call each other: the HierarchyPlugin runs every attached
 * contributor on each natural sibling list — `structure` contributors first
 * (discover children, order siblings), then `transform` contributors
 * (re-shape the list, e.g. insert group nodes).
 *
 * @since 3.9.0
 */
export interface HierarchyContributor {
  /** `structure` contributors run before `transform` contributors on every list. */
  readonly hierarchyStage: 'structure' | 'transform';
  /**
   * Called once per row-model rebuild with the root rows. Return `false` to sit
   * out this rebuild (e.g. the data is not a tree).
   */
  beginHierarchy(rows: readonly unknown[]): boolean;
  /** Re-shape one natural sibling list. Return the input array when nothing changes. */
  processSiblings(nodes: HierarchyNode[], context: HierarchySiblingContext): HierarchyNode[];
  /**
   * Called once per rebuild (only if {@link beginHierarchy} returned `true`) with the flattened
   * rows. `positionOf` returns a row's final position — its depth can exceed the
   * `context.depth` seen in {@link processSiblings} when a transform inserted levels above it.
   */
  endHierarchy(rows: readonly unknown[], positionOf: (row: unknown) => HierarchyRowMeta | undefined): void;
}

/**
 * Position of a flattened row in the hierarchy, as announced through
 * `aria-level` / `aria-setsize` / `aria-posinset`.
 *
 * @since 3.9.0
 */
export interface HierarchyRowMeta {
  /** 1-based nesting level (`aria-level`). */
  level: number;
  /** Number of siblings in the row's list (`aria-setsize`). */
  setSize: number;
  /** 1-based position among its siblings (`aria-posinset`). */
  posInSet: number;
}

// Module Augmentation - Register plugin name for type-safe getPluginByName()
declare module '../../core/types' {
  interface PluginNameMap {
    hierarchy: import('./hierarchy-plugin').HierarchyPlugin;
  }
}
