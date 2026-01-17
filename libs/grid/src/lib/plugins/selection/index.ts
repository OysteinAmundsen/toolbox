/**
 * Selection Plugin Entry Point
 * Re-exports plugin class and types for tree-shakeable imports.
 */
export { computeSelectionDiff, handleRowClick, selectAll } from './row-selection';
export { SelectionPlugin } from './SelectionPlugin';
export type { CellRange, SelectionChangeDetail, SelectionConfig, SelectionMode, SelectionResult } from './types';
