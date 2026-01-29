/**
 * Tree feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `tree` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/tree';
 *
 * <tbw-grid [tree]="{ childrenField: 'children' }" />
 * ```
 *
 * @packageDocumentation
 */

// eslint-disable-next-line @nx/enforce-module-boundaries -- Intentional: feature files must statically import their plugin
import { TreePlugin } from '@toolbox-web/grid/plugins/tree';
import { registerFeature } from '@toolbox-web/grid-angular';

registerFeature('tree', (config) => {
  if (config === true) {
    return new TreePlugin();
  }
  return new TreePlugin(config ?? undefined);
});
