/**
 * Clipboard Plugin Entry Point
 * Re-exports plugin class and types for tree-shakeable imports.
 *
 * @module Plugins/Clipboard
 */
export { ClipboardPlugin } from './ClipboardPlugin';
export {
  defaultPasteHandler,
  type ClipboardConfig,
  type CopyDetail,
  type PasteDetail,
  type PasteHandler,
  type PasteTarget,
} from './types';
