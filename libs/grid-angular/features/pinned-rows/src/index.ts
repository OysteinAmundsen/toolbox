/**
 * Pinned rows feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `pinnedRows` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/pinned-rows';
 *
 * <tbw-grid [pinnedRows]="{ bottom: [{ type: 'aggregation' }] }" />
 * ```
 *
 * @packageDocumentation
 */

import { registerFeatureConfigPreprocessor } from '@toolbox-web/grid-angular';
import '@toolbox-web/grid/features/pinned-rows';
import type { PinnedRowsConfig } from '@toolbox-web/grid/plugins/pinned-rows';
export type { _Augmentation as _PinnedRowsAugmentation } from '@toolbox-web/grid/features/pinned-rows';

// Bridge any Angular component classes embedded in `customPanels` (and any
// other component-shaped fields) to plain renderer functions before the core
// plugin factory consumes the config.
registerFeatureConfigPreprocessor('pinnedRows', (config, adapter) => {
  if (!config || typeof config !== 'object') return config;
  return adapter.processPinnedRowsConfig(config as PinnedRowsConfig);
});
