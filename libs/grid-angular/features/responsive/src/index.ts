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

import {
  getResponsiveCardTemplate,
  registerResponsiveCardRendererBridge,
  registerTemplateBridge,
  type GridAdapter,
  type GridResponsiveCardContext,
} from '@toolbox-web/grid-angular';
import '@toolbox-web/grid/features/responsive';
export { GridResponsiveDirective } from './grid-responsive.directive';
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
  // Type inferred from `getResponsiveCardTemplate` (same package instance as
  // `adapter`), not from a local `import type { TemplateRef } from '@angular/core'`
  // — the latter resolves through Bun's `.bun/` cache during ng-packagr build
  // and produces a brand-incompatible TemplateRef vs the built adapter `.d.ts`.
  const template = getResponsiveCardTemplate(gridElement);
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

  // The plugin must already have been attached (via [responsive] input,
  // gridConfig.features.responsive, or gridConfig.plugins). Use the runtime
  // lookup so we don't miss plugins instantiated from `gridConfig.features`,
  // which never appear in `gridConfig.plugins`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingPlugin = (grid as any).getPluginByName?.('responsive') as ResponsivePluginLike | undefined;

  if (!existingPlugin) {
    console.warn(
      '[tbw-grid-angular] <tbw-grid-responsive-card> found but ResponsivePlugin is not configured.\n' +
        'Add the [responsive] input, set gridConfig.features.responsive, or include\n' +
        'ResponsivePlugin in gridConfig.plugins:\n\n' +
        '  <tbw-grid [responsive]="{ breakpoint: 600 }">...</tbw-grid>\n\n' +
        'or:\n\n' +
        '  gridConfig = { features: { responsive: { breakpoint: 600 } } };',
    );
    return;
  }

  existingPlugin.setCardRenderer?.(cardRenderer as (row: unknown, rowIndex: number) => HTMLElement);
});
