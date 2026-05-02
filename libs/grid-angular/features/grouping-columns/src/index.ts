/**
 * Column grouping feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `groupingColumns` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/grouping-columns';
 *
 * <tbw-grid [groupingColumns]="{ columnGroups: [...] }" />
 * ```
 *
 * @packageDocumentation
 */

import type { Type } from '@angular/core';
import { isComponentClass, registerFeatureConfigPreprocessor, type GridAdapter } from '@toolbox-web/grid-angular';
import '@toolbox-web/grid/features/grouping-columns';
import type { GroupHeaderRenderParams, GroupingColumnsConfig } from '@toolbox-web/grid/plugins/grouping-columns';
export { GridGroupingColumnsDirective } from './grid-grouping-columns.directive';
export type { _Augmentation as _GroupingColumnsAugmentation } from '@toolbox-web/grid/features/grouping-columns';

/**
 * Build a group-header renderer function from an Angular component class.
 * The component should accept group header inputs (id, label, columns, firstIndex, isImplicit).
 */
function buildGroupHeaderRenderer(
  adapter: GridAdapter,
  componentClass: Type<unknown>,
): (params: GroupHeaderRenderParams) => HTMLElement {
  const mount = adapter.mountComponentRenderer<GroupHeaderRenderParams>(componentClass, (p) => ({
    id: p.id,
    label: p.label,
    columns: p.columns,
    firstIndex: p.firstIndex,
    isImplicit: p.isImplicit,
  }));
  return (params) => mount(params).hostElement;
}

// Bridge any Angular component classes embedded in the user-supplied config
// (e.g. group-header renderers) to plain renderer functions before the core
// plugin factory consumes the config. Without this, raw component classes
// would be invoked without `new`, causing runtime errors.
registerFeatureConfigPreprocessor('groupingColumns', (config, adapter) => {
  if (!config || typeof config !== 'object') return config;
  const cfg = config as GroupingColumnsConfig;
  const processed = { ...cfg };
  let changed = false;

  // Bridge top-level groupHeaderRenderer component class
  if (cfg.groupHeaderRenderer && isComponentClass(cfg.groupHeaderRenderer)) {
    processed.groupHeaderRenderer = buildGroupHeaderRenderer(adapter, cfg.groupHeaderRenderer);
    changed = true;
  }

  // Bridge per-group renderer component classes inside columnGroups
  if (Array.isArray(cfg.columnGroups)) {
    let groupChanged = false;
    const mappedGroups = cfg.columnGroups.map((def) => {
      if (def.renderer && isComponentClass(def.renderer)) {
        groupChanged = true;
        return { ...def, renderer: buildGroupHeaderRenderer(adapter, def.renderer) };
      }
      return def;
    });
    if (groupChanged) {
      processed.columnGroups = mappedGroups;
      changed = true;
    }
  }

  return changed ? processed : cfg;
});
