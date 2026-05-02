/**
 * `GridResponsiveDirective` — owns `[responsive]` and `(responsiveChange)`
 * on `<tbw-grid>`. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy, OnInit, output } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { claimEvent, registerFeatureClaim, unclaimEvent, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type { ResponsiveChangeDetail, ResponsivePluginConfig } from '@toolbox-web/grid/plugins/responsive';

/**
 * Owns the binding(s) `[responsive], [responsiveChange]` on `<tbw-grid>` for the matching feature plugin. See {@link GridFilteringDirective} for the full rationale.
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
