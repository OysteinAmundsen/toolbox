/**
 * `GridResponsiveDirective` — owns `[responsive]` and `(responsiveChange)`
 * on `<tbw-grid>`. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy, OnInit, output, type Type } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { claimEvent, registerFeatureClaim, unclaimEvent, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type {
  ResponsivePluginConfig as CoreResponsivePluginConfig,
  ResponsiveChangeDetail,
} from '@toolbox-web/grid/plugins/responsive';

/**
 * Angular-specific responsive config that allows an Angular component class
 * as `cardRenderer`.
 *
 * Extends the core `ResponsivePluginConfig` to accept a `Type<unknown>` for
 * `cardRenderer` in addition to the vanilla
 * `(row, rowIndex, column?) => HTMLElement` signature. Bridging to vanilla
 * DOM is handled by the side-effect import
 * `@toolbox-web/grid-angular/features/responsive`.
 *
 * Re-exported from the feature entry under the same name as the core type
 * so Angular consumers see a single canonical `ResponsivePluginConfig` from
 * `@toolbox-web/grid-angular/features/responsive`.
 *
 * @since 1.7.1
 */
export type ResponsivePluginConfig<TRow = unknown> = Omit<CoreResponsivePluginConfig<TRow>, 'cardRenderer'> & {
  cardRenderer?: CoreResponsivePluginConfig<TRow>['cardRenderer'] | Type<unknown>;
};

/**
 * Owns the binding(s) `[responsive], [responsiveChange]` on `<tbw-grid>` for the matching feature plugin. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
@Directive({
  selector: 'tbw-grid[responsive], tbw-grid[responsiveChange]',
  standalone: true,
})
export class GridResponsiveDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly responsive = input<boolean | ResponsivePluginConfig>();
  readonly responsiveChange = output<ResponsiveChangeDetail>();

  private listener?: (e: Event) => void;

  constructor() {
    const grid = this.elementRef.nativeElement;
    registerFeatureClaim(grid, 'responsive', () => this.responsive());
    claimEvent(grid, 'responsive-change');
  }

  ngOnInit(): void {
    const grid = this.elementRef.nativeElement;
    this.listener = (e: Event): void => this.responsiveChange.emit((e as CustomEvent<ResponsiveChangeDetail>).detail);
    grid.addEventListener('responsive-change', this.listener);
  }

  ngOnDestroy(): void {
    const grid = this.elementRef.nativeElement;
    if (this.listener) {
      grid.removeEventListener('responsive-change', this.listener);
      this.listener = undefined;
    }
    unregisterFeatureClaim(grid, 'responsive');
    unclaimEvent(grid, 'responsive-change');
  }
}
