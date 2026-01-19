/**
 * Pinned Rows Plugin Entry Point
 * Re-exports plugin class and types for tree-shakeable imports.
 *
 * @module Plugins/Pinned Rows
 */
export { PinnedRowsPlugin } from './PinnedRowsPlugin';
export type {
  AggregationRowConfig,
  AggregatorDefinition,
  PinnedRowsConfig,
  PinnedRowsContext,
  PinnedRowsPanel,
} from './types';
