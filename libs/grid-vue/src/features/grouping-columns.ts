/**
 * Column grouping feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `groupingColumns` prop on TbwGrid.
 * Automatically bridges Vue render-function `groupHeaderRenderer` to vanilla DOM.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/grouping-columns';
 * </script>
 *
 * <template>
 *   <TbwGrid :groupingColumns="{
 *     columnGroups: [
 *       { header: 'Personal Info', children: ['firstName', 'lastName'] },
 *     ],
 *   }" />
 * </template>
 * ```
 *
 * @example Custom group header renderer
 * ```vue
 * <TbwGrid :groupingColumns="{
 *   columnGroups: [...],
 *   groupHeaderRenderer: (params) => h('strong', `${params.label} (${params.columns.length})`),
 * }" />
 * ```
 *
 * @packageDocumentation
 */

import {
  GroupingColumnsPlugin,
  type ColumnGroupDefinition,
  type GroupHeaderRenderParams,
  type GroupingColumnsConfig,
} from '@toolbox-web/grid/plugins/grouping-columns';
import type { VNode } from 'vue';
import { registerFeature } from '../lib/feature-registry';
import { createNodeBridge } from '../lib/teleport-bridge';

/** Bridge a Vue render function to a vanilla DOM render function. */
function bridgeRenderer(
  vueFn: (params: GroupHeaderRenderParams) => VNode,
): (params: GroupHeaderRenderParams) => HTMLElement {
  const bridged = createNodeBridge<GroupHeaderRenderParams>(vueFn);
  // Group headers always need an element; coerce null → empty wrapper.
  return (params) => bridged(params) ?? document.createElement('div');
}

registerFeature('groupingColumns', (rawConfig) => {
  if (rawConfig === true) {
    return new GroupingColumnsPlugin();
  }
  if (!rawConfig) {
    return new GroupingColumnsPlugin();
  }

  const config = rawConfig as GroupingColumnsConfig & {
    groupHeaderRenderer?: unknown;
    columnGroups?: (ColumnGroupDefinition & { renderer?: unknown })[];
  };
  const options = { ...config } as GroupingColumnsConfig;

  // Bridge Vue groupHeaderRenderer (returns VNode) to vanilla (returns HTMLElement | string | void)
  if (typeof config.groupHeaderRenderer === 'function') {
    const vueFn = config.groupHeaderRenderer as unknown as (params: GroupHeaderRenderParams) => VNode;
    options.groupHeaderRenderer = bridgeRenderer(vueFn);
  }

  // Bridge per-group renderers inside columnGroups
  if (Array.isArray(config.columnGroups)) {
    options.columnGroups = config.columnGroups.map((def) => {
      if (typeof def.renderer !== 'function') return def as ColumnGroupDefinition;
      const vueFn = def.renderer as unknown as (params: GroupHeaderRenderParams) => VNode;
      return { ...def, renderer: bridgeRenderer(vueFn) } as ColumnGroupDefinition;
    });
  }

  return new GroupingColumnsPlugin(options);
});
