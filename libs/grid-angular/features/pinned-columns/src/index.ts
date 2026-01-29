/**
 * Pinned columns feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `pinnedColumns` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/pinned-columns';
 *
 * <tbw-grid [pinnedColumns]="true" [columns]="[
 *   { field: 'id', sticky: 'left' },
 *   { field: 'name' }
 * ]" />
 * ```
 *
 * @packageDocumentation
 */

// eslint-disable-next-line @nx/enforce-module-boundaries -- Intentional: feature files must statically import their plugin
import { PinnedColumnsPlugin } from '@toolbox-web/grid/plugins/pinned-columns';
import { registerFeature } from '@toolbox-web/grid-angular';

registerFeature('pinnedColumns', () => {
  return new PinnedColumnsPlugin();
});
