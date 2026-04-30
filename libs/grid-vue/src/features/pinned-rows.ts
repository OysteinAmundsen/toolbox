/**
 * Pinned rows feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `pinnedRows` prop on TbwGrid.
 * Automatically bridges Vue render-function `customPanels[].render` and the
 * new `slots[]` panel renderers (issue #255) to vanilla DOM via the teleport bridge.
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
 * @example Custom panel with Vue render function (legacy customPanels)
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
 * @example Slots API with Vue renderers
 * ```vue
 * <TbwGrid :pinnedRows="{
 *   slots: [
 *     { position: 'top', render: (ctx) => h('strong', `${ctx.totalRows} rows`) },
 *     { position: 'top', aggregators: { price: 'sum' }, label: 'Total' },
 *     { position: 'bottom', render: [
 *       { zone: 'left',  render: (ctx) => h('span', `${ctx.filteredRows} shown`) },
 *       { zone: 'right', render: (ctx) => ctx.selectedRows ? h('em', `${ctx.selectedRows} selected`) : null },
 *     ]},
 *   ],
 * }" />
 * ```
 *
 * @packageDocumentation
 */

import '@toolbox-web/grid/features/pinned-rows';

import {
  PinnedRowsPlugin,
  type PinnedRowSlot,
  type PinnedRowsConfig,
  type PinnedRowsContext,
  type ZonedPanelRender,
} from '@toolbox-web/grid/plugins/pinned-rows';
import type { VNode } from 'vue';
import { registerFeature } from '../lib/feature-registry';
import { renderToContainer } from '../lib/teleport-bridge';

/**
 * Wrap a Vue-returning render function in a vanilla `() => HTMLElement | null`.
 * `null` / `undefined` from the Vue function passes through so built-in
 * conditional panels (e.g. selectedCountPanel) can opt out.
 */
function bridgeVueRender(
  vueFn: (ctx: PinnedRowsContext) => VNode | null | undefined,
): (ctx: PinnedRowsContext) => HTMLElement | null {
  return (ctx) => {
    const vnode = vueFn(ctx);
    if (vnode == null) return null;
    const wrapper = document.createElement('div');
    wrapper.style.display = 'contents';
    renderToContainer(wrapper, vnode);
    return wrapper;
  };
}

/** Bridge a single slot. Aggregation slots pass through unchanged. */
function bridgeSlot(slot: PinnedRowSlot): PinnedRowSlot {
  if (!('render' in slot) || slot.render == null) return slot;

  if (Array.isArray(slot.render)) {
    const zoned: ZonedPanelRender[] = slot.render.map((entry) => {
      if (typeof entry?.render !== 'function') return entry;
      return {
        zone: entry.zone,
        render: bridgeVueRender(entry.render as unknown as (ctx: PinnedRowsContext) => VNode | null | undefined),
      };
    });
    return { ...slot, render: zoned };
  }

  if (typeof slot.render === 'function') {
    return {
      ...slot,
      render: bridgeVueRender(slot.render as unknown as (ctx: PinnedRowsContext) => VNode | null | undefined),
    };
  }

  return slot;
}

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

  // Bridge slots[] panel renders (issue #255).
  if (Array.isArray(config.slots)) {
    options.slots = config.slots.map(bridgeSlot);
  }

  return new PinnedRowsPlugin(options);
});
