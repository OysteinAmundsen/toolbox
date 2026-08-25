/**
 * Selection Plugin Entry Point
 * Re-exports plugin class and types for tree-shakeable imports.
 *
 * @module Plugins/Selection
 */
export { SelectionPlugin } from './selection-plugin';
export type {
  CellRange,
  SelectableCallback,
  SelectionAxis,
  SelectionChangeDetail,
  SelectionConfig,
  SelectionMode,
  SelectionResult,
  SelectionTrigger,
  TouchSelectionMode,
} from './types';
