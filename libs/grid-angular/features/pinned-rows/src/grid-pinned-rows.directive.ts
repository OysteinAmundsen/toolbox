/**
 * `GridPinnedRowsDirective` — owns `[pinnedRows]` on `<tbw-grid>`. No
 * event outputs. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy, type Type } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { registerFeatureClaim, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type { PanelZone, PinnedRowsConfig, PinnedRowsContext } from '@toolbox-web/grid/plugins/pinned-rows';

/**
 * Angular-shaped panel-slot render: a renderer function (vanilla), an Angular
 * component class, or an array of zoned entries that each accept the same.
 *
 * Component instances receive the {@link PinnedRowsContext} fields as inputs.
 *
 * @since 1.9.0
 */
export type AngularPanelRender = ((ctx: PinnedRowsContext) => HTMLElement | null) | Type<unknown>;

/**
 * Angular-shaped zoned panel render entry.
 *
 * @since 1.9.0
 */
export interface AngularZonedPanelRender {
  zone?: PanelZone;
  render: AngularPanelRender;
}

/**
 * Angular-shaped pinned-rows panel slot.
 *
 * @since 1.9.0
 */
export interface AngularPanelSlot {
  id?: string;
  position?: 'top' | 'bottom';
  render: AngularPanelRender | AngularZonedPanelRender[];
}

type CoreSlot = NonNullable<PinnedRowsConfig['slots']>[number];
type CoreAggregationSlot = Exclude<CoreSlot, { render: unknown }>;

/**
 * Angular-shaped pinned-rows slot \u2014 either an aggregation slot (passthrough)
 * or a panel slot accepting Angular component classes as `render`.
 *
 * @since 1.9.0
 */
export type AngularPinnedRowSlot = CoreAggregationSlot | AngularPanelSlot;

/**
 * Angular-specific pinned-rows config that allows Angular component classes
 * as `render` inside `slots[]` and `customPanels[]`. Bridging to vanilla DOM
 * is handled by the side-effect import
 * `@toolbox-web/grid-angular/features/pinned-rows`.
 *
 * @since 1.9.0
 */
export type AngularPinnedRowsConfig = Omit<PinnedRowsConfig, 'slots' | 'customPanels'> & {
  slots?: AngularPinnedRowSlot[];
  customPanels?: Array<{
    id: string;
    position: PanelZone;
    render: ((ctx: PinnedRowsContext) => HTMLElement) | Type<unknown>;
  }>;
};

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

  readonly pinnedRows = input<boolean | AngularPinnedRowsConfig>();

  constructor() {
    registerFeatureClaim(this.elementRef.nativeElement, 'pinnedRows', () => this.pinnedRows());
  }

  ngOnDestroy(): void {
    unregisterFeatureClaim(this.elementRef.nativeElement, 'pinnedRows');
  }
}
