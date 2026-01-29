/**
 * Export feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `exportFeature` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/export';
 *
 * <tbw-grid [exportFeature]="true" />
 * <tbw-grid [exportFeature]="{ filename: 'data.csv' }" />
 * ```
 *
 * @packageDocumentation
 */

// eslint-disable-next-line @nx/enforce-module-boundaries -- Intentional: feature files must statically import their plugin
import { ExportPlugin } from '@toolbox-web/grid/plugins/export';
import { registerFeature } from '@toolbox-web/grid-angular';

registerFeature('export', (config) => {
  if (config === true) {
    return new ExportPlugin();
  }
  return new ExportPlugin(config ?? undefined);
});
