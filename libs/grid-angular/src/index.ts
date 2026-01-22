/**
 * @packageDocumentation
 * @toolbox-web/grid-angular - Angular adapter for @toolbox-web/grid.
 *
 * Provides directives for seamless Angular integration with the grid component.
 */

export { AngularGridAdapter } from './lib/angular-grid-adapter';

// Angular-specific column/grid config types (for component-based renderers/editors)
export { isComponentClass } from './lib/angular-column-config';
export type {
  AngularCellEditor,
  AngularCellRenderer,
  AngularColumnConfig,
  AngularGridConfig,
} from './lib/angular-column-config';

// Type registry for application-wide type defaults
export { GRID_TYPE_DEFAULTS, GridTypeRegistry, provideGridTypeDefaults } from './lib/grid-type-registry';
export type { AngularTypeDefault } from './lib/grid-type-registry';

// Directives and context types
export { GridColumnEditor } from './lib/directives/grid-column-editor.directive';
export type { GridEditorContext } from './lib/directives/grid-column-editor.directive';
export { GridColumnView } from './lib/directives/grid-column-view.directive';
export type { GridCellContext } from './lib/directives/grid-column-view.directive';
export { GridDetailView } from './lib/directives/grid-detail-view.directive';
export type { GridDetailContext } from './lib/directives/grid-detail-view.directive';
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
