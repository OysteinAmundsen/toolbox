/**
 * Shell Plugin (Class-based)
 *
 * Owns the grid shell: header bar, toolbar content, and tool panels.
 *
 * **Extraction #370 — Phase 1a (skeleton):** this class is currently an empty
 * `BaseGridPlugin` shell that only contributes the shell CSS. State, light-DOM
 * parsing, lifecycle, and DOM construction are moved out of core into this
 * class in Phase 1b. Until then, core still drives the shell; the auto-register
 * + delegate seam is wired in Phase 1b/Phase 2.
 *
 * @module Plugins/Shell
 */

import { BaseGridPlugin, type GridElement } from '../../core/plugin/base-plugin';
// Transitional: the canonical ShellConfig moves into ./types in Task 1a.2.
import type { ShellConfig } from '../../core/types';
import styles from './shell.css?inline';
import './types';

/**
 * Shell plugin for `<tbw-grid>`.
 *
 * @see {@link ShellConfig} for all configuration options.
 *
 * @internal Extends BaseGridPlugin.
 * @since 2.x (extraction #370)
 */
export class ShellPlugin extends BaseGridPlugin<ShellConfig> {
  /** @internal */
  readonly name = 'shell';
  /** @internal */
  override readonly styles = styles;

  /** @internal */
  override attach(grid: GridElement): void {
    super.attach(grid);
    // Phase 1b moves shell state, light-DOM parsing, listeners, and DOM
    // construction here.
  }

  /** @internal */
  override detach(): void {
    // Phase 1b moves shell teardown (state cleanup, light-DOM handler
    // unregistration) here.
    super.detach();
  }
}
