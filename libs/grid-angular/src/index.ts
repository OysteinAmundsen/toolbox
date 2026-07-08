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
  registerEditorSpecBridge,
  registerFilterPanelTypeDefaultBridge,
  registerResponsiveCardRendererBridge,
  registerToolPanelRendererBridge,
} from './lib/angular-grid-adapter';
export type {
  EditorMountHook,
  EditorSpecBridge,
  FilterPanelTypeDefaultBridge,
  RowRendererBridge,
  ToolPanelRendererBridge,
} from './lib/angular-grid-adapter';

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

// Core directives. Feature-owned directives (editors, filter panels,
// master-detail, responsive cards, shell) live in their `features/<feature>`
// secondary entries, not here.
export { GridColumnView } from './lib/directives/grid-column-view.directive';
export type { GridCellContext } from './lib/directives/grid-column-view.directive';
export { TbwGridColumn } from './lib/directives/grid-column.directive';
export { TbwGridHeader } from './lib/directives/grid-header.directive';
export { TbwGridToolButtons } from './lib/directives/grid-tool-buttons.directive';
export { TbwGridType } from './lib/directives/grid-type.directive';
export { Grid } from './lib/directives/grid.directive';
export type { CellCommitEvent, RowCommitEvent } from './lib/directives/grid.directive';

// Structural directives for cleaner template syntax. `TbwRenderer` stays in the
// main entry (editor-agnostic). `TbwEditor` lives in the `features/editing`
// secondary entry.
export { TbwRenderer } from './lib/directives/structural-directives';
export type { StructuralCellContext } from './lib/directives/structural-directives';

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
