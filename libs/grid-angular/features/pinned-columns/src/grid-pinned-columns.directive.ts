/**
 * `GridPinnedColumnsDirective` — owns `[pinnedColumns]` on `<tbw-grid>`.
 * No event outputs (column pinning is configuration-only). See
 * `GridFilteringDirective` for the full rationale.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { registerFeatureClaim, unregisterFeatureClaim } from '@toolbox-web/grid-angular';

/**
 * Owns the binding(s) `[pinnedColumns]` on `<tbw-grid>` for the matching feature plugin. See {@link GridFilteringDirective} for the full rationale.
 *
 * @category Directive
 */
@Directive({
  selector: 'tbw-grid[pinnedColumns]',
  standalone: true,
})
export class GridPinnedColumnsDirective implements OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  readonly pinnedColumns = input<boolean>();

  constructor() {
    registerFeatureClaim(this.elementRef.nativeElement, 'pinnedColumns', () => this.pinnedColumns());
  }

  ngOnDestroy(): void {
    unregisterFeatureClaim(this.elementRef.nativeElement, 'pinnedColumns');
  }
}
