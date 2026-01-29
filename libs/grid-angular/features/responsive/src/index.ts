/**
 * Responsive feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `responsive` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/responsive';
 *
 * <tbw-grid [responsive]="{ breakpoint: 768 }" />
 * ```
 *
 * @packageDocumentation
 */

// eslint-disable-next-line @nx/enforce-module-boundaries -- Intentional: feature files must statically import their plugin
import { ResponsivePlugin } from '@toolbox-web/grid/plugins/responsive';
import { registerFeature } from '@toolbox-web/grid-angular';

registerFeature('responsive', (config) => {
  if (config === true) {
    return new ResponsivePlugin({ breakpoint: 768 });
  }
  return new ResponsivePlugin(config ?? undefined);
});
