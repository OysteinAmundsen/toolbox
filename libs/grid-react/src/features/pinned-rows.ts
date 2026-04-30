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
  type AggregationSlot,
  type PanelZone,
  type PinnedRowSlot,
  type PinnedRowsConfig,
  type PinnedRowsContext,
  type ZonedPanelRender,
} from '@toolbox-web/grid/plugins/pinned-rows';
import type { ReactNode } from 'react';
import { registerFeature } from '../lib/feature-registry';
import { createNodeBridge } from '../lib/portal-bridge';

/** React-typed render function for a pinned-row panel slot. */
type ReactPanelRender = (ctx: PinnedRowsContext) => ReactNode;
/** React-typed zoned render entry. */
interface ReactZonedPanelRender {
  zone?: PanelZone;
  render: ReactPanelRender;
}
/** React-typed panel slot — same shape as vanilla PanelSlot but with ReactNode render returns. */
interface ReactPanelSlot {
  id?: string;
  position?: 'top' | 'bottom';
  render: ReactPanelRender | ReactZonedPanelRender[];
}
/** React-typed slot — either a panel slot or an aggregation slot. */
type ReactPinnedRowSlot = ReactPanelSlot | AggregationSlot;

/**
 * Wrap a React-returning render function in a vanilla `() => HTMLElement | null`.
 * `null` / `undefined` / `false` from the React function passes through so
 * built-in conditional panels (e.g. selectedCountPanel) can opt out.
 * Thin alias around the shared `createNodeBridge` helper.
 */
function bridgeReactRender(reactFn: ReactPanelRender): (ctx: PinnedRowsContext) => HTMLElement | null {
  return createNodeBridge<PinnedRowsContext>(reactFn);
}

/**
 * Bridge a single slot. Aggregation slots (no `render`) pass through unchanged.
 * Panel slots with a function `render` get wrapped; panel slots with an array
 * of `ReactZonedPanelRender` get each entry's `render` wrapped individually.
 */
function bridgeSlot(slot: ReactPinnedRowSlot): PinnedRowSlot {
  if (!('render' in slot) || slot.render == null) return slot;

  if (Array.isArray(slot.render)) {
    const zoned: ZonedPanelRender[] = slot.render.map((entry) => {
      if (typeof entry?.render !== 'function') return entry as ZonedPanelRender;
      return { zone: entry.zone, render: bridgeReactRender(entry.render) };
    });
    return { ...slot, render: zoned };
  }

  if (typeof slot.render === 'function') {
    return { ...slot, render: bridgeReactRender(slot.render) };
  }

  return slot as PinnedRowSlot;
}

/** Per-feature shape of `pinnedRows` accepted by the React adapter. */
type ReactPinnedRowsConfig = Omit<PinnedRowsConfig, 'slots' | 'customPanels'> & {
  slots?: ReactPinnedRowSlot[];
  customPanels?: Array<{
    id: string;
    position: PanelZone;
    render: (ctx: PinnedRowsContext) => ReactNode;
  }>;
};

registerFeature('pinnedRows', (rawConfig) => {
  if (typeof rawConfig === 'boolean') return new PinnedRowsPlugin();
  if (!rawConfig) return new PinnedRowsPlugin();

  // Single boundary cast: rawConfig is `unknown`-ish; we accept the React-typed shape.
  const config = rawConfig as ReactPinnedRowsConfig;
  // Strip the framework-typed fields so the spread base only has shared (vanilla-compatible) fields.
  const { slots: reactSlots, customPanels: reactCustomPanels, ...sharedBase } = config;
  const options: PinnedRowsConfig = { ...sharedBase };

  // Bridge React customPanels[].render (returns ReactNode) to vanilla.
  if (Array.isArray(reactCustomPanels)) {
    options.customPanels = reactCustomPanels.map((panel) => {
      if (typeof panel.render !== 'function') return panel as never;
      const bridged = createNodeBridge<PinnedRowsContext>(panel.render);
      return {
        ...panel,
        // customPanels expect HTMLElement (not nullable); coerce null → empty wrapper.
        render: (ctx: PinnedRowsContext) => bridged(ctx) ?? document.createElement('div'),
      };
    });
  }

  // Bridge slots[] panel renders (issue #255).
  if (Array.isArray(reactSlots)) {
    options.slots = reactSlots.map(bridgeSlot);
  }

  return new PinnedRowsPlugin(options);
});
