/**
 * Column virtualization feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `columnVirtualization` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/column-virtualization';
 *
 * <tbw-grid [columnVirtualization]="true" />
 * ```
 *
 * @packageDocumentation
 */

// eslint-disable-next-line @nx/enforce-module-boundaries -- Intentional: feature files must statically import their plugin
import { ColumnVirtualizationPlugin } from '@toolbox-web/grid/plugins/column-virtualization';
import { registerFeature } from '../lib/feature-registry';

registerFeature('columnVirtualization', (config) => {
  if (config === true) {
    return new ColumnVirtualizationPlugin();
  }
  return new ColumnVirtualizationPlugin(config ?? undefined);
});
