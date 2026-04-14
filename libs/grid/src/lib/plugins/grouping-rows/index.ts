/**
 * Grouping Rows Plugin Entry Point
 * Re-exports plugin class and types for tree-shakeable imports.
 *
 * @module Plugins/Grouping Rows
 */
export { GroupingRowsPlugin } from './GroupingRowsPlugin';
export type { GroupState } from './GroupingRowsPlugin';
export type {
  AggregatorMap,
  DataRowModelItem,
  DefaultExpandedValue,
  GroupCollapseDetail,
  GroupDefinition,
  GroupExpandDetail,
  GroupingRowsConfig,
  GroupRowModelItem,
  GroupRowRenderParams,
  GroupToggleDetail,
  RenderRow,
} from './types';
