/**
 * Shell feature for @toolbox-web/grid-angular
 *
 * Import this module to opt the grid shell (header bar + tool panels) into
 * the build. The shell also auto-registers in v2.x (so it is on by default
 * and non-breaking); importing this module makes the opt-in explicit and
 * tree-shakeable for v3, where the auto-register is removed.
 *
 * The shell is configured through `gridConfig` (`features: { shell }` or the
 * `<tbw-grid-header-content>` / `<tbw-grid-toolbar-content>` /
 * `<tbw-grid-tool-panel>` directives), not a boolean input.
 *
 * @example
 * ```typescript
 * // In your bootstrap (e.g. main.ts or app.component.ts):
 * import '@toolbox-web/grid-angular/features/shell';
 * ```
 *
 * ```html
 * <tbw-grid [gridConfig]="{ features: { shell: { header: { title: 'Employees' } } } }">
 * </tbw-grid>
 * ```
 *
 * @packageDocumentation
 */

import { registerToolPanelRendererBridge, type GridAdapter } from '@toolbox-web/grid-angular';
import '@toolbox-web/grid/features/shell';
import { getToolPanelTemplate, type GridToolPanelContext } from './grid-tool-panel.directive';

export type { _Augmentation as _ShellAugmentation } from '@toolbox-web/grid/features/shell';

// ---------------------------------------------------------------------------
// Shell-owned directives + helpers. These physically live in this secondary
// entry (the runtime behaviour lives here too).
// ---------------------------------------------------------------------------
export { GridHeaderContent } from './grid-header-content.directive';
export type { GridHeaderContentContext } from './grid-header-content.directive';
export { getToolPanelElements, getToolPanelTemplate, GridToolPanel } from './grid-tool-panel.directive';
export type { GridToolPanelContext } from './grid-tool-panel.directive';
export { GridToolbarContent } from './grid-toolbar-content.directive';
export type { GridToolbarContentContext } from './grid-toolbar-content.directive';

// Install the tool-panel renderer bridge on the adapter. This is what
// `adapter.createToolPanelRenderer(element)` delegates to. Without this import,
// the method returns undefined and light-DOM `<tbw-grid-tool-panel>` Angular
// templates are never mounted by the core ShellPlugin.
registerToolPanelRendererBridge((element: HTMLElement, adapter: GridAdapter) => {
  // Type inferred from `getToolPanelTemplate` (same package instance as the
  // adapter), not from a local `import type { TemplateRef } from '@angular/core'`
  // — the latter resolves through Bun's `.bun/` cache during ng-packagr build
  // and produces a brand-incompatible TemplateRef vs the built adapter `.d.ts`.
  const template = getToolPanelTemplate(element);
  if (!template) return undefined;

  // Find the parent grid element for context.
  const gridElement = element.closest('tbw-grid, [data-tbw-grid]') as HTMLElement | null;

  return (container: HTMLElement) => {
    const context: GridToolPanelContext = {
      $implicit: gridElement ?? container,
      grid: gridElement ?? container,
    };
    const viewRef = adapter.createTrackedEmbeddedView(template, context);
    viewRef.rootNodes.forEach((node: Node) => container.appendChild(node));
    return () => viewRef.destroy();
  };
});
