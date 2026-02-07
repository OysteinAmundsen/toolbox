/**
 * @packageDocumentation
 * @toolbox-web/grid-angular - Angular adapter for @toolbox-web/grid.
 *
 * Provides directives for seamless Angular integration with the grid component.
 */

// Primary export - use this
export { GridAdapter } from './lib/angular-grid-adapter';
// Deprecated alias
export {
  /** @deprecated Use `GridAdapter` instead */
  AngularGridAdapter,
} from './lib/angular-grid-adapter';

// Configuration types - use unified names (GridConfig, ColumnConfig, CellRenderer, etc.)
export { isComponentClass } from './lib/angular-column-config';
export type {
  // Deprecated names - use unified names instead
  /** @deprecated Use `CellEditor` instead */
  AngularCellEditor,
  /** @deprecated Use `CellRenderer` instead */
  AngularCellRenderer,
  /** @deprecated Use `ColumnConfig` instead */
  AngularColumnConfig,
  /** @deprecated Use `GridConfig` instead */
  AngularGridConfig,
  /** @deprecated Use `TypeDefault` instead */
  AngularTypeDefault,
  // Primary exports - use these
  CellEditor,
  CellRenderer,
  ColumnConfig,
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
export type { ExportMethods, InjectGridReturn, SelectionMethods } from './lib/inject-grid';

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

// Directives and context types
export { BaseGridEditor } from './lib/base-grid-editor';
export { GridColumnEditor } from './lib/directives/grid-column-editor.directive';
export type { GridEditorContext } from './lib/directives/grid-column-editor.directive';
export { GridColumnView } from './lib/directives/grid-column-view.directive';
export type { GridCellContext } from './lib/directives/grid-column-view.directive';
export { GridDetailView } from './lib/directives/grid-detail-view.directive';
export type { GridDetailContext } from './lib/directives/grid-detail-view.directive';
export { getFormArrayContext, GridFormArray } from './lib/directives/grid-form-array.directive';
export type { FormArrayContext } from './lib/directives/grid-form-array.directive';
export { getLazyFormContext, GridLazyForm } from './lib/directives/grid-lazy-form.directive';
export type { LazyFormFactory, RowFormChangeEvent } from './lib/directives/grid-lazy-form.directive';
export { GridResponsiveCard } from './lib/directives/grid-responsive-card.directive';
export type { GridResponsiveCardContext } from './lib/directives/grid-responsive-card.directive';
export { GridToolPanel } from './lib/directives/grid-tool-panel.directive';
export type { GridToolPanelContext } from './lib/directives/grid-tool-panel.directive';
export { Grid } from './lib/directives/grid.directive';
export type { CellCommitEvent, RowCommitEvent } from './lib/directives/grid.directive';

// Structural directives for cleaner template syntax
export { TbwEditor, TbwRenderer } from './lib/directives/structural-directives';
export type { StructuralCellContext, StructuralEditorContext } from './lib/directives/structural-directives';

// Backwards compatibility aliases (deprecated)
export { TbwEditor as TbwCellEditor, TbwRenderer as TbwCellView } from './lib/directives/structural-directives';
