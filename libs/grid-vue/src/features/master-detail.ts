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

import type { DataGridElement } from '@toolbox-web/grid/all';
import { MasterDetailPlugin, type MasterDetailConfig } from '@toolbox-web/grid/plugins/master-detail';
import type { VNode } from 'vue';
import { detailRegistry, type DetailPanelContext } from '../lib/detail-panel-registry';
import type { MasterDetailConfig as VueMasterDetailConfig } from '../lib/feature-props';
import { registerFeature } from '../lib/feature-registry';
import { removeFromContainer, renderToContainer } from '../lib/teleport-bridge';
import { registerDetailRendererBridge, registerPostMountRefresh } from '../lib/vue-grid-adapter';

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

// Refresh the MasterDetailPlugin's renderer once Vue has rendered the
// `<TbwGridDetailPanel>` child. The plugin is instantiated by feature props
// before Vue commits its children, so it never sees the registered renderer
// without a post-mount kick. Replaces the hard-coded `getPluginByName('masterDetail')`
// call that used to live in `TbwGrid.vue`.
registerPostMountRefresh('masterDetail', ({ gridEl }) => {
  const grid = gridEl as DataGridElement;
  const plugin = grid.getPluginByName('masterDetail') as { refreshDetailRenderer?: () => void } | undefined;
  plugin?.refreshDetailRenderer?.();
});

/**
 * Subclass that releases Vue teleport portals owned by the bridged
 * `detailRenderer` when the plugin detaches.
 */
class MasterDetailPluginWithCleanup extends MasterDetailPlugin {
  #teleportKeys: Set<string>;
  constructor(config: MasterDetailConfig, teleportKeys: Set<string>) {
    super(config);
    this.#teleportKeys = teleportKeys;
  }
  override detach(): void {
    super.detach();
    for (const key of this.#teleportKeys) {
      try {
        removeFromContainer(key);
      } catch {
        // Ignore individual teardown errors so siblings still run.
      }
    }
    this.#teleportKeys.clear();
  }
}

// Override the core feature factory to bridge config-level `detailRenderer`
// returns (`VNode`) to vanilla `HTMLElement | string`. Light-DOM
// `<TbwGridDetailPanel>` continues to win via `parseDetailElement` inside the
// plugin's `parseLightDomDetail`.
registerFeature(
  'masterDetail',
  (rawConfig) => {
    const options = rawConfig == null || typeof rawConfig === 'boolean' ? {} : (rawConfig as VueMasterDetailConfig);
    const userRenderer = options.detailRenderer;
    if (typeof userRenderer !== 'function') {
      return new MasterDetailPlugin(options as MasterDetailConfig);
    }

    const teleportKeys = new Set<string>();
    const bridged: MasterDetailConfig['detailRenderer'] = (row, rowIndex) => {
      const result = (
        userRenderer as (r: Record<string, unknown>, i: number) => VNode | HTMLElement | string | null | undefined
      )(row, rowIndex);
      if (result == null) return document.createElement('div');
      if (typeof result === 'string') return result;
      if (result instanceof HTMLElement) return result;
      const host = document.createElement('div');
      host.className = 'vue-detail-panel';
      const key = renderToContainer(host, result as VNode);
      teleportKeys.add(key);
      return host;
    };

    return new MasterDetailPluginWithCleanup(
      { ...(options as MasterDetailConfig), detailRenderer: bridged },
      teleportKeys,
    );
  },
  { override: true },
);
