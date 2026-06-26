/**
 * `GridPinnedRowsDirective` — owns `[pinnedRows]` on `<tbw-grid>`. No
 * event outputs. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy, type Type } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { registerFeatureClaim, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type {
  PinnedRowsConfig as CorePinnedRowsConfig,
  PanelZone,
  PinnedRowsContext,
} from '@toolbox-web/grid/plugins/pinned-rows';

/**
 * Angular-shaped panel-slot render: a renderer function (vanilla), an Angular
 * component class, or an array of zoned entries that each accept the same.
 *
 * Component instances receive the {@link PinnedRowsContext} fields as inputs.
 *
 * @since 1.7.1
 */
export type PanelRender = ((ctx: PinnedRowsContext) => HTMLElement | null) | Type<unknown>;

/**
 * Angular-shaped zoned panel render entry.
 *
 * @since 1.7.1
 */
export interface ZonedPanelRender {
  zone?: PanelZone;
  render: PanelRender;
}

/**
 * Angular-shaped pinned-rows panel slot.
 *
 * @since 1.7.1
 */
export interface PanelSlot {
  id?: string;
  position?: 'top' | 'bottom';
  render: PanelRender | ZonedPanelRender[];
}

type CoreSlot = NonNullable<CorePinnedRowsConfig['slots']>[number];
type CoreAggregationSlot = Exclude<CoreSlot, { render: unknown }>;

/**
 * Angular-shaped pinned-rows slot \u2014 either an aggregation slot (passthrough)
 * or a panel slot accepting Angular component classes as `render`.
 *
 * @since 1.7.1
 */
export type PinnedRowSlot = CoreAggregationSlot | PanelSlot;

/**
 * Pinned-rows config widened to accept Angular component classes as `render`
 * inside `slots[]`. Bridging to vanilla DOM is handled
 * by the side-effect import `@toolbox-web/grid-angular/features/pinned-rows`.
 *
 * Re-exported under the same name as the core type so Angular users see a
 * single canonical `PinnedRowsConfig` from
 * `@toolbox-web/grid-angular/features/pinned-rows`.
 *
 * @since 1.7.1
 */
export type PinnedRowsConfig = Omit<CorePinnedRowsConfig, 'slots'> & {
  slots?: PinnedRowSlot[];
};

// ── Deprecated framework-prefixed aliases ──────────────────────────────────
// Retained for backwards compatibility. New code should use the canonical
// (unprefixed) names above.

/** @deprecated Use {@link PanelRender} instead. */
export type AngularPanelRender = PanelRender;
/** @deprecated Use {@link ZonedPanelRender} instead. */
export type AngularZonedPanelRender = ZonedPanelRender;
/** @deprecated Use {@link PanelSlot} instead. */
export type AngularPanelSlot = PanelSlot;
/** @deprecated Use {@link PinnedRowSlot} instead. */
export type AngularPinnedRowSlot = PinnedRowSlot;
/** @deprecated Use {@link PinnedRowsConfig} instead. */
export type AngularPinnedRowsConfig = PinnedRowsConfig;

/**
 * Owns the binding(s) `[pinnedRows]` on `<tbw-grid>` for the matching feature plugin. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
@Directive({
  selector: 'tbw-grid[pinnedRows]',
  standalone: true,
})
export class GridPinnedRowsDirective implements OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly pinnedRows = input<boolean | PinnedRowsConfig>();

  constructor() {
    registerFeatureClaim(this.elementRef.nativeElement, 'pinnedRows', () => this.pinnedRows());
  }

  ngOnDestroy(): void {
    unregisterFeatureClaim(this.elementRef.nativeElement, 'pinnedRows');
  }
}
