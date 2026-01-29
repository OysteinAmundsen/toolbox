/**
 * Multi-sort feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `multiSort` input on Grid directive.
 * Multi-sort allows sorting by multiple columns simultaneously.
 *
 * For basic single-column sorting, columns with `sortable: true` work without this plugin.
 * Use `[sortable]="false"` on the grid to disable all sorting.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/multi-sort';
 *
 * <tbw-grid [multiSort]="true" />
 * <tbw-grid [multiSort]="'single'" />
 * <tbw-grid [multiSort]="{ maxSortColumns: 3 }" />
 * ```
 *
 * @packageDocumentation
 */

// eslint-disable-next-line @nx/enforce-module-boundaries -- Intentional: feature files must statically import their plugin
import { MultiSortPlugin } from '@toolbox-web/grid/plugins/multi-sort';
import { registerFeature } from '@toolbox-web/grid-angular';

registerFeature('multiSort', (config) => {
  // Handle shorthand: true, 'single', 'multi'
  if (config === true || config === 'multi') {
    return new MultiSortPlugin();
  }
  if (config === 'single') {
    return new MultiSortPlugin({ maxSortColumns: 1 });
  }
  // Full config object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new MultiSortPlugin(config as any);
});
