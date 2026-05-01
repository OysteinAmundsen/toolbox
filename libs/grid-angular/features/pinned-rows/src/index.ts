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
  PinnedRowsConfig,
  PinnedRowsContext,
  PinnedRowSlot,
  ZonedPanelRender,
} from '@toolbox-web/grid/plugins/pinned-rows';
export type { _Augmentation as _PinnedRowsAugmentation } from '@toolbox-web/grid/features/pinned-rows';

/**
 * Build a pinned-rows panel renderer function from an Angular component class.
 * The component should accept inputs from PinnedRowsContext.
 */
function buildPanelRenderer(
  adapter: GridAdapter,
  componentClass: Type<unknown>,
): (ctx: PinnedRowsContext) => HTMLElement {
  const mount = adapter.mountComponentRenderer<PinnedRowsContext>(componentClass, (ctx) => ({
    totalRows: ctx.totalRows,
    filteredRows: ctx.filteredRows,
    selectedRows: ctx.selectedRows,
    columns: ctx.columns,
    rows: ctx.rows,
    grid: ctx.grid,
  }));
  return (ctx) => mount(ctx).hostElement;
}

/**
 * Bridge a single pinned-row slot. Aggregation slots (no `render`) pass through.
 * For panel slots, wrap any component-class `render` (or array entry's `render`)
 * with the Angular component renderer.
 */
function bridgeSlot(adapter: GridAdapter, slot: PinnedRowSlot): PinnedRowSlot {
  if (!('render' in slot) || slot.render == null) return slot;

  if (Array.isArray(slot.render)) {
    const zoned: ZonedPanelRender[] = slot.render.map((entry) => {
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

// Bridge any Angular component classes embedded in `customPanels` and `slots`
// to plain renderer functions before the core plugin factory consumes the config.
registerFeatureConfigPreprocessor('pinnedRows', (config, adapter) => {
  if (!config || typeof config !== 'object') return config;
  const cfg = config as PinnedRowsConfig;
  let next: PinnedRowsConfig = cfg;

  // Legacy customPanels bridging.
  if (Array.isArray(cfg.customPanels)) {
    const hasComponentRender = cfg.customPanels.some((panel) => isComponentClass(panel.render));
    if (hasComponentRender) {
      next = {
        ...next,
        customPanels: cfg.customPanels.map((panel) => {
          if (!isComponentClass(panel.render)) return panel;
          return { ...panel, render: buildPanelRenderer(adapter, panel.render) };
        }),
      };
    }
  }

  // Slots[] bridging \u2014 each PanelSlot.render may be a component class, or an
  // array of { zone?, render } where each render may be a component class.
  if (Array.isArray(cfg.slots)) {
    next = { ...next, slots: cfg.slots.map((slot) => bridgeSlot(adapter, slot)) };
  }

  return next;
});
