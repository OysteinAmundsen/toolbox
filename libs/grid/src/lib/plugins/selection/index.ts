/**
 * Selection Plugin Entry Point
 * Re-exports plugin class and types for tree-shakeable imports.
 *
 * @module Plugins/Selection
 */
export { SelectionPlugin } from './SelectionPlugin';
export type {
  CellRange,
  SelectableCallback,
  SelectionChangeDetail,
  SelectionConfig,
  SelectionMode,
  SelectionResult,
  SelectionTrigger,
} from './types';
