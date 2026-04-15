/**
 * Pinned rows feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `pinnedRows` prop on TbwGrid.
 * Automatically bridges Vue render-function `customPanels[].render` to vanilla DOM.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/pinned-rows';
 * </script>
 *
 * <template>
 *   <TbwGrid :pinnedRows="{
 *     bottom: [{ type: 'aggregation', aggregator: 'sum' }],
 *   }" />
 * </template>
 * ```
 *
 * @example Custom panel with Vue render function
 * ```vue
 * <TbwGrid :pinnedRows="{
 *   customPanels: [{
 *     id: 'stats',
 *     position: 'center',
 *     render: (ctx) => h('span', `Total: ${ctx.totalRows}`),
 *   }],
 * }" />
 * ```
 *
 * @packageDocumentation
 */

import '@toolbox-web/grid/features/pinned-rows';

import { PinnedRowsPlugin, type PinnedRowsConfig, type PinnedRowsContext } from '@toolbox-web/grid/plugins/pinned-rows';
import type { VNode } from 'vue';
import { registerFeature } from '../lib/feature-registry';
import { renderToContainer } from '../lib/teleport-bridge';

registerFeature('pinnedRows', (rawConfig) => {
  if (rawConfig === true) {
    return new PinnedRowsPlugin();
  }
  if (!rawConfig) {
    return new PinnedRowsPlugin();
  }

  const config = rawConfig as PinnedRowsConfig & { customPanels?: unknown[] };
  const options = { ...config } as PinnedRowsConfig;

  // Bridge Vue customPanels[].render (returns VNode) to vanilla (returns HTMLElement | string)
  if (Array.isArray(config.customPanels)) {
    options.customPanels = config.customPanels.map((panel: any) => {
      if (typeof panel.render !== 'function') return panel;
      const vueFn = panel.render as unknown as (ctx: PinnedRowsContext) => VNode;
      return {
        ...panel,
        render: (ctx: PinnedRowsContext) => {
          const wrapper = document.createElement('div');
          wrapper.style.display = 'contents';
          renderToContainer(wrapper, vueFn(ctx));
          return wrapper;
        },
      };
    });
  }

  return new PinnedRowsPlugin(options);
});
