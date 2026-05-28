/**
 * Pinned Rows feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `pinnedRows` prop on DataGrid.
 * Automatically bridges React JSX `customPanels[].render` and `slots[]` panel
 * renderers to vanilla DOM via the portal bridge.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/pinned-rows';
 * import { rowCountPanel } from '@toolbox-web/grid/plugins/pinned-rows';
 *
 * <DataGrid pinnedRows={{
 *   slots: [
 *     { id: 'count', position: 'bottom', render: rowCountPanel() },
 *   ],
 * }} />
 * ```
 *
 * @example Custom panel with React component (legacy `customPanels` — deprecated)
 * ```tsx
 * <DataGrid pinnedRows={{
 *   customPanels: [{
 *     id: 'stats',
 *     position: 'center',
 *     render: (ctx) => <span>Total: {ctx.totalRows}</span>,
 *   }],
 * }} />
 * ```
 *
 * @example Slots API (issue #255) with React renderers
 * ```tsx
 * <DataGrid pinnedRows={{
 *   slots: [
 *     { position: 'top', render: (ctx) => <strong>{ctx.totalRows} rows</strong> },
 *     { position: 'top', aggregators: { price: 'sum' }, label: 'Total' },
 *     { position: 'bottom', render: [
 *       { zone: 'left',  render: (ctx) => <span>{ctx.filteredRows} shown</span> },
 *       { zone: 'right', render: (ctx) => ctx.selectedRows ? <em>{ctx.selectedRows} selected</em> : null },
 *     ]},
 *   ],
 * }} />
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
import type { ReactPanelRender, ReactPinnedRowSlot, ReactPinnedRowsConfig } from '../lib/feature-props';
import { registerFeature } from '../lib/feature-registry';
import { removeFromContainer, renderToContainer } from '../lib/portal-bridge';

// Re-export React-typed config shapes from their single source of truth in
// `feature-props.ts`, so consumers can keep importing them from this module.
export type {
  ReactPanelRender,
  ReactPanelSlot,
  ReactPinnedRowSlot,
  ReactPinnedRowsConfig,
  ReactZonedPanelRender,
} from '../lib/feature-props';

/**
 * Cache entry for a single React-typed renderer. Reused across grid re-renders
 * so the host element reference is stable — the pinned-rows plugin
 * (`renderPanelSlot`) reference-checks renderer outputs to skip DOM mutation
 * when nothing changed, and React updates the existing portal in place.
 */
interface ReactRenderCache {
  host: HTMLDivElement;
  portalKey: string | null;
}

/**
 * Wrap a React render function to cache its host element across calls.
 * - First call: creates a `<div style="display:contents">` host, mounts the
 *   React node into it, returns the host.
 * - Subsequent calls: re-renders into the same portal key (React reconciles)
 *   and returns the same host element so the plugin can short-circuit row
 *   DOM rebuilds (and avoid React unmount/remount loops).
 * - Returns `null` when React produces `null`/`undefined`/`false` so built-in
 *   conditional panels can opt out without tearing down state.
 *
 * `registerTeardown` is invoked once per bridge so the registered cleanup
 * function fires when the plugin detaches (grid disconnect or config replace).
 */
function createCachedReactRender(
  reactFn: ReactPanelRender,
  registerTeardown: (fn: () => void) => void,
): (ctx: PinnedRowsContext) => HTMLElement | null {
  let cache: ReactRenderCache | null = null;
  let registered = false;
  return (ctx) => {
    const node = reactFn(ctx);
    if (node == null || node === false) return null;
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
        if (cache?.portalKey) removeFromContainer(cache.portalKey, { sync: false });
        cache = null;
      });
    }
    return cache.host;
  };
}

/**
 * Bridge a single slot. Aggregation slots (no `render`) pass through unchanged.
 * Panel slots with a function `render` get wrapped; panel slots with an array
 * of `ReactZonedPanelRender` get each entry's `render` wrapped individually.
 */
function bridgeSlot(slot: ReactPinnedRowSlot, registerTeardown: (fn: () => void) => void): PinnedRowSlot {
  if (!('render' in slot) || slot.render == null) return slot;

  if (Array.isArray(slot.render)) {
    const zoned: ZonedPanelRender[] = slot.render.map((entry) => {
      if (typeof entry?.render !== 'function') return entry as ZonedPanelRender;
      return { zone: entry.zone, render: createCachedReactRender(entry.render, registerTeardown) };
    });
    return { ...slot, render: zoned };
  }

  if (typeof slot.render === 'function') {
    return { ...slot, render: createCachedReactRender(slot.render, registerTeardown) };
  }

  return slot as PinnedRowSlot;
}

/**
 * Subclass that runs registered teardown callbacks when the plugin is detached
 * from the grid. Used to release React portals owned by slot/customPanel bridges.
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
    if (typeof rawConfig === 'boolean') return new PinnedRowsPlugin();
    if (!rawConfig) return new PinnedRowsPlugin();

    // Single boundary cast: rawConfig is `unknown`-ish; we accept the React-typed shape.
    const config = rawConfig as ReactPinnedRowsConfig;
    // Strip the framework-typed fields so the spread base only has shared (vanilla-compatible) fields.
    const { slots: reactSlots, customPanels: reactCustomPanels, ...sharedBase } = config;
    const options: PinnedRowsConfig = { ...sharedBase };

    const teardowns: Array<() => void> = [];
    const registerTeardown = (fn: () => void): void => {
      teardowns.push(fn);
    };

    // Bridge React customPanels[].render (returns ReactNode) to vanilla.
    if (Array.isArray(reactCustomPanels)) {
      options.customPanels = reactCustomPanels.map((panel) => {
        if (typeof panel.render !== 'function') return panel as never;
        const bridged = createCachedReactRender(panel.render, registerTeardown);
        return {
          ...panel,
          // customPanels expect HTMLElement (not nullable); coerce null → empty wrapper.
          render: (ctx: PinnedRowsContext) => bridged(ctx) ?? document.createElement('div'),
        };
      });
    }

    // Bridge slots[] panel renders (issue #255 + #354).
    if (Array.isArray(reactSlots)) {
      options.slots = reactSlots.map((slot) => bridgeSlot(slot, registerTeardown));
    }

    return new PinnedRowsPluginWithCleanup(options, teardowns);
  },
  { override: true },
);
