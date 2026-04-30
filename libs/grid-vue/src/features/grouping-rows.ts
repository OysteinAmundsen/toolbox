/**
 * Row grouping feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `groupingRows` prop on TbwGrid.
 * Automatically bridges Vue render-function `groupRowRenderer` to vanilla DOM.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/grouping-rows';
 * </script>
 *
 * <template>
 *   <TbwGrid :groupingRows="{
 *     groupBy: ['department', 'team'],
 *     defaultExpanded: true,
 *   }" />
 * </template>
 * ```
 *
 * @example Custom group row renderer
 * ```vue
 * <TbwGrid :groupingRows="{
 *   groupBy: ['department'],
 *   groupRowRenderer: (params) => h('strong', `${params.key}: ${params.value} (${params.rows.length})`),
 * }" />
 * ```
 *
 * @packageDocumentation
 */

import {
    GroupingRowsPlugin,
    type GroupingRowsConfig,
    type GroupRowRenderParams,
} from '@toolbox-web/grid/plugins/grouping-rows';
import type { VNode } from 'vue';
import { registerFeature } from '../lib/feature-registry';
import { createNodeBridge } from '../lib/teleport-bridge';

registerFeature('groupingRows', (rawConfig) => {
  if (rawConfig === true) {
    return new GroupingRowsPlugin();
  }
  if (!rawConfig) {
    return new GroupingRowsPlugin();
  }

  const config = rawConfig as GroupingRowsConfig & { groupRowRenderer?: unknown };
  const options = { ...config } as GroupingRowsConfig;

  // Bridge Vue groupRowRenderer (returns VNode) to vanilla (returns HTMLElement | string | void)
  if (typeof config.groupRowRenderer === 'function') {
    const vueFn = config.groupRowRenderer as unknown as (params: GroupRowRenderParams) => VNode;
    const bridged = createNodeBridge<GroupRowRenderParams>(vueFn);
    // Group rows always need an element; coerce null → empty wrapper.
    options.groupRowRenderer = (params) => bridged(params) ?? document.createElement('div');
  }

  return new GroupingRowsPlugin(options);
});
