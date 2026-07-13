/**
 * Clipboard Plugin Entry Point
 * Re-exports plugin class and types for tree-shakeable imports.
 *
 * @module Plugins/Clipboard
 */
export { ClipboardPlugin } from './ClipboardPlugin';
export {
  defaultPasteHandler,
  emitPasteRejected,
  resolveColumnPaste,
  type ClipboardConfig,
  type ColumnPasteGuard,
  type CopyDetail,
  type CopyOptions,
  type PasteCellContext,
  type PasteDetail,
  type PasteHandler,
  type PasteRejectedCell,
  type PasteRejectedDetail,
  type PasteRejectionReason,
  type PasteResolution,
  type PasteTarget,
} from './types';
