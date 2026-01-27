/**
 * Selection feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `selection` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/selection';
 *
 * <tbw-grid [selection]="'range'" />
 * ```
 *
 * @packageDocumentation
 */

// eslint-disable-next-line @nx/enforce-module-boundaries -- Intentional: feature files must statically import their plugin
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
import { registerFeature } from '../lib/feature-registry';

registerFeature('selection', (config) => {
  // Handle shorthand: 'cell', 'row', 'range'
  if (config === 'cell' || config === 'row' || config === 'range') {
    return new SelectionPlugin({ mode: config });
  }
  // Full config object
  return new SelectionPlugin(config ?? undefined);
});
