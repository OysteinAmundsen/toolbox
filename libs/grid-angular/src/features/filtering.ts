/**
 * Filtering feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `filtering` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/filtering';
 *
 * <tbw-grid [filtering]="true" />
 * <tbw-grid [filtering]="{ debounceMs: 200 }" />
 * ```
 *
 * @packageDocumentation
 */

// eslint-disable-next-line @nx/enforce-module-boundaries -- Intentional: feature files must statically import their plugin
import { FilteringPlugin } from '@toolbox-web/grid/plugins/filtering';
import { registerFeature } from '../lib/feature-registry';

registerFeature('filtering', (config) => {
  if (config === true) {
    return new FilteringPlugin();
  }
  return new FilteringPlugin(config ?? undefined);
});
