/**
 * `GridMultiSortDirective` — owns the `[multiSort]` input on `<tbw-grid>`.
 * The `(sortChange)` output stays on `Grid` because single-column sort
 * (without this plugin) also emits it. See `GridFilteringDirective` for
 * the full rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { registerFeatureClaim, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type { MultiSortConfig } from '@toolbox-web/grid/plugins/multi-sort';

/**
 * Owns the binding(s) `[multiSort]` on `<tbw-grid>` for the matching feature plugin. See {@link GridFilteringDirective} for the full rationale.
 *
 * @category Directive
 */
@Directive({
  selector: 'tbw-grid[multiSort]',
  standalone: true,
})
export class GridMultiSortDirective implements OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly multiSort = input<boolean | 'single' | 'multi' | MultiSortConfig>();

  constructor() {
    registerFeatureClaim(this.elementRef.nativeElement, 'multiSort', () => this.multiSort());
  }

  ngOnDestroy(): void {
    unregisterFeatureClaim(this.elementRef.nativeElement, 'multiSort');
  }
}
