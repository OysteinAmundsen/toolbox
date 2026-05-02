/**
 * @packageDocumentation
 * @toolbox-web/grid-angular - Angular adapter for @toolbox-web/grid.
 *
 * Provides directives for seamless Angular integration with the grid component.
 */

// Primary export
export {
  GridAdapter,
  makeFlushFocusedInput,
  registerDetailRendererBridge,
  registerEditorMountHook,
  registerFilterPanelTypeDefaultBridge,
  registerResponsiveCardRendererBridge,
} from './lib/angular-grid-adapter';
export type { EditorMountHook, FilterPanelTypeDefaultBridge, RowRendererBridge } from './lib/angular-grid-adapter';

// Configuration types
export { isComponentClass } from './lib/angular-column-config';
export type {
  CellEditor,
  CellRenderer,
  ColumnConfig,
  FilterPanel,
  GridConfig,
  TypeDefault,
} from './lib/angular-column-config';

// Type registry for application-wide type defaults
export { GRID_TYPE_DEFAULTS, GridTypeRegistry, provideGridTypeDefaults } from './lib/grid-type-registry';
export type { TypeDefaultRegistration } from './lib/grid-type-registry';

// Icon registry for application-wide icon overrides
export { GRID_ICONS, GridIconRegistry, provideGridIcons } from './lib/grid-icon-registry';

// Inject function for programmatic grid access
export { injectGrid } from './lib/inject-grid';
export type { InjectGridReturn } from './lib/inject-grid';

// Feature registry for tree-shakeable plugin registration
export {
  clearFeatureRegistry,
  createPluginFromFeature,
  getFeatureFactory,
  getRegisteredFeatures,
  isFeatureRegistered,
  registerFeature,
} from './lib/feature-registry';
export type { FeatureName, PluginFactory } from './lib/feature-registry';

// Base classes for editors and filter panels
//
// NOTE: All re-exports below for editing/filtering/master-detail directives are
// `@deprecated` from the main `@toolbox-web/grid-angular` entry. Importing the
// same symbol from `@toolbox-web/grid-angular/features/<feature>` does NOT
// trigger the deprecation warning \u2014 only this main-entry path does. The source
// will physically move into the matching `features/<feature>` secondary entry
// in v2.0.0, and these re-exports will be removed at the same time. Search the
// `libs/grid-angular/src/` tree for `MOVE-IN-V2` to enumerate everything that
// needs to move at that point.

/** @deprecated Import from `@toolbox-web/grid-angular/features/filtering` instead. Will be removed from the main entry in v2.0.0. */
export { BaseFilterPanel } from './lib/base-filter-panel';
/** @deprecated Import from `@toolbox-web/grid-angular/features/editing` instead. Will be removed from the main entry in v2.0.0. */
export { BaseGridEditor } from './lib/base-grid-editor';
/** @deprecated Import from `@toolbox-web/grid-angular/features/editing` instead. Will be removed from the main entry in v2.0.0. */
export { BaseGridEditorCVA } from './lib/base-grid-editor-cva';
/** @deprecated Import from `@toolbox-web/grid-angular/features/editing` instead. Will be removed from the main entry in v2.0.0. */
export { BaseOverlayEditor } from './lib/base-overlay-editor';
/** @deprecated Import from `@toolbox-web/grid-angular/features/editing` instead. Will be removed from the main entry in v2.0.0. */
export type { OverlayPosition } from './lib/base-overlay-editor';
/** @deprecated Import from `@toolbox-web/grid-angular/features/editing` instead. Will be removed from the main entry in v2.0.0. */
export { GridColumnEditor } from './lib/directives/grid-column-editor.directive';
/** @deprecated Import from `@toolbox-web/grid-angular/features/editing` instead. Will be removed from the main entry in v2.0.0. */
export type { GridEditorContext } from './lib/directives/grid-column-editor.directive';
export { GridColumnView } from './lib/directives/grid-column-view.directive';
export type { GridCellContext } from './lib/directives/grid-column-view.directive';
export { TbwGridColumn } from './lib/directives/grid-column.directive';
/**
 * @deprecated Import from `@toolbox-web/grid-angular/features/master-detail` instead.
 * Will be removed from the main entry in v2.0.0.
 */
