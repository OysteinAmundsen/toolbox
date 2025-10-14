/**
 * Selection Plugin Entry Point
 * Re-exports plugin class and types for tree-shakeable imports.
 */
export { SelectionPlugin } from './SelectionPlugin';
export { computeSelectionDiff, handleRowClick, selectAll } from './row-selection';
export type { SelectionConfig, SelectionMode, SelectionChangeDetail, CellRange } from './types';
