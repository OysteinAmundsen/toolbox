/**
 * Tree Plugin Entry Point
 * Re-exports plugin class and types for tree-shakeable imports.
 */
export { TreePlugin } from './TreePlugin';
export { countNodes, detectTreeStructure, getMaxDepth, inferChildrenField } from './tree-detect';
export type { TreeConfig, TreeState, TreeExpandDetail, FlattenedTreeRow } from './types';