export { GridDetailView, getDetailTemplate } from './lib/directives/grid-detail-view.directive';
/**
 * @deprecated Import from `@toolbox-web/grid-angular/features/master-detail` instead.
 * Will be removed from the main entry in v2.0.0.
 */
export type { GridDetailContext } from './lib/directives/grid-detail-view.directive';
/** @deprecated Import from `@toolbox-web/grid-angular/features/editing` instead. Will be removed from the main entry in v2.0.0. */
export { GridFormArray, getFormArrayContext } from './lib/directives/grid-form-array.directive';
/** @deprecated Import from `@toolbox-web/grid-angular/features/editing` instead. Will be removed from the main entry in v2.0.0. */
export type { FormArrayContext } from './lib/directives/grid-form-array.directive';
export { TbwGridHeader } from './lib/directives/grid-header.directive';
/** @deprecated Import from `@toolbox-web/grid-angular/features/editing` instead. Will be removed from the main entry in v2.0.0. */
export { GridLazyForm, getLazyFormContext } from './lib/directives/grid-lazy-form.directive';
/** @deprecated Import from `@toolbox-web/grid-angular/features/editing` instead. Will be removed from the main entry in v2.0.0. */
export type { LazyFormFactory, RowFormChangeEvent } from './lib/directives/grid-lazy-form.directive';
export { GridResponsiveCard, getResponsiveCardTemplate } from './lib/directives/grid-responsive-card.directive';
export type { GridResponsiveCardContext } from './lib/directives/grid-responsive-card.directive';
export { TbwGridToolButtons } from './lib/directives/grid-tool-buttons.directive';
export { GridToolPanel } from './lib/directives/grid-tool-panel.directive';
export type { GridToolPanelContext } from './lib/directives/grid-tool-panel.directive';
export { Grid } from './lib/directives/grid.directive';
export type { CellCommitEvent, RowCommitEvent } from './lib/directives/grid.directive';

// Structural directives for cleaner template syntax. `TbwRenderer` stays in the
// main entry (editor-agnostic). `TbwEditor` is deprecated here \u2014 use the
// `features/editing` re-export instead.
export { TbwRenderer } from './lib/directives/structural-directives';
export type { StructuralCellContext } from './lib/directives/structural-directives';
/** @deprecated Import from `@toolbox-web/grid-angular/features/editing` instead. Will be removed from the main entry in v2.0.0. */
export { TbwEditor } from './lib/directives/structural-directives';
/** @deprecated Import from `@toolbox-web/grid-angular/features/editing` instead. Will be removed from the main entry in v2.0.0. */
export type { StructuralEditorContext } from './lib/directives/structural-directives';

// Column shorthand utilities (parity with grid-react / grid-vue)
export {
  applyColumnDefaults,
  hasColumnShorthands,
  normalizeColumns,
  parseColumnShorthand,
} from './lib/column-shorthand';
export type { ColumnShorthand } from './lib/column-shorthand';

// Combined provider helper (parity with grid-vue's GridProvider component)
export { provideGrid } from './lib/grid-provider';
export type { ProvideGridOptions } from './lib/grid-provider';

// Internal extension points used by feature secondary entries to plug into the
// core Grid directive (template bridges + per-feature config preprocessors).
// These are public for cross-entry-point use; not part of the supported API.
export {
  getFeatureConfigPreprocessor,
  registerFeatureConfigPreprocessor,
  registerTemplateBridge,
  runTemplateBridges,
} from './lib/internal/feature-extensions';
export type {
  FeatureConfigPreprocessor,
  TemplateBridge,
  TemplateBridgeContext,
} from './lib/internal/feature-extensions';

// Per-grid claims registry used by feature-attribute directives to take
// ownership of inputs/outputs that are otherwise handled by the central
// `Grid` directive. Public for cross-entry-point use; not part of the
// supported API. See `internal/feature-claims.ts` for the design rationale.
export {
  claimEvent,
  getFeatureClaim,
  isEventClaimed,
  registerFeatureClaim,
  unclaimEvent,
  unregisterFeatureClaim,
} from './lib/internal/feature-claims';
export type { FeatureConfigGetter } from './lib/internal/feature-claims';
