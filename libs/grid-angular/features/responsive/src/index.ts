/**
 * Responsive feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `[responsive]` input on the `Grid`
 * directive AND to wire `<tbw-grid-responsive-card>` Angular templates into
 * the ResponsivePlugin's `cardRenderer`.
 *
 * @example
 * ```typescript
 * // In your bootstrap (e.g. main.ts or app.component.ts):
 * import '@toolbox-web/grid-angular/features/responsive';
 * ```
 *
 * ```html
 * <tbw-grid [responsive]="{ breakpoint: 768 }">
 *   <tbw-grid-responsive-card>
 *     <ng-template let-row>...</ng-template>
 *   </tbw-grid-responsive-card>
 * </tbw-grid>
 * ```
 *
 * @packageDocumentation
 */

import type { TemplateRef } from '@angular/core';
import {
  getResponsiveCardTemplate,
  registerResponsiveCardRendererBridge,
  registerTemplateBridge,
  type GridAdapter,
  type GridResponsiveCardContext,
} from '@toolbox-web/grid-angular/internal';
import '@toolbox-web/grid/features/responsive';
export type { _Augmentation as _ResponsiveAugmentation } from '@toolbox-web/grid/features/responsive';

/**
 * Subset of `ResponsivePlugin` we touch from the bridge. Avoids importing
 * the plugin class itself.
 */
interface ResponsivePluginLike {
  setCardRenderer?: (renderer: (row: unknown, rowIndex: number) => HTMLElement) => void;
}

// Install the row renderer bridge on the adapter. This is what
// `adapter.createResponsiveCardRenderer(grid)` and
// `adapter.parseResponsiveCardElement(el)` delegate to. Without this import,
// both methods return undefined.
registerResponsiveCardRendererBridge(<TRow = unknown>(gridElement: HTMLElement, adapter: GridAdapter) => {
  const template = getResponsiveCardTemplate(gridElement) as TemplateRef<GridResponsiveCardContext<TRow>> | undefined;
  if (!template) return undefined;

  return (row: TRow, rowIndex: number) => {
    const context: GridResponsiveCardContext<TRow> = { $implicit: row, row, index: rowIndex };
    const viewRef = adapter.createTrackedEmbeddedView(template, context);
    const container = document.createElement('div');
    viewRef.rootNodes.forEach((node: Node) => container.appendChild(node));
    return container;
  };
});

// Wire <tbw-grid-responsive-card> Angular templates into the ResponsivePlugin
// once content templates are registered. Runs from `Grid.ngAfterContentInit`
// via the template-bridge registry.
registerTemplateBridge(({ grid, adapter }) => {
  // Only act when the user actually placed a <tbw-grid-responsive-card> in light DOM.
  const cardElement = grid.querySelector('tbw-grid-responsive-card');
  if (!cardElement) return;

  // Build a card renderer from the Angular template.
  const cardRenderer = adapter.createResponsiveCardRenderer(grid);
  if (!cardRenderer) return;

  // Find the plugin by name to avoid importing the class.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingPlugin = (grid as any).gridConfig?.plugins?.find((p: { name?: string }) => p.name === 'responsive') as
    | ResponsivePluginLike
    | undefined;

  if (!existingPlugin) {
    // eslint-disable-next-line no-console
    console.warn(
      '[tbw-grid-angular] <tbw-grid-responsive-card> found but ResponsivePlugin is not configured.\n' +
        'Add the [responsive] input or include ResponsivePlugin in gridConfig.plugins:\n\n' +
        '  <tbw-grid [responsive]="{ breakpoint: 600 }">...</tbw-grid>\n\n' +
        'or:\n\n' +
        '  import { ResponsivePlugin } from "@toolbox-web/grid/plugins/responsive";\n' +
        '  gridConfig = { plugins: [new ResponsivePlugin({ breakpoint: 600 })] };',
    );
    return;
  }

  existingPlugin.setCardRenderer?.(cardRenderer as (row: unknown, rowIndex: number) => HTMLElement);
});
