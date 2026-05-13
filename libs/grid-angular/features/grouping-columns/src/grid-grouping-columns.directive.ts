/**
 * `GridGroupingColumnsDirective` — owns `[groupingColumns]` on
 * `<tbw-grid>`. No event outputs. See `GridFilteringDirective` for the
 * full rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { registerFeatureClaim, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type { GroupingColumnsConfig } from '@toolbox-web/grid/plugins/grouping-columns';

/**
 * Owns the binding(s) `[groupingColumns]` on `<tbw-grid>` for the matching feature plugin. See `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
@Directive({
  selector: 'tbw-grid[groupingColumns]',
  standalone: true,
})
export class GridGroupingColumnsDirective implements OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly groupingColumns = input<boolean | GroupingColumnsConfig>();

  constructor() {
    registerFeatureClaim(this.elementRef.nativeElement, 'groupingColumns', () => this.groupingColumns());
  }

  ngOnDestroy(): void {
    unregisterFeatureClaim(this.elementRef.nativeElement, 'groupingColumns');
  }
}
