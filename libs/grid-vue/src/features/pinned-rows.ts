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
  type AggregationSlot,
  type PanelZone,
  type PinnedRowSlot,
  type PinnedRowsConfig,
  type PinnedRowsContext,
  type ZonedPanelRender,
} from '@toolbox-web/grid/plugins/pinned-rows';
import type { VNode } from 'vue';
import { registerFeature } from '../lib/feature-registry';
import { renderToContainer } from '../lib/teleport-bridge';

/** Vue-typed render function for a pinned-row panel slot. */
type VuePanelRender = (ctx: PinnedRowsContext) => VNode | null | undefined;
/** Vue-typed zoned render entry. */
interface VueZonedPanelRender {
  zone?: PanelZone;
  render: VuePanelRender;
}
/** Vue-typed panel slot — same shape as vanilla PanelSlot but with VNode render returns. */
interface VuePanelSlot {
  id?: string;
  position?: 'top' | 'bottom';
  render: VuePanelRender | VueZonedPanelRender[];
}
/** Vue-typed slot — either a panel slot or an aggregation slot. */
type VuePinnedRowSlot = VuePanelSlot | AggregationSlot;

/**
 * Wrap a Vue-returning render function in a vanilla `() => HTMLElement | null`.
 * `null` / `undefined` from the Vue function passes through so built-in
 * conditional panels (e.g. selectedCountPanel) can opt out.
 */
function bridgeVueRender(vueFn: VuePanelRender): (ctx: PinnedRowsContext) => HTMLElement | null {
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
function bridgeSlot(slot: VuePinnedRowSlot): PinnedRowSlot {
  if (!('render' in slot) || slot.render == null) return slot;

  if (Array.isArray(slot.render)) {
    const zoned: ZonedPanelRender[] = slot.render.map((entry) => {
      if (typeof entry?.render !== 'function') return entry as ZonedPanelRender;
      return { zone: entry.zone, render: bridgeVueRender(entry.render) };
    });
    return { ...slot, render: zoned };
  }

  if (typeof slot.render === 'function') {
    return { ...slot, render: bridgeVueRender(slot.render) };
  }

  return slot as PinnedRowSlot;
}

/** Per-feature shape of `pinnedRows` accepted by the Vue adapter. */
type VuePinnedRowsConfig = Omit<PinnedRowsConfig, 'slots' | 'customPanels'> & {
  slots?: VuePinnedRowSlot[];
  customPanels?: Array<{
    id: string;
    position: PanelZone;
    render: (ctx: PinnedRowsContext) => VNode;
  }>;
};

registerFeature('pinnedRows', (rawConfig) => {
  if (rawConfig === true) {
    return new PinnedRowsPlugin();
  }
  if (!rawConfig) {
    return new PinnedRowsPlugin();
  }

  // Single boundary cast: rawConfig is `unknown`-ish; we accept the Vue-typed shape.
  const config = rawConfig as VuePinnedRowsConfig;
  const { slots: vueSlots, customPanels: vueCustomPanels, ...sharedBase } = config;
  const options: PinnedRowsConfig = { ...sharedBase };

  // Bridge Vue customPanels[].render (returns VNode) to vanilla.
  if (Array.isArray(vueCustomPanels)) {
    options.customPanels = vueCustomPanels.map((panel) => {
      if (typeof panel.render !== 'function') return panel as never;
      const vueFn = panel.render;
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
  if (Array.isArray(vueSlots)) {
    options.slots = vueSlots.map(bridgeSlot);
  }

  return new PinnedRowsPlugin(options);
});
