/**
 * Editing Plugin Entry Point
 * Re-exports plugin class and types for tree-shakeable imports.
 *
 * @module Plugins/Editing
 */
export { EditingPlugin } from './EditingPlugin';
export { defaultEditorFor } from './editors';
export type {
  // Event detail types
  CellCommitDetail,
  ChangedRowsResetDetail,
  // Editor config types
  DateEditorParams,
  EditingConfig,
  EditorContext,
  EditorParams,
  NumberEditorParams,
  RowCommitDetail,
  SelectEditorParams,
  TextEditorParams,
} from './types';
