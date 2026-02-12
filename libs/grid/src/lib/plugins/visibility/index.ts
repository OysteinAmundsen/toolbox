/**
 * Visibility Plugin Entry Point
 * Re-exports plugin class and types for tree-shakeable imports.
 *
 * @module Plugins/Visibility
 */
export type { ColumnGroupInfo, ColumnVisibilityDetail, VisibilityConfig } from './types';
export { VisibilityPlugin } from './VisibilityPlugin';
export type { ColumnReorderRequestDetail } from './VisibilityPlugin';
