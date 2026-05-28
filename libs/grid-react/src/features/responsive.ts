/**
 * Responsive feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `responsive` prop on DataGrid. Bridges
 * both:
 * - Light-DOM `<GridResponsiveCard>` children → ResponsivePlugin's cardRenderer
 *   (via the adapter's `createResponsiveCardRenderer` bridge).
 * - Config-level `responsive={{ cardRenderer: (row) => <JSX/> }}` → vanilla
 *   `HTMLElement` (via a per-feature factory override that wraps React node
 *   returns through the React portal bridge).
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/responsive';
 *
 * <DataGrid responsive={{ breakpoint: 700, cardRenderer: (row) => <Card row={row} /> }} />
 * ```
 *
 * @packageDocumentation
 */

// Delegate to core feature registration
import '@toolbox-web/grid/features/responsive';

import type { DataGridElement, FrameworkAdapter } from '@toolbox-web/grid/all';
import { ResponsivePlugin, type ResponsivePluginConfig } from '@toolbox-web/grid/plugins/responsive';
import type { ReactNode } from 'react';
import type { ResponsivePluginConfig as ReactResponsiveConfig } from '../lib/feature-props';
import { registerFeature } from '../lib/feature-registry';
import { getResponsiveCardRenderer, type ResponsiveCardContext } from '../lib/grid-responsive-card';
import { removeFromContainer, renderToContainer } from '../lib/portal-bridge';
import { registerPostMountRefresh } from '../lib/post-mount-refresh-hooks';
import { registerResponsiveCardRendererBridge } from '../lib/react-grid-adapter';

// Install the responsive card row-renderer bridge on the React adapter.
// Augments the adapter so responsive-specific bridging lives with the
// responsive feature, not in the central adapter file.
registerResponsiveCardRendererBridge((gridElement, { trackPortal }) => {
  const renderFn = getResponsiveCardRenderer(gridElement);
  if (!renderFn) return undefined;

  return (row, rowIndex) => {
    const container = document.createElement('div');
    container.className = 'react-responsive-card';

    const ctx: ResponsiveCardContext<typeof row> = { row, index: rowIndex };
    const portalKey = renderToContainer(
      container,
      renderFn(ctx as ResponsiveCardContext<unknown>),
      undefined,
      gridElement,
    );
    trackPortal(portalKey, container, false);

    return container;
  };
});

// Refresh the ResponsivePlugin's card renderer once React has committed
// the `<GridResponsiveCard>` child. The plugin is created by feature props
// during grid init (before React commit), so it never sees the React-
// registered renderer without a post-mount kick. Replaces the hard-coded
// `refreshResponsiveCardRenderer` that used to live in `data-grid.tsx`.
type ResponsivePluginWithRefresh = {
  setCardRenderer?: (renderer: unknown) => void;
};
type ResponsiveFrameworkAdapter = FrameworkAdapter & {
  createResponsiveCardRenderer?: (gridEl: HTMLElement) => unknown;
};
registerPostMountRefresh('responsive', ({ gridEl }) => {
  // Only refresh when the user actually rendered a `<tbw-grid-responsive-card>`.
  if (!gridEl.querySelector('tbw-grid-responsive-card')) return;
  const cardRenderer = getResponsiveCardRenderer(gridEl);
  if (!cardRenderer) return;
  const grid = gridEl as DataGridElement & { __frameworkAdapter?: ResponsiveFrameworkAdapter };
  const plugin = grid.getPluginByName('responsive') as ResponsivePluginWithRefresh | undefined;
  if (!plugin?.setCardRenderer) return;
  const reactRenderer = grid.__frameworkAdapter?.createResponsiveCardRenderer?.(gridEl);
  if (reactRenderer) plugin.setCardRenderer(reactRenderer);
});

/**
 * Subclass that releases React portals owned by the bridged `cardRenderer`
 * when the plugin detaches (grid disconnect or config replace).
 */
class ResponsivePluginWithCleanup extends ResponsivePlugin {
  #portalKeys: Set<string>;
  constructor(config: ResponsivePluginConfig, portalKeys: Set<string>) {
    super(config);
    this.#portalKeys = portalKeys;
  }
  override detach(): void {
    super.detach();
    for (const key of this.#portalKeys) {
      try {
        removeFromContainer(key, { sync: false });
      } catch {
        // Ignore individual teardown errors so siblings still run.
      }
    }
    this.#portalKeys.clear();
  }
}

// Override the core feature factory to bridge config-level `cardRenderer`
// returns (`ReactNode`) to vanilla `HTMLElement`. Light-DOM
// `<GridResponsiveCard>` continues to win via the post-mount hook above.
registerFeature(
  'responsive',
  (rawConfig) => {
    const options = rawConfig == null || typeof rawConfig === 'boolean' ? {} : (rawConfig as ReactResponsiveConfig);
    const userRenderer = options.cardRenderer as
      | ((row: unknown, rowIndex: number, column?: unknown) => ReactNode | HTMLElement)
      | undefined;
    if (typeof userRenderer !== 'function') {
      return new ResponsivePlugin(options as ResponsivePluginConfig);
    }

    const portalKeys = new Set<string>();
    const bridged: ResponsivePluginConfig['cardRenderer'] = (row, rowIndex, column) => {
      const result = userRenderer(row, rowIndex, column);
      if (result instanceof HTMLElement) return result;
      const host = document.createElement('div');
      host.className = 'react-responsive-card';
      if (result == null || result === false) return host;
      const key = renderToContainer(host, result as ReactNode);
      portalKeys.add(key);
      return host;
    };

    return new ResponsivePluginWithCleanup(
      { ...(options as ResponsivePluginConfig), cardRenderer: bridged },
      portalKeys,
    );
  },
  { override: true },
);
