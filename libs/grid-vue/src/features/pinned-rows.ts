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
 * import { rowCountPanel } from '@toolbox-web/grid/plugins/pinned-rows';
 * </script>
 *
 * <template>
 *   <TbwGrid :pinnedRows="{
 *     slots: [
 *       { id: 'count', position: 'bottom', render: rowCountPanel() },
 *     ],
 *   }" />
 * </template>
 * ```
 *
 * @example Custom panel with Vue render function (legacy `customPanels` — deprecated)
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
import {
  type VuePanelRender,
  type VuePanelSlot,
  type VuePinnedRowSlot,
  type VuePinnedRowsConfig,
  type VueZonedPanelRender,
} from '../lib/feature-props';
import { registerFeature } from '../lib/feature-registry';
import { removeFromContainer, renderToContainer } from '../lib/teleport-bridge';

// Re-export Vue-typed pinned-rows types for back-compat. The canonical home is
// `../lib/feature-props.ts` so all Vue*Config types live in one place (see
// React adapter for the same pattern).
export type { VuePanelRender, VuePanelSlot, VuePinnedRowSlot, VuePinnedRowsConfig, VueZonedPanelRender };

/**
 * Cache entry for a single Vue-typed renderer. Reused across grid re-renders
 * so the host element reference is stable — the pinned-rows plugin
 * (`renderPanelSlot`) reference-checks renderer outputs to skip DOM mutation
 * when nothing changed, and the teleport portal updates in place.
 */
interface VueRenderCache {
  host: HTMLDivElement;
  portalKey: string | null;
}

/**
 * Wrap a Vue render function to cache its host element across calls.
 * - First call: creates a `<div style="display:contents">` host, mounts the
 *   VNode into it, returns the host.
 * - Subsequent calls: re-renders into the same portal key and returns the same
 *   host element so the plugin can short-circuit row DOM rebuilds (and avoid
 *   Vue app unmount/remount loops).
 * - Returns `null` when the Vue function returns `null`/`undefined` so
 *   built-in conditional panels can opt out without tearing down state.
 *
 * `registerTeardown` is invoked once per bridge so the registered cleanup
 * function fires when the plugin detaches (grid disconnect or config replace).
 */
function createCachedVueRender(
  vueFn: VuePanelRender,
  registerTeardown: (fn: () => void) => void,
): (ctx: PinnedRowsContext) => HTMLElement | null {
  let cache: VueRenderCache | null = null;
  let registered = false;
  return (ctx) => {
    const node = vueFn(ctx);
    if (node == null) return null;
    // Pass through: vanilla renderers (e.g. `rowCountPanel()`) return real DOM
    // nodes, not VNodes — hand them back as-is rather than mounting via Vue.
    if (node instanceof HTMLElement) return node;
    if (!cache) {
      const host = document.createElement('div');
      host.style.display = 'contents';
      cache = { host, portalKey: null };
    }
    cache.portalKey = renderToContainer(cache.host, node, cache.portalKey ?? undefined);
    if (!registered) {
      registered = true;
      registerTeardown(() => {
        if (cache?.portalKey) removeFromContainer(cache.portalKey);
        cache = null;
      });
    }
    return cache.host;
  };
}

/** Bridge a single slot. Aggregation slots pass through unchanged. */
function bridgeSlot(slot: VuePinnedRowSlot, registerTeardown: (fn: () => void) => void): PinnedRowSlot {
  if (!('render' in slot) || slot.render == null) return slot;

  if (Array.isArray(slot.render)) {
    const zoned: ZonedPanelRender[] = slot.render.map((entry) => {
      if (typeof entry?.render !== 'function') return entry as ZonedPanelRender;
      return { zone: entry.zone, render: createCachedVueRender(entry.render, registerTeardown) };
    });
    return { ...slot, render: zoned };
  }

  if (typeof slot.render === 'function') {
    return { ...slot, render: createCachedVueRender(slot.render, registerTeardown) };
  }

  return slot as PinnedRowSlot;
}

/**
 * Subclass that runs registered teardown callbacks when the plugin is detached.
 * Used to release Vue teleport portals owned by slot/customPanel bridges.
 */
class PinnedRowsPluginWithCleanup extends PinnedRowsPlugin {
  #teardowns: Array<() => void>;
  constructor(config: PinnedRowsConfig | undefined, teardowns: Array<() => void>) {
    super(config);
    this.#teardowns = teardowns;
  }
  override detach(): void {
    super.detach();
    for (const fn of this.#teardowns) {
      try {
        fn();
      } catch {
        // Ignore individual teardown errors so siblings still run.
      }
    }
    this.#teardowns.length = 0;
  }
}

registerFeature(
  'pinnedRows',
  (rawConfig) => {
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

    const teardowns: Array<() => void> = [];
    const registerTeardown = (fn: () => void): void => {
      teardowns.push(fn);
    };

    // Bridge Vue customPanels[].render (returns VNode) to vanilla.
    if (Array.isArray(vueCustomPanels)) {
      options.customPanels = vueCustomPanels.map((panel) => {
        if (typeof panel.render !== 'function') return panel as never;
        const bridged = createCachedVueRender(panel.render, registerTeardown);
        return {
          ...panel,
          // customPanels expect HTMLElement (not nullable); coerce null → empty wrapper.
          render: (ctx: PinnedRowsContext) => bridged(ctx) ?? document.createElement('div'),
        };
      });
    }

    // Bridge slots[] panel renders (issue #255 + #354).
    if (Array.isArray(vueSlots)) {
      options.slots = vueSlots.map((slot) => bridgeSlot(slot, registerTeardown));
    }

    return new PinnedRowsPluginWithCleanup(options, teardowns);
  },
  { override: true },
);
