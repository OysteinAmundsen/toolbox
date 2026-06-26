/**
 * Master-detail feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `[masterDetail]` input on the `Grid`
 * directive AND to wire `<tbw-grid-detail>` Angular templates into the
 * MasterDetailPlugin's `detailRenderer`.
 *
 * @example
 * ```typescript
 * // In your bootstrap (e.g. main.ts or app.component.ts):
 * import '@toolbox-web/grid-angular/features/master-detail';
 * ```
 *
 * ```html
 * <tbw-grid [masterDetail]="{ showExpandColumn: true }">
 *   <tbw-grid-detail>
 *     <ng-template let-row>...</ng-template>
 *   </tbw-grid-detail>
 * </tbw-grid>
 * ```
 *
 * @packageDocumentation
 */

import type { Type } from '@angular/core';
import {
  isComponentClass,
  registerDetailRendererBridge,
  registerFeatureConfigPreprocessor,
  registerTemplateBridge,
  type GridAdapter,
} from '@toolbox-web/grid-angular';
import '@toolbox-web/grid/features/master-detail';
import { getDetailTemplate, type GridDetailContext } from './grid-detail-view.directive';
import type { MasterDetailConfig } from './grid-master-detail.directive';
export { GridMasterDetailDirective } from './grid-master-detail.directive';
export type { MasterDetailConfig } from './grid-master-detail.directive';
export type { _Augmentation as _MasterDetailAugmentation } from '@toolbox-web/grid/features/master-detail';

// ---------------------------------------------------------------------------
// Master-detail-owned directive + helpers. These physically live in this
// secondary entry (the runtime behaviour lives here too).
// ---------------------------------------------------------------------------
export { getDetailTemplate, GridDetailView } from './grid-detail-view.directive';
export type { GridDetailContext } from './grid-detail-view.directive';

/**
 * Subset of `MasterDetailPlugin` we touch from the bridge. Avoids importing
 * the plugin class itself (would defeat tree-shaking and re-introduce the
 * coupling we just removed from the core directive).
 */
interface MasterDetailPluginLike {
  refreshDetailRenderer?: () => void;
}

// Install the row renderer bridge on the adapter. This is what
// `adapter.createDetailRenderer(grid)` and `adapter.parseDetailElement(el)`
// delegate to. Without this import, both methods return undefined.
registerDetailRendererBridge(<TRow = unknown>(gridElement: HTMLElement, adapter: GridAdapter) => {
  // Type inferred from `getDetailTemplate` (same package instance as `adapter`),
  // not from a local `import type { TemplateRef } from '@angular/core'` — the
  // latter resolves through Bun's `.bun/` cache during ng-packagr build and
  // produces a brand-incompatible TemplateRef vs the built adapter `.d.ts`.
  const template = getDetailTemplate(gridElement);
  if (!template) return undefined;

  return (row: TRow) => {
    const context: GridDetailContext<TRow> = { $implicit: row, row };
    const viewRef = adapter.createTrackedEmbeddedView(template, context);
    const container = document.createElement('div');
    viewRef.rootNodes.forEach((node: Node) => container.appendChild(node));
    return container;
  };
});

// Wire <tbw-grid-detail> Angular templates into the MasterDetailPlugin once
// content templates are registered. The plugin's `parseLightDomDetail()`
// already calls back into the adapter via `grid.__frameworkAdapter.parseDetailElement`
// (which the `Grid` directive set in `ngOnInit`), so all we need to do here
// is trigger a refresh once Angular's content templates are available.
registerTemplateBridge(({ grid }) => {
  // Only act when the user actually placed a <tbw-grid-detail> in light DOM.
  const detailElement = grid.querySelector('tbw-grid-detail');
  if (!detailElement) return;

  // The plugin must already have been attached (via [masterDetail] input,
  // gridConfig.features.masterDetail, or gridConfig.plugins). Use the runtime
  // lookup so we don't miss plugins instantiated from `gridConfig.features`,
  // which never appear in `gridConfig.plugins`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingPlugin = (grid as any).getPluginByName?.('masterDetail') as MasterDetailPluginLike | undefined;

  if (!existingPlugin) {
    console.warn(
      '[tbw-grid-angular] <tbw-grid-detail> found but MasterDetailPlugin is not configured.\n' +
        'Add the [masterDetail] input, set gridConfig.features.masterDetail, or include\n' +
        'MasterDetailPlugin in gridConfig.plugins:\n\n' +
        '  <tbw-grid [masterDetail]="{ showExpandColumn: true }">...</tbw-grid>\n\n' +
        'or:\n\n' +
        '  gridConfig = { features: { masterDetail: { showExpandColumn: true } } };',
    );
    return;
  }

  existingPlugin.refreshDetailRenderer?.();
});

/**
 * Bridge any Angular component class used as `masterDetail.detailRenderer` to
 * a plain `(row, rowIndex) => HTMLElement` function before the core plugin
 * factory consumes the config. Without this preprocessor, a component class
 * passed as `detailRenderer` would be invoked as a function at render time
 * and crash. Light-DOM `<tbw-grid-detail>` templates continue to win via
 * `parseLightDomDetail` inside the plugin.
 *
 * @since 1.7.1
 */
registerFeatureConfigPreprocessor('masterDetail', (config, adapter) => {
  if (!config || typeof config !== 'object') return config;
  const cfg = config as MasterDetailConfig;
  if (!isComponentClass(cfg.detailRenderer)) return config;

  const componentClass = cfg.detailRenderer as Type<unknown>;
  const mount = adapter.mountComponentRenderer<{ row: unknown; rowIndex: number }>(componentClass, (ctx) => ({
    row: ctx.row,
    rowIndex: ctx.rowIndex,
  }));
  const cached = new Map<unknown, HTMLElement>();
  const detailRenderer: MasterDetailConfig['detailRenderer'] = (row, rowIndex) => {
    const existing = cached.get(row);
    if (existing) return existing;
    const { hostElement } = mount({ row, rowIndex });
    cached.set(row, hostElement);
    return hostElement;
  };
  return { ...cfg, detailRenderer };
});
