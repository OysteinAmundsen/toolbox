/**
 * Tooltip feature for @toolbox-web/grid
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/tooltip';
 *
 * grid.gridConfig = { features: { tooltip: true } };
 * ```
 */

import { TooltipPlugin, type TooltipConfig } from '../plugins/tooltip';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /** Enable automatic overflow tooltips on headers and cells. */
    tooltip?: boolean | TooltipConfig;
  }
}

registerFeature('tooltip', (config) => {
  if (config === true) return new TooltipPlugin();
  return new TooltipPlugin((config as TooltipConfig) ?? undefined);
});
