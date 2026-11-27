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
// Named type re-export surfaces the core `FeatureConfig` augmentation to dist
// consumers (this module registers via factory override, not the core feature
// module, so the augmentation must be pulled in explicitly). See adapters.md.
export type { _Augmentation as _GroupingRowsAugmentation } from '@toolbox-web/grid/features/grouping-rows';
import type { ReactNode } from 'react';
import { registerCallbackRefresh } from '../lib/feature-callback-slots';
import { registerFeature } from '../lib/feature-registry';
import { registerStableFeatureCallback, removeFromContainer, renderToContainer } from '../lib/portal-bridge';

interface GroupPortal {
  container: HTMLElement;
  key?: string;
  params: GroupRowRenderParams;
}

function createGroupRenderer(reactFn: (params: GroupRowRenderParams) => ReactNode) {
  const groups = new Map<string, GroupPortal>();
  let prunePending = false;

  const prune = () => {
    for (const [key, group] of groups) {
      if (!group.container.isConnected) {
        if (group.key) removeFromContainer(group.key, { sync: false });
        groups.delete(key);
      }
    }
  };

  const schedulePrune = () => {
    if (prunePending) return;
    prunePending = true;
    queueMicrotask(() => {
      prunePending = false;
      prune();
    });
  };

  const refresh = () => {
    prune();
    for (const group of groups.values()) {
      const previous = group.container;
      const grid = previous.closest<HTMLElement>('tbw-grid, [data-tbw-grid]') ?? undefined;
      const next = render(group.params, grid);
      if (next !== previous) previous.replaceWith(next);
    }
    return false;
  };
  const render = (params: GroupRowRenderParams, grid?: HTMLElement): HTMLElement => {
    registerCallbackRefresh(reactFn, refresh);
    const node = reactFn(params);
    const previous = groups.get(params.key);
    if (node == null || node === false || node instanceof HTMLElement) {
      if (previous?.key) removeFromContainer(previous.key, { sync: false });
      const container = node instanceof HTMLElement ? node : document.createElement('div');
      groups.set(params.key, { container, params });
      schedulePrune();
      return container;
    }
    const container = previous?.key ? previous.container : document.createElement('div');
    container.style.display = 'contents';
    const key = renderToContainer(container, node, previous?.key, grid);
    groups.set(params.key, { container, key, params });
    schedulePrune();
    return container;
  };
  return render;
}

registerFeature(
  'groupingRows',
  (rawConfig) => {
    if (typeof rawConfig === 'boolean') return new GroupingRowsPlugin();
    if (!rawConfig) return new GroupingRowsPlugin();

    const config = rawConfig as GroupingRowsConfig & { groupRowRenderer?: unknown };
    const options = { ...config } as GroupingRowsConfig;

    // Bridge React groupRowRenderer (returns ReactNode) to vanilla (returns HTMLElement | string | void)
    if (typeof config.groupRowRenderer === 'function') {
      const reactFn = config.groupRowRenderer as unknown as (params: GroupRowRenderParams) => ReactNode;
      options.groupRowRenderer = createGroupRenderer(reactFn);
    }

    return new GroupingRowsPlugin(options);
  },
  { override: true },
);

registerStableFeatureCallback('groupingRows', ['groupRowRenderer']);
