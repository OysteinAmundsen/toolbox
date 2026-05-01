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

import { registerTemplateBridge } from '@toolbox-web/grid-angular';
import '@toolbox-web/grid/features/master-detail';
export type { _Augmentation as _MasterDetailAugmentation } from '@toolbox-web/grid/features/master-detail';

/**
 * Subset of `MasterDetailPlugin` we touch from the bridge. Avoids importing
 * the plugin class itself (would defeat tree-shaking and re-introduce the
 * coupling we just removed from the core directive).
 */
interface MasterDetailPluginLike {
  refreshDetailRenderer?: () => void;
}

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
