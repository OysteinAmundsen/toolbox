/**
 * Narrow internal entry consumed by the feature secondary entries
 * (e.g. `@toolbox-web/grid-angular/internal`). Re-exports only the
 * bridges, registries and helpers that feature entries need to wire
 * themselves into the core `Grid` directive — *without* pulling in the
 * full package barrel (`src/index.ts`) which transitively loads every
 * directive class.
 *
 * Why this file exists
 * --------------------
 * Feature entries previously imported their bridge setters from
 * `@toolbox-web/grid-angular`. The vitest alias resolves that to
 * `src/index.ts`, whose `export { Grid } from './lib/directives/grid.directive'`
 * (and its siblings) eagerly link ~2,000 lines of directive code into v8's
 * coverage scope — code that is genuinely integration-tested via the Astro
 * docs site and Playwright e2e, but has no unit specs. The result was a
 * coverage-scope leak that dragged the project below the 70% threshold
 * after the Tier 2 refactor made the very first feature (`filtering`)
 * import the package barrel at all.
 *
 * By routing feature → core plumbing through this narrow file, the unit
 * coverage scope only includes files that actually have unit specs (the
 * adapter, the bridges, the column config, the small detail/responsive
 * directives). Heavy directive classes are loaded only by the integration
 * surface that genuinely exercises them.
 *
 * Public consumers should keep importing from `@toolbox-web/grid-angular`.
 *
 * @internal — public for cross-entry-point use; not part of the supported API.
 * @packageDocumentation
 */

// Bridge registries (framework-free storage, no Angular runtime cost)
export {
  registerDetailRendererBridge,
  registerFilterPanelTypeDefaultBridge,
  registerResponsiveCardRendererBridge,
} from './internal/feature-bridges';
export type { FilterPanelTypeDefaultBridge, RowRendererBridge } from './internal/feature-bridges';

// Template / config preprocessor registries
export { registerFeatureConfigPreprocessor, registerTemplateBridge } from './internal/feature-extensions';
export type { FeatureConfigPreprocessor, TemplateBridge, TemplateBridgeContext } from './internal/feature-extensions';

// Editor-mount registry + the focus flusher used by the `editing` feature
export { makeFlushFocusedInput, registerEditorMountHook } from './editor-mount-hooks';
export type { EditorMountHook } from './editor-mount-hooks';

// Component-class type guard used by feature config preprocessors
export { isComponentClass } from './angular-column-config';

// Detail / responsive template lookups + their context shapes — lightweight
// directive files (≤ 150 lines each) with no further heavy fan-out.
export { getDetailTemplate } from './directives/grid-detail-view.directive';
export type { GridDetailContext } from './directives/grid-detail-view.directive';
export { getResponsiveCardTemplate } from './directives/grid-responsive-card.directive';
export type { GridResponsiveCardContext } from './directives/grid-responsive-card.directive';

// Adapter type — type-only re-export so feature entries can declare bridge
// callback signatures without loading the full adapter (and its directive
// fan-out) at test time.
export type { GridAdapter } from './angular-grid-adapter';
