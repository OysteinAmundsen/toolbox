/**
 * Editing Plugin Entry Point
 * Re-exports plugin class and types for tree-shakeable imports.
 *
 * @module Plugins/Editing
 */
export { EditingPlugin } from './EditingPlugin';
export { defaultEditorFor } from './editors';
export type { BaselinesCapturedDetail, DirtyChangeDetail, DirtyRowEntry } from './internal/dirty-tracking';
export type {
  // Event detail types
  BeforeEditCloseDetail,
  CellCancelDetail,
  CellCommitDetail,
  ChangedRowsResetDetail,
  // Editor config types
  DateEditorParams,
  EditCloseDetail,
  EditingConfig,
  EditOpenDetail,
  EditorParams,
  NumberEditorParams,
  RowCommitDetail,
  SelectEditorParams,
  TextEditorParams,
} from './types';
