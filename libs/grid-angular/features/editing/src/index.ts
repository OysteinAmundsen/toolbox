/**
 * Editing feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `editing` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/editing';
 *
 * <tbw-grid [editing]="'dblclick'" />
 * ```
 *
 * @packageDocumentation
 */

// eslint-disable-next-line @nx/enforce-module-boundaries -- Intentional: feature files must statically import their plugin
import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';
import { registerFeature } from '@toolbox-web/grid-angular';

registerFeature('editing', (config) => {
  // Handle shorthand: true, 'click', 'dblclick', 'manual'
  if (config === true) {
    return new EditingPlugin({ editOn: 'dblclick' });
  }
  if (config === 'click' || config === 'dblclick' || config === 'manual') {
    return new EditingPlugin({ editOn: config });
  }
  // Full config object
  return new EditingPlugin(config ?? undefined);
});
