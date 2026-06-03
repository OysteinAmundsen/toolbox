/**
 * Master-Detail feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `masterDetail` prop on DataGrid. Bridges
 * both:
 * - Light-DOM `<GridDetailPanel>` children → MasterDetailPlugin's detailRenderer
 *   (via the adapter's `createDetailRenderer` bridge).
 * - Config-level `masterDetail={{ detailRenderer: (row) => <JSX/> }}` → vanilla
 *   `HTMLElement` (via a per-feature factory override that wraps React node
 *   returns through the React portal bridge).
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/master-detail';
 *
 * // Light-DOM children form
 * <DataGrid masterDetail={{ showExpandColumn: true }}>
 *   <GridDetailPanel>{({ row }) => <DetailView row={row} />}</GridDetailPanel>
 * </DataGrid>
 *
 * // Config-level renderer form (now accepts ReactNode)
 * <DataGrid masterDetail={{ detailRenderer: (row) => <DetailView row={row} /> }} />
 * ```
 *
 * @packageDocumentation
 */

// Delegate to core feature registration
import '@toolbox-web/grid/features/master-detail';
// Named type re-export surfaces the core `FeatureConfig` augmentation to dist
// consumers — a bare side-effect import alone is stripped from the emitted
// `.d.ts`. See `.github/knowledge/adapters.md`.
export type { _Augmentation as _MasterDetailAugmentation } from '@toolbox-web/grid/features/master-detail';

import type { DataGridElement } from '@toolbox-web/grid/all';
import { MasterDetailPlugin, type MasterDetailConfig } from '@toolbox-web/grid/plugins/master-detail';
import type { ReactNode } from 'react';
import type { MasterDetailConfig as ReactMasterDetailConfig } from '../lib/feature-props';
import { registerFeature } from '../lib/feature-registry';
import { getDetailRenderer, type DetailPanelContext } from '../lib/grid-detail-panel';
import { removeFromContainer, renderToContainer } from '../lib/portal-bridge';
import { registerPostMountRefresh } from '../lib/post-mount-refresh-hooks';
import { registerDetailRendererBridge } from '../lib/react-grid-adapter';

// Install the master-detail row-renderer bridge on the React adapter.
// This augments the adapter (mirroring how core plugins augment the grid
// via `registerPlugin`) so master-detail-specific bridging lives with the
// master-detail feature, not in the central adapter file.
registerDetailRendererBridge((gridElement, { trackPortal }) => {
  const renderFn = getDetailRenderer(gridElement);
  if (!renderFn) return undefined;

  return (row, rowIndex) => {
    const container = document.createElement('div');
    container.className = 'react-detail-panel';

    const ctx: DetailPanelContext<typeof row> = { row, rowIndex };
    const portalKey = renderToContainer(
      container,
      renderFn(ctx as DetailPanelContext<unknown>),
      undefined,
      gridElement,
    );
    trackPortal(portalKey, container, false);

    return container;
  };
});

// Refresh the MasterDetailPlugin's renderer once React has committed the
// `<GridDetailPanel>` child (the plugin is instantiated by feature-props
// before React's commit phase, so its initial renderer lookup misses).
// Replaces the hard-coded `refreshMasterDetailRenderer` that used to live
// in `data-grid.tsx`.
registerPostMountRefresh('masterDetail', ({ gridEl }) => {
  const grid = gridEl as DataGridElement;
  const plugin = grid.getPluginByName('masterDetail') as { refreshDetailRenderer?: () => void } | undefined;
  plugin?.refreshDetailRenderer?.();
});

/**
 * Subclass that releases React portals owned by the bridged `detailRenderer`
 * when the plugin detaches (grid disconnect or config replace).
 */
class MasterDetailPluginWithCleanup extends MasterDetailPlugin {
  #portalKeys: Set<string>;
  constructor(config: MasterDetailConfig, portalKeys: Set<string>) {
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

// Override the core feature factory to bridge config-level `detailRenderer`
// returns (`ReactNode`) to vanilla `HTMLElement | string`. Light-DOM
// `<GridDetailPanel>` continues to win via `parseDetailElement` inside the
// plugin's `parseLightDomDetail`.
registerFeature(
  'masterDetail',
  (rawConfig) => {
    const options = rawConfig == null || typeof rawConfig === 'boolean' ? {} : (rawConfig as ReactMasterDetailConfig);
    const userRenderer = options.detailRenderer;
    if (typeof userRenderer !== 'function') {
      return new MasterDetailPlugin(options as MasterDetailConfig);
    }

    const portalKeys = new Set<string>();
    const bridged: MasterDetailConfig['detailRenderer'] = (row, rowIndex) => {
      const result = (userRenderer as (r: Record<string, unknown>, i: number) => ReactNode | HTMLElement | string)(
        row,
        rowIndex,
      );
      if (result == null || result === false) return document.createElement('div');
      if (typeof result === 'string') return result;
      if (result instanceof HTMLElement) return result;
      const host = document.createElement('div');
      host.className = 'react-detail-panel';
      const key = renderToContainer(host, result as ReactNode);
      portalKeys.add(key);
      return host;
    };

    return new MasterDetailPluginWithCleanup(
      { ...(options as MasterDetailConfig), detailRenderer: bridged },
      portalKeys,
    );
  },
  { override: true },
);
