/**
 * Hierarchy Plugin Entry Point
 * Re-exports plugin class and types for tree-shakeable imports.
 *
 * @module Plugins/Hierarchy
 */
export { buildHierarchy } from './hierarchy';
export { HierarchyPlugin } from './hierarchy-plugin';
export type {
  HierarchyContributor,
  HierarchyNode,
  HierarchyRowMeta,
  HierarchySiblingContext,
} from './types';
