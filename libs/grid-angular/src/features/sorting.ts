/**
 * Sorting feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `sorting` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/sorting';
 *
 * <tbw-grid [sorting]="'multi'" />
 * ```
 *
 * @packageDocumentation
 */

// eslint-disable-next-line @nx/enforce-module-boundaries -- Intentional: feature files must statically import their plugin
import { MultiSortPlugin } from '@toolbox-web/grid/plugins/multi-sort';
import { registerFeature } from '../lib/feature-registry';

registerFeature('sorting', (config) => {
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
