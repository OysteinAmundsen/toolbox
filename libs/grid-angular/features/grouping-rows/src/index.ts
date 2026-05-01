/**
 * Row grouping feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `groupingRows` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/grouping-rows';
 *
 * <tbw-grid [groupingRows]="{ groupBy: ['department'] }" />
 * ```
 *
 * @packageDocumentation
 */

import { isComponentClass, registerFeatureConfigPreprocessor } from '@toolbox-web/grid-angular/internal';
import '@toolbox-web/grid/features/grouping-rows';
import type { GroupingRowsConfig, GroupRowRenderParams } from '@toolbox-web/grid/plugins/grouping-rows';
export type { _Augmentation as _GroupingRowsAugmentation } from '@toolbox-web/grid/features/grouping-rows';

// Bridge any Angular component classes embedded in the user-supplied config
// (e.g. group-row renderer) to plain renderer functions before the core
// plugin factory consumes the config.
registerFeatureConfigPreprocessor('groupingRows', (config, adapter) => {
  if (!config || typeof config !== 'object') return config;
  const cfg = config as GroupingRowsConfig;
  if (cfg.groupRowRenderer && isComponentClass(cfg.groupRowRenderer)) {
    const mount = adapter.mountComponentRenderer<GroupRowRenderParams>(cfg.groupRowRenderer, (p) => ({
      key: p.key,
      value: p.value,
      depth: p.depth,
      rows: p.rows,
      expanded: p.expanded,
      toggleExpand: p.toggleExpand,
    }));
    return { ...cfg, groupRowRenderer: (params: GroupRowRenderParams) => mount(params).hostElement };
  }
  return cfg;
});
