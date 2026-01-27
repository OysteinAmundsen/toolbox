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

import { ExportPlugin } from '@toolbox-web/grid/plugins/export';
import { registerFeature } from '../lib/feature-registry';

registerFeature('export', (config) => {
  if (config === true) {
    return new ExportPlugin();
  }
  return new ExportPlugin(config ?? undefined);
});
