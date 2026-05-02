/**
 * `GridColumnVirtualizationDirective` — owns `[columnVirtualization]` on
 * `<tbw-grid>`. No event outputs. See `GridFilteringDirective` for the
 * full rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { registerFeatureClaim, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type { ColumnVirtualizationConfig } from '@toolbox-web/grid/plugins/column-virtualization';

@Directive({
  selector: 'tbw-grid[columnVirtualization]',
  standalone: true,
})
export class GridColumnVirtualizationDirective implements OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly columnVirtualization = input<boolean | ColumnVirtualizationConfig>();

  constructor() {
    registerFeatureClaim(this.elementRef.nativeElement, 'columnVirtualization', () => this.columnVirtualization());
  }

  ngOnDestroy(): void {
    unregisterFeatureClaim(this.elementRef.nativeElement, 'columnVirtualization');
  }
}
