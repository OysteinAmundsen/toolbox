/**
 * Shell feature for @toolbox-web/grid-angular
 *
 * Import this module to opt the grid shell (header bar + tool panels) into
 * the build. The shell also auto-registers in v2.x (so it is on by default
 * and non-breaking); importing this module makes the opt-in explicit and
 * tree-shakeable for v3, where the auto-register is removed.
 *
 * The shell is configured through `gridConfig` (`features: { shell }` or the
 * `<tbw-grid-header-content>` / `<tbw-grid-toolbar-content>` /
 * `<tbw-grid-tool-panel>` directives), not a boolean input.
 *
 * @example
 * ```typescript
 * // In your bootstrap (e.g. main.ts or app.component.ts):
 * import '@toolbox-web/grid-angular/features/shell';
 * ```
 *
 * ```html
 * <tbw-grid [gridConfig]="{ features: { shell: { header: { title: 'Employees' } } } }">
 * </tbw-grid>
 * ```
 *
 * @packageDocumentation
 */

import '@toolbox-web/grid/features/shell';
export type { _Augmentation as _ShellAugmentation } from '@toolbox-web/grid/features/shell';
