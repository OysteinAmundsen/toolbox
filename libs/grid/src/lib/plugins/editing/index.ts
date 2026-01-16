/**
 * Editing Plugin Entry Point
 * Re-exports plugin class and types for tree-shakeable imports.
 */
export { EditingPlugin, FOCUSABLE_EDITOR_SELECTOR, clearEditingState, hasEditingCells } from './EditingPlugin';
export { defaultEditorFor } from './editors';
export type { CellCommitDetail, ChangedRowsResetDetail, EditingConfig, EditorContext, RowCommitDetail } from './types';
