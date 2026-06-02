/**
 * Shell feature for @toolbox-web/grid
 *
 * Enables the grid shell — an optional wrapper that adds a header bar (title,
 * toolbar contents, tool-panel toggle) and a collapsible side panel for
 * filters, column visibility, settings, etc.
 *
 * This is the canonical, best-practice opt-in for the shell. The shell also
 * auto-registers in v2.x (so it is on by default and non-breaking); importing
 * this module makes the opt-in explicit and tree-shakeable for v3, where the
 * auto-register is removed and the feature (or an explicit
 * `plugins: [new ShellPlugin()]`) is required.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/shell';
 *
 * grid.gridConfig = {
 *   features: {
 *     shell: { header: { title: 'Employees' }, toolPanel: { position: 'right' } },
 *   },
 * };
 * ```
 */

import { ShellPlugin, type ShellConfig } from '../plugins/shell';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /** Enable the grid shell (header bar + tool panels). */
    shell?: boolean | ShellConfig;
  }
}

registerFeature('shell', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as ShellConfig) ?? {});
  return new ShellPlugin(options);
});

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
