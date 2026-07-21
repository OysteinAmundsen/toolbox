/**
 * Pinned rows feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `pinnedRows` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/pinned-rows';
 *
 * <tbw-grid [pinnedRows]="{ bottom: [{ type: 'aggregation' }] }" />
 * ```
 *
 * @packageDocumentation
 */

import type { Type } from '@angular/core';
import { isComponentClass, registerFeatureConfigPreprocessor, type GridAdapter } from '@toolbox-web/grid-angular';
import '@toolbox-web/grid/features/pinned-rows';
import type {
  PinnedRowsConfig as CorePinnedRowsConfig,
  PinnedRowSlot as CorePinnedRowSlot,
  ZonedPanelRender as CoreZonedPanelRender,
  PinnedRowsContext,
} from '@toolbox-web/grid/plugins/pinned-rows';
import { buildCachedPanelRenderer } from './cached-panel-renderer';
export { GridPinnedRowsDirective } from './grid-pinned-rows.directive';
export type {
  // Canonical (unprefixed) widening types. Same names as the core types
  // from `@toolbox-web/grid` \u2014 these accept Angular component classes in
  // addition to the vanilla `HTMLElement`-returning renderer functions.
  PanelRender,
  PanelSlot,
  PinnedRowsConfig,
  PinnedRowSlot,
  ZonedPanelRender,
} from './grid-pinned-rows.directive';
export type { _Augmentation as _PinnedRowsAugmentation } from '@toolbox-web/grid/features/pinned-rows';

/**
 * Build a pinned-rows panel renderer function from an Angular component class.
 * Thin wrapper around {@link buildCachedPanelRenderer} that fixes the adapter
 * type to the concrete `GridAdapter`.
 */
function buildPanelRenderer(
  adapter: GridAdapter,
  componentClass: Type<unknown>,
): (ctx: PinnedRowsContext) => HTMLElement {
  return buildCachedPanelRenderer(adapter, componentClass);
}

/**
 * Bridge a single pinned-row slot. Aggregation slots (no `render`) pass through.
 * For panel slots, wrap any component-class `render` (or array entry's `render`)
 * with the Angular component renderer.
 */
function bridgeSlot(adapter: GridAdapter, slot: CorePinnedRowSlot): CorePinnedRowSlot {
  if (!('render' in slot) || slot.render == null) return slot;

  if (Array.isArray(slot.render)) {
    const zoned: CoreZonedPanelRender[] = slot.render.map((entry) => {
      if (entry?.render == null) return entry;
      if (isComponentClass(entry.render)) {
        return { zone: entry.zone, render: buildPanelRenderer(adapter, entry.render as Type<unknown>) };
      }
      return entry;
    });
    return { ...slot, render: zoned };
  }

  if (isComponentClass(slot.render)) {
    return { ...slot, render: buildPanelRenderer(adapter, slot.render as Type<unknown>) };
  }
  return slot;
}

// Bridge any Angular component classes embedded in `slots`
// to plain renderer functions before the core plugin factory consumes the config.
registerFeatureConfigPreprocessor('pinnedRows', (config, adapter) => {
  if (!config || typeof config !== 'object') return config;
  const cfg = config as CorePinnedRowsConfig;
  let next: CorePinnedRowsConfig = cfg;

  // Slots[] bridging \u2014 each PanelSlot.render may be a component class, or an
  // array of { zone?, render } where each render may be a component class.
  if (Array.isArray(cfg.slots)) {
    next = { ...next, slots: cfg.slots.map((slot) => bridgeSlot(adapter, slot)) };
  }

  return next;
});
