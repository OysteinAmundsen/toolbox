/**
 * Column Grouping feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `groupingColumns` prop on DataGrid.
 * Automatically bridges React JSX `groupHeaderRenderer` to vanilla DOM.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/grouping-columns';
 *
 * <DataGrid groupingColumns />
 * ```
 *
 * @example Custom group header renderer
 * ```tsx
 * <DataGrid groupingColumns={{
 *   columnGroups: [...],
 *   groupHeaderRenderer: (params) => <strong>{params.label} ({params.columns.length})</strong>,
 * }} />
 * ```
 *
 * @packageDocumentation
 */

import {
  GroupingColumnsPlugin,
  type ColumnGroupDefinition,
  type GroupHeaderRenderParams,
  type GroupingColumnsConfig,
} from '@toolbox-web/grid/plugins/grouping-columns';
import type { ReactNode } from 'react';
import { registerFeature } from '../lib/feature-registry';
import { createNodeBridge } from '../lib/portal-bridge';

/** Bridge a React render function to a vanilla DOM render function. */
function bridgeRenderer(
  reactFn: (params: GroupHeaderRenderParams) => ReactNode,
): (params: GroupHeaderRenderParams) => HTMLElement {
  const bridged = createNodeBridge<GroupHeaderRenderParams>(reactFn);
  // Group headers always need an element; coerce null → empty wrapper.
  return (params) => bridged(params) ?? document.createElement('div');
}

registerFeature('groupingColumns', (rawConfig) => {
  if (typeof rawConfig === 'boolean') return new GroupingColumnsPlugin();
  if (!rawConfig) return new GroupingColumnsPlugin();

  const config = rawConfig as GroupingColumnsConfig & {
    groupHeaderRenderer?: unknown;
    columnGroups?: (ColumnGroupDefinition & { renderer?: unknown })[];
  };
  const options = { ...config } as GroupingColumnsConfig;

  // Bridge React groupHeaderRenderer (returns ReactNode) to vanilla (returns HTMLElement | string | void)
  if (typeof config.groupHeaderRenderer === 'function') {
    const reactFn = config.groupHeaderRenderer as unknown as (params: GroupHeaderRenderParams) => ReactNode;
    options.groupHeaderRenderer = bridgeRenderer(reactFn);
  }

  // Bridge per-group renderers inside columnGroups
  if (Array.isArray(config.columnGroups)) {
    options.columnGroups = config.columnGroups.map((def) => {
      if (typeof def.renderer !== 'function') return def as ColumnGroupDefinition;
      const reactFn = def.renderer as unknown as (params: GroupHeaderRenderParams) => ReactNode;
      return { ...def, renderer: bridgeRenderer(reactFn) } as ColumnGroupDefinition;
    });
  }

  return new GroupingColumnsPlugin(options);
});
