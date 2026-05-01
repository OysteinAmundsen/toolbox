/**
 * Master-detail feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `masterDetail` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/master-detail';
 * import { h } from 'vue';
 * </script>
 *
 * <template>
 *   <TbwGrid :masterDetail="{
 *     renderer: (row) => h(OrderDetails, { order: row }),
 *   }" />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

// Delegate to core feature registration
import '@toolbox-web/grid/features/master-detail';

import type { VNode } from 'vue';
import { detailRegistry, type DetailPanelContext } from '../lib/detail-panel-registry';
import { renderToContainer } from '../lib/teleport-bridge';
import { registerDetailRendererBridge } from '../lib/vue-grid-adapter';

// Install the master-detail row-renderer bridge on the Vue adapter.
// This augments the adapter (mirroring how core plugins augment the grid
// via `registerPlugin`) so master-detail-specific bridging lives with the
// master-detail feature, not in the central adapter file.
registerDetailRendererBridge((gridElement, { trackTeleportKey }) => {
  const detailEl = gridElement.querySelector('tbw-grid-detail') as HTMLElement | null;
  if (!detailEl) return undefined;

  const renderFn = detailRegistry.get(detailEl);
  if (!renderFn) return undefined;

  return (row, rowIndex) => {
    const container = document.createElement('div');
    container.className = 'vue-detail-panel';

    const ctx: DetailPanelContext<typeof row> = { row, rowIndex };
    const vnodes = renderFn(ctx as DetailPanelContext<unknown>);

    if (vnodes && vnodes.length > 0) {
      const teleportKey = renderToContainer(container, vnodes as unknown as VNode);
      trackTeleportKey(teleportKey);
    }

    return container;
  };
});
