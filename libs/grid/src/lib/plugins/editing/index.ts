/**
 * Editing Plugin Entry Point
 * Re-exports plugin class and types for tree-shakeable imports.
 *
 * @module Plugins/Editing
 */
export { EditingPlugin } from './EditingPlugin';
export { defaultEditorFor } from './editors';
export type { EditingConfig, EditorContext } from './types';
