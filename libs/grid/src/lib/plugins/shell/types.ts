/**
 * Shell Plugin Types
 *
 * Extraction #370, Phase 1a: this file currently holds only the
 * `PluginNameMap` augmentation so `grid.getPluginByName('shell')` is typed.
 * The canonical shell config types (`ShellConfig`, `ToolPanelConfig`, etc.)
 * are relocated here from `core/types.ts` in Task 1a.2.
 *
 * @module Plugins/Shell
 */

declare module '../../core/types' {
  interface PluginNameMap {
    shell: import('./ShellPlugin').ShellPlugin;
  }
}

export {};
