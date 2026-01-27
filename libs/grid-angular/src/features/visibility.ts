/**
 * Column visibility feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `visibility` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/visibility';
 *
 * <tbw-grid [visibility]="true" />
 * ```
 *
 * @packageDocumentation
 */

// eslint-disable-next-line @nx/enforce-module-boundaries -- Intentional: feature files must statically import their plugin
import { VisibilityPlugin } from '@toolbox-web/grid/plugins/visibility';
import { registerFeature } from '../lib/feature-registry';

registerFeature('visibility', (config) => {
  if (config === true) {
    return new VisibilityPlugin();
  }
  return new VisibilityPlugin(config ?? undefined);
});
