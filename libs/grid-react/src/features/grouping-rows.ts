/**
 * Row Grouping feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `groupingRows` prop on DataGrid.
 * Automatically bridges React JSX `groupRowRenderer` to vanilla DOM.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/grouping-rows';
 *
 * <DataGrid groupingRows={{ groupBy: ['department'] }} />
 * ```
 *
 * @example Custom group row renderer
 * ```tsx
 * <DataGrid groupingRows={{
 *   groupBy: ['department'],
 *   groupRowRenderer: (params) => <strong>{params.key}: {params.value} ({params.rows.length})</strong>,
 * }} />
 * ```
 *
 * @packageDocumentation
 */

import {
  GroupingRowsPlugin,
  type GroupingRowsConfig,
  type GroupRowRenderParams,
} from '@toolbox-web/grid/plugins/grouping-rows';
import type { ReactNode } from 'react';
import { registerFeature } from '../lib/feature-registry';
import { createNodeBridge } from '../lib/portal-bridge';

registerFeature('groupingRows', (rawConfig) => {
  if (typeof rawConfig === 'boolean') return new GroupingRowsPlugin();
  if (!rawConfig) return new GroupingRowsPlugin();

  const config = rawConfig as GroupingRowsConfig & { groupRowRenderer?: unknown };
  const options = { ...config } as GroupingRowsConfig;

  // Bridge React groupRowRenderer (returns ReactNode) to vanilla (returns HTMLElement | string | void)
  if (typeof config.groupRowRenderer === 'function') {
    const reactFn = config.groupRowRenderer as unknown as (params: GroupRowRenderParams) => ReactNode;
    const bridged = createNodeBridge<GroupRowRenderParams>(reactFn);
    // Group rows always need an element; coerce null → empty wrapper.
    options.groupRowRenderer = (params) => bridged(params) ?? document.createElement('div');
  }

  return new GroupingRowsPlugin(options);
});
