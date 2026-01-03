/**
 * Pinned Rows Plugin Entry Point
 * Re-exports plugin class and types for tree-shakeable imports.
 */
export { PinnedRowsPlugin } from './PinnedRowsPlugin';
export type {
  AggregationRowConfig,
  AggregatorConfig,
  AggregatorDefinition,
  AggregatorFormatter,
  PinnedRowsConfig,
  PinnedRowsContext,
  PinnedRowsPanel,
} from './types';
