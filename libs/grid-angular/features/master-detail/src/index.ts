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

import type { TemplateRef } from '@angular/core';
import {
  getDetailTemplate,
  registerDetailRendererBridge,
  registerTemplateBridge,
  type GridAdapter,
  type GridDetailContext,
} from '@toolbox-web/grid-angular';
import '@toolbox-web/grid/features/master-detail';
export { GridMasterDetailDirective } from './grid-master-detail.directive';
export type { _Augmentation as _MasterDetailAugmentation } from '@toolbox-web/grid/features/master-detail';

// ---------------------------------------------------------------------------
// Re-exports from `@toolbox-web/grid-angular` (main entry).
//
// `GridDetailView` (and its `getDetailTemplate` helper / `GridDetailContext`
// type) still physically live in the main entry today but are master-detail
// specific. They are re-exported here so consumers can import them from the
// feature entry that owns the runtime behaviour. The same symbols are
// `@deprecated` on the main entry; in v2.0.0 the source will physically move
// into this secondary entry and the deprecated re-exports on the main entry
// will be removed.
// ---------------------------------------------------------------------------
export { getDetailTemplate, GridDetailView } from '@toolbox-web/grid-angular';
export type { GridDetailContext } from '@toolbox-web/grid-angular';

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
  const template = getDetailTemplate(gridElement) as TemplateRef<GridDetailContext<TRow>> | undefined;
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

  // The plugin must already have been added to the grid (via [masterDetail] input
  // or manual gridConfig.plugins). Find it by name to avoid importing the class.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingPlugin = (grid as any).gridConfig?.plugins?.find(
    (p: { name?: string }) => p.name === 'masterDetail',
  ) as MasterDetailPluginLike | undefined;

  if (!existingPlugin) {
    // eslint-disable-next-line no-console
    console.warn(
      '[tbw-grid-angular] <tbw-grid-detail> found but MasterDetailPlugin is not configured.\n' +
        'Add the [masterDetail] input or include MasterDetailPlugin in gridConfig.plugins:\n\n' +
        '  <tbw-grid [masterDetail]="{ showExpandColumn: true }">...</tbw-grid>\n\n' +
        'or:\n\n' +
        '  import { MasterDetailPlugin } from "@toolbox-web/grid/plugins/master-detail";\n' +
        '  gridConfig = { plugins: [new MasterDetailPlugin({ ... })] };',
    );
    return;
  }

  existingPlugin.refreshDetailRenderer?.();
});
