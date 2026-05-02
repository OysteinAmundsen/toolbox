/**
 * `GridPivotDirective` — owns `[pivot]` on `<tbw-grid>`. No event outputs.
 * See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { registerFeatureClaim, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type { PivotConfig } from '@toolbox-web/grid/plugins/pivot';

@Directive({
  selector: 'tbw-grid[pivot]',
  standalone: true,
})
export class GridPivotDirective implements OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly pivot = input<PivotConfig>();

  constructor() {
    registerFeatureClaim(this.elementRef.nativeElement, 'pivot', () => this.pivot());
  }

  ngOnDestroy(): void {
    unregisterFeatureClaim(this.elementRef.nativeElement, 'pivot');
  }
}
