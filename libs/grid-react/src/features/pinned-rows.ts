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
 *
 * <DataGrid pinnedRows={{ position: 'bottom', showRowCount: true }} />
 * ```
 *
 * @example Custom panel with React component (legacy customPanels)
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
import type { ReactElement, ReactNode } from 'react';
import { registerFeature } from '../lib/feature-registry';
import { renderToContainer } from '../lib/portal-bridge';

/**
 * Wrap a React-returning render function in a vanilla `() => HTMLElement | null`.
 * `null` / `undefined` from the React function passes through so built-in
 * conditional panels (e.g. selectedCountPanel) can opt out.
 */
function bridgeReactRender(
  reactFn: (ctx: PinnedRowsContext) => ReactNode,
): (ctx: PinnedRowsContext) => HTMLElement | null {
  return (ctx) => {
    const node = reactFn(ctx);
    if (node == null || node === false) return null;
    const wrapper = document.createElement('div');
    wrapper.style.display = 'contents';
    renderToContainer(wrapper, node as ReactElement);
    return wrapper;
  };
}

/**
 * Bridge a single slot. Aggregation slots (no `render`) pass through unchanged.
 * Panel slots with a function `render` get wrapped; panel slots with an array
 * of `ZonedPanelRender` get each entry's `render` wrapped individually.
 */
function bridgeSlot(slot: PinnedRowSlot): PinnedRowSlot {
  if (!('render' in slot) || slot.render == null) return slot;

  if (Array.isArray(slot.render)) {
    const zoned: ZonedPanelRender[] = slot.render.map((entry) => {
      if (typeof entry?.render !== 'function') return entry;
      return {
        zone: entry.zone,
        render: bridgeReactRender(entry.render as unknown as (ctx: PinnedRowsContext) => ReactNode),
      };
    });
    return { ...slot, render: zoned };
  }

  if (typeof slot.render === 'function') {
    return {
      ...slot,
      render: bridgeReactRender(slot.render as unknown as (ctx: PinnedRowsContext) => ReactNode),
    };
  }

  return slot;
}

registerFeature('pinnedRows', (rawConfig) => {
  if (typeof rawConfig === 'boolean') return new PinnedRowsPlugin();
  if (!rawConfig) return new PinnedRowsPlugin();

  const config = rawConfig as PinnedRowsConfig & { customPanels?: unknown[] };
  const options = { ...config } as PinnedRowsConfig;

  // Bridge React customPanels[].render (returns ReactNode) to vanilla (returns HTMLElement | string)
  if (Array.isArray(config.customPanels)) {
    options.customPanels = config.customPanels.map((panel: any) => {
      if (typeof panel.render !== 'function') return panel;
      const reactFn = panel.render as unknown as (ctx: PinnedRowsContext) => ReactNode;
      // Track portal key per wrapper so prune mechanism can clean up disconnected ones
      const wrapperKeys = new WeakMap<HTMLElement, string>();
      return {
        ...panel,
        render: (ctx: PinnedRowsContext) => {
          const wrapper = document.createElement('div');
          wrapper.style.display = 'contents';
          const key = renderToContainer(wrapper, reactFn(ctx) as ReactElement);
          wrapperKeys.set(wrapper, key);
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
