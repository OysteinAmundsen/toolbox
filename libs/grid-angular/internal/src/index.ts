/**
 * Internal entry consumed by feature secondary entries
 * (`@toolbox-web/grid-angular/features/*`).
 *
 * This entry exposes the bridges, registries and helpers required to wire
 * a feature into the core `Grid` directive. Public consumers should import
 * from `@toolbox-web/grid-angular` instead — every symbol re-exported here
 * is also available on the primary entry.
 *
 * @internal — public for cross-entry-point use; not part of the supported API.
 * @packageDocumentation
 */

export {
  getDetailTemplate,
  getResponsiveCardTemplate,
  isComponentClass,
  makeFlushFocusedInput,
  registerDetailRendererBridge,
  registerEditorMountHook,
  registerFeatureConfigPreprocessor,
  registerFilterPanelTypeDefaultBridge,
  registerResponsiveCardRendererBridge,
  registerTemplateBridge,
} from '@toolbox-web/grid-angular';
export type {
  EditorMountHook,
  FilterPanelTypeDefaultBridge,
  GridAdapter,
  GridDetailContext,
  GridResponsiveCardContext,
  RowRendererBridge,
} from '@toolbox-web/grid-angular';
