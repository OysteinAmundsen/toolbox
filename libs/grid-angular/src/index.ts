/**
 * @packageDocumentation
 * @toolbox-web/grid-angular - Angular adapter for @toolbox-web/grid.
 *
 * Provides directives for seamless Angular integration with the grid component.
 */

// Primary export
export { GridAdapter } from './lib/angular-grid-adapter';

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
export { BaseFilterPanel } from './lib/base-filter-panel';
export { BaseGridEditor } from './lib/base-grid-editor';
export { BaseGridEditorCVA } from './lib/base-grid-editor-cva';
export { BaseOverlayEditor } from './lib/base-overlay-editor';
export type { OverlayPosition } from './lib/base-overlay-editor';
export { GridColumnEditor } from './lib/directives/grid-column-editor.directive';
export type { GridEditorContext } from './lib/directives/grid-column-editor.directive';
export { GridColumnView } from './lib/directives/grid-column-view.directive';
export type { GridCellContext } from './lib/directives/grid-column-view.directive';
export { TbwGridColumn } from './lib/directives/grid-column.directive';
export { GridDetailView } from './lib/directives/grid-detail-view.directive';
export type { GridDetailContext } from './lib/directives/grid-detail-view.directive';
export { GridFormArray, getFormArrayContext } from './lib/directives/grid-form-array.directive';
export type { FormArrayContext } from './lib/directives/grid-form-array.directive';
export { TbwGridHeader } from './lib/directives/grid-header.directive';
export { GridLazyForm, getLazyFormContext } from './lib/directives/grid-lazy-form.directive';
export type { LazyFormFactory, RowFormChangeEvent } from './lib/directives/grid-lazy-form.directive';
export { GridResponsiveCard } from './lib/directives/grid-responsive-card.directive';
export type { GridResponsiveCardContext } from './lib/directives/grid-responsive-card.directive';
export { TbwGridToolButtons } from './lib/directives/grid-tool-buttons.directive';
export { GridToolPanel } from './lib/directives/grid-tool-panel.directive';
export type { GridToolPanelContext } from './lib/directives/grid-tool-panel.directive';
export { Grid } from './lib/directives/grid.directive';
export type { CellCommitEvent, RowCommitEvent } from './lib/directives/grid.directive';

// Structural directives for cleaner template syntax
export { TbwEditor, TbwRenderer } from './lib/directives/structural-directives';
export type { StructuralCellContext, StructuralEditorContext } from './lib/directives/structural-directives';

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
