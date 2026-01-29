/**
 * Print feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `print` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/print';
 *
 * <tbw-grid [print]="true" />
 * ```
 *
 * @packageDocumentation
 */

// eslint-disable-next-line @nx/enforce-module-boundaries -- Intentional: feature files must statically import their plugin
import { PrintPlugin } from '@toolbox-web/grid/plugins/print';
import { registerFeature } from '@toolbox-web/grid-angular';

registerFeature('print', (config) => {
  if (config === true) {
    return new PrintPlugin();
  }
  return new PrintPlugin(config ?? undefined);
});
