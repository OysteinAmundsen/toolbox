/**
 * Pinned Rows feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `pinnedRows` prop on DataGrid.
 * Automatically bridges React JSX `customPanels[].render` to vanilla DOM.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/pinned-rows';
 *
 * <DataGrid pinnedRows={{ position: 'bottom', showRowCount: true }} />
 * ```
 *
 * @example Custom panel with React component
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
 * @packageDocumentation
 */

import '@toolbox-web/grid/features/pinned-rows';

import { PinnedRowsPlugin, type PinnedRowsConfig, type PinnedRowsContext } from '@toolbox-web/grid/plugins/pinned-rows';
import type { ReactNode } from 'react';
import { renderToContainer } from '../lib/portal-bridge';
import { registerFeature } from '../lib/feature-registry';

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
      return {
        ...panel,
        render: (ctx: PinnedRowsContext) => {
          const wrapper = document.createElement('div');
          wrapper.style.display = 'contents';
          renderToContainer(wrapper, reactFn(ctx) as React.ReactElement);
          return wrapper;
        },
      };
    });
  }

  return new PinnedRowsPlugin(options);
});
